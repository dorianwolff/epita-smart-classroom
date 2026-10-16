import { DEFAULTS } from "../config/defaults.js";
import { createAdaptiveSampler } from "./adaptive-sampler.js";
import { createBoxTracker } from "./box-tracker.js";
import { createLiveInferenceQueue } from "./live-inference-queue.js";
import { clearLiveOverlay, renderLiveOverlay } from "./live-overlay-renderer.js";

function fittedSize(width, height, longestSide) {
  const scale = Math.min(1, longestSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export class LiveDetectionController {
  constructor({ video, canvas, onStatus, onMetrics = () => {}, workerFactory = () => new Worker(new URL("./live-detection-worker.js", import.meta.url)) }) {
    this.video = video;
    this.canvas = canvas;
    this.onStatus = onStatus;
    this.onMetrics = onMetrics;
    this.workerFactory = workerFactory;
    this.worker = null;
    this.requests = new Map();
    this.sessionId = null;
    this.frameId = 0;
    this.callbackId = null;
    this.lastSample = 0;
    this.capturing = false;
    this.enabled = true;
    this.tracker = createBoxTracker({ alpha: DEFAULTS.live.smoothingAlpha, minimumIoU: DEFAULTS.live.minimumIoU,
      missedTolerance: DEFAULTS.live.missedFrameTolerance });
    this.sampler = createAdaptiveSampler({ minimumInterval: DEFAULTS.live.minimumIntervalMilliseconds,
      slowDuration: DEFAULTS.live.slowInferenceMilliseconds, initialSize: DEFAULTS.live.initialLongestSide,
      reducedSize: DEFAULTS.live.reducedLongestSide });
    this.queue = createLiveInferenceQueue({ run: (frame) => this.run(frame), accept: (result) => this.accept(result) });
    this.handleVisibility = () => document.hidden ? this.pause() : this.resume();
  }

  start(sessionId, threshold) {
    this.stop();
    this.sessionId = sessionId;
    this.threshold = threshold;
    this.worker = this.workerFactory();
    this.worker.addEventListener("message", ({ data }) => this.handleMessage(data));
    this.worker.addEventListener("error", () => this.fail("Détection indisponible — la caméra reste utilisable"));
    this.queue.start(sessionId);
    this.tracker.reset();
    this.sampler.reset();
    document.addEventListener("visibilitychange", this.handleVisibility);
    this.onStatus("Chargement de la détection…");
    this.schedule();
  }

  schedule() {
    if (!this.sessionId || document.hidden || !this.enabled) return;
    const callback = (timestamp) => { this.callbackId = null; void this.offerFrame(timestamp); this.schedule(); };
    this.callbackId = this.video.requestVideoFrameCallback
      ? this.video.requestVideoFrameCallback(callback)
      : requestAnimationFrame(callback);
  }

  async offerFrame(timestamp) {
    if (this.capturing || timestamp - this.lastSample < this.sampler.getState().interval || !this.video.videoWidth) return;
    if (typeof createImageBitmap !== "function" || typeof OffscreenCanvas !== "function") {
      this.fail("Détection indisponible — la caméra reste utilisable");
      return;
    }
    this.capturing = true;
    try {
      const size = fittedSize(this.video.videoWidth, this.video.videoHeight, this.sampler.getState().longestSide);
      const bitmap = await createImageBitmap(this.video, { resizeWidth: size.width, resizeHeight: size.height, resizeQuality: "low" });
      if (!this.sessionId) { bitmap.close(); return; }
      this.frameId += 1;
      this.lastSample = timestamp;
      this.queue.enqueue({ cameraSessionId: this.sessionId, frameId: this.frameId, frameTimestamp: timestamp,
        detectorId: DEFAULTS.live.detectorId, threshold: this.threshold, status: "queued", width: size.width,
        height: size.height, resource: bitmap });
    } finally { this.capturing = false; }
  }

  run(frame) {
    return new Promise((resolve) => {
      this.requests.set(frame.frameId, resolve);
      this.worker.postMessage({ type: "detect", bitmap: frame.resource, width: frame.width, height: frame.height,
        cameraSessionId: frame.cameraSessionId, frameId: frame.frameId, frameTimestamp: frame.frameTimestamp,
        threshold: frame.threshold }, [frame.resource]);
    });
  }

  handleMessage(result) {
    const resolve = this.requests.get(result.frameId);
    if (!resolve) return;
    this.requests.delete(result.frameId);
    resolve(result);
  }

  accept(result) {
    const scaleX = this.video.videoWidth / result.width;
    const scaleY = this.video.videoHeight / result.height;
    const scaled = result.detections.map((item) => ({ ...item, box: {
      x: item.box.x * scaleX, y: item.box.y * scaleY, width: item.box.width * scaleX, height: item.box.height * scaleY
    } }));
    renderLiveOverlay(this.canvas, this.video, this.tracker.update(scaled));
    const timing = this.sampler.record(result.inferenceMilliseconds);
    this.onMetrics({ inferenceMilliseconds: result.inferenceMilliseconds, ...timing });
    this.onStatus(timing.reduced ? "Détection réduite pour préserver les performances" : "Détection en direct");
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) { this.queue.stop(); clearLiveOverlay(this.canvas); this.onStatus("Détection en direct désactivée"); }
    else if (this.sessionId) { this.queue.start(this.sessionId); this.schedule(); }
  }

  pause() { this.cancelFrame(); clearLiveOverlay(this.canvas); }
  resume() { if (this.sessionId && this.enabled) this.schedule(); }
  fail(message) { this.onStatus(message); this.setEnabled(false); }
  cancelFrame() {
    if (this.callbackId === null) return;
    if (this.video.cancelVideoFrameCallback) this.video.cancelVideoFrameCallback(this.callbackId);
    else cancelAnimationFrame(this.callbackId);
    this.callbackId = null;
  }
  stop() {
    this.cancelFrame();
    this.queue?.stop();
    this.worker?.postMessage({ type: "dispose" });
    this.worker?.terminate();
    this.worker = null;
    this.requests.clear();
    this.sessionId = null;
    this.tracker.reset();
    clearLiveOverlay(this.canvas);
    document.removeEventListener("visibilitychange", this.handleVisibility);
  }
}
