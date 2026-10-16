const TF_URL = "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js";
const COCO_URL = "https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js";
const PRIVATE_LABELS = new Set(["person", "human", "student", "teacher", "face", "man", "woman", "boy", "girl"]);
let model = null;
let loading = null;
let surface = null;

async function load() {
  if (model) return model;
  if (!loading) {
    loading = (async () => {
      importScripts(TF_URL, COCO_URL);
      model = await self.cocoSsd.load({ base: "lite_mobilenet_v2" });
      return model;
    })();
  }
  return loading;
}

self.addEventListener("message", async ({ data }) => {
  if (data.type === "dispose") {
    model?.dispose?.();
    model = null;
    loading = null;
    surface = null;
    return;
  }
  if (data.type !== "detect") return;
  const { bitmap, width, height, cameraSessionId, frameId, frameTimestamp, threshold } = data;
  const startedAt = performance.now();
  try {
    const detector = await load();
    surface = surface && surface.width === width && surface.height === height ? surface : new OffscreenCanvas(width, height);
    surface.getContext("2d", { alpha: false }).drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const predictions = await detector.detect(surface, 50, threshold);
    const detections = predictions
      .filter((item) => !PRIVATE_LABELS.has(String(item.class).trim().toLowerCase()))
      .map((item) => ({ rawLabel: item.class, score: item.score, box: {
        x: item.bbox[0], y: item.bbox[1], width: item.bbox[2], height: item.bbox[3]
      } }));
    self.postMessage({ type: "result", cameraSessionId, frameId, frameTimestamp, detectorId: "coco-ssd-lite-mobilenet-v2",
      threshold, status: "complete", width, height, detections, inferenceMilliseconds: Math.round(performance.now() - startedAt) });
  } catch (error) {
    bitmap?.close?.();
    self.postMessage({ type: "error", cameraSessionId, frameId, detectorId: "coco-ssd-lite-mobilenet-v2",
      status: "error", message: error instanceof Error ? error.message : "Live detection failed" });
  }
});
