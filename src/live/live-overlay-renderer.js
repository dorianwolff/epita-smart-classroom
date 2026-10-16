import { containTransform, transformBox } from "./overlay-transform.js";

const LABELS = Object.freeze({ chair: "Chaise", "dining table": "Table", laptop: "Ordinateur", tv: "Écran" });

export function renderLiveOverlay(canvas, video, detections = []) {
  const width = Math.max(1, Math.round(canvas.clientWidth));
  const height = Math.max(1, Math.round(canvas.clientHeight));
  const ratio = Math.min(2, globalThis.devicePixelRatio ?? 1);
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  const context = canvas.getContext("2d");
  context.scale(ratio, ratio);
  context.clearRect(0, 0, width, height);
  if (!video.videoWidth || !video.videoHeight) return;
  const transform = containTransform(video.videoWidth, video.videoHeight, width, height);
  context.lineWidth = 2;
  context.font = "600 13px system-ui, sans-serif";
  detections.forEach((detection) => {
    const box = transformBox(detection.box, transform);
    context.strokeStyle = "#5eead4";
    context.fillStyle = "rgba(7, 20, 38, .78)";
    context.strokeRect(box.x, box.y, box.width, box.height);
    const label = `${LABELS[detection.rawLabel] ?? detection.rawLabel} ${Math.round(detection.score * 100)} %`;
    const labelWidth = context.measureText(label).width + 12;
    const y = Math.max(20, box.y);
    context.fillRect(box.x, y - 20, labelWidth, 20);
    context.fillStyle = "#fff";
    context.fillText(label, box.x + 6, y - 5);
  });
}

export function clearLiveOverlay(canvas) {
  canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
}
