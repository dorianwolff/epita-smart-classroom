import { LiveDetectionController } from "../live/live-detection-controller.js";
import { createLightingMonitor } from "../live/lighting-monitor.js";
import { getErrorContent } from "../utils/errors.js";
import { lockBodyScroll } from "../ui/body-scroll-lock.js";

export class CameraWorkspaceController {
  constructor({ cameraService, threshold, onCapture, uploadInput }) {
    this.cameraService = cameraService;
    this.threshold = threshold;
    this.onCapture = onCapture;
    this.uploadInput = uploadInput;
    this.dialog = document.querySelector("#camera-workspace");
    this.video = document.querySelector("#camera-live-preview");
    this.canvas = document.querySelector("#camera-live-overlay");
    this.status = document.querySelector("#camera-model-status");
    this.lightingChip = document.querySelector("#camera-lighting-status");
    this.recovery = document.querySelector("#camera-recovery");
    this.restoreScroll = null;
    this.returnFocus = null;
    this.sessionId = null;
    this.live = new LiveDetectionController({ video: this.video, canvas: this.canvas,
      onStatus: (message) => { this.status.textContent = message; },
      onMetrics: (metrics) => {
        this.status.dataset.inferenceMilliseconds = String(metrics.inferenceMilliseconds);
        this.status.dataset.sampleSize = String(metrics.longestSide);
      } });
    this.lighting = createLightingMonitor({ video: this.video, onUpdate: (quality) => this.renderLighting(quality) });
  }

  start() {
    document.querySelector("#open-camera").addEventListener("click", () => this.open());
    document.querySelector("#camera-close").addEventListener("click", () => this.close());
    document.querySelector("#camera-capture").addEventListener("click", () => this.capture());
    document.querySelector("#camera-switch").addEventListener("click", () => this.switchCamera());
    document.querySelector("#camera-live-toggle").addEventListener("change", (event) => this.live.setEnabled(event.target.checked));
    document.querySelector("#camera-upload-alternative").addEventListener("click", () => { this.close(); this.uploadInput.click(); });
    this.dialog.addEventListener("cancel", (event) => { event.preventDefault(); this.close(); });
  }

  async open() {
    if (this.dialog.open) return;
    this.returnFocus = document.activeElement;
    this.restoreScroll = lockBodyScroll();
    this.dialog.showModal();
    this.recovery.hidden = true;
    this.video.hidden = false;
    this.status.textContent = "Ouverture de la caméra…";
    document.querySelector("#camera-close").focus();
    try {
      await this.startStream();
      const inputs = await this.cameraService.listVideoInputs();
      document.querySelector("#camera-switch").hidden = inputs.length < 2;
    } catch (error) { this.showRecovery(error); }
  }

  async startStream() {
    await this.cameraService.start(this.video, { onEnded: () => this.showRecovery({ code: "CAMERA_NOT_FOUND" }) });
    this.sessionId = crypto.randomUUID?.() ?? `camera-${Date.now()}`;
    this.live.start(this.sessionId, this.threshold());
    this.lighting.start();
  }

  async switchCamera() {
    this.live.stop();
    this.lighting.stop();
    try {
      const stream = await this.cameraService.switchCamera(this.video, { onEnded: () => this.showRecovery({ code: "CAMERA_NOT_FOUND" }) });
      if (!stream) return;
      this.sessionId = crypto.randomUUID?.() ?? `camera-${Date.now()}`;
      this.live.start(this.sessionId, this.threshold());
      this.lighting.start();
    } catch (error) { this.showRecovery(error); }
  }

  capture() {
    try {
      this.live.stop();
      this.lighting.stop();
      const source = this.cameraService.capture(this.video);
      this.cameraService.stop(this.video);
      this.close({ stop: false });
      this.onCapture(source);
    } catch (error) { this.showRecovery(error); }
  }

  close({ stop = true } = {}) {
    this.live.stop();
    this.lighting.stop();
    if (stop) this.cameraService.stop(this.video);
    if (this.dialog.open) this.dialog.close();
    this.restoreScroll?.();
    this.restoreScroll = null;
    this.sessionId = null;
    this.returnFocus?.focus?.({ preventScroll: true });
  }

  showRecovery(error) {
    this.live.stop();
    this.lighting.stop();
    this.cameraService.stop(this.video);
    const content = getErrorContent(error);
    this.video.hidden = true;
    this.recovery.hidden = false;
    this.recovery.querySelector("strong").textContent = content.title;
    this.recovery.querySelector("p").textContent = content.message;
    this.status.textContent = "Caméra indisponible";
  }

  renderLighting(quality) {
    this.lightingChip.textContent = quality.state;
    this.lightingChip.dataset.state = quality.status;
    this.lightingChip.title = quality.guidance[0] ?? "Qualité lumineuse de l’image";
  }
}
