import { CATEGORIES } from "../config/categories.js";
import { DEFAULTS, INPUT_MODE, MODEL_STATUS } from "../config/defaults.js";
import { calculateAudit } from "../domain/audit-engine.js";
import { createAnalysisCoordinator, createThresholdReanalysis } from "../services/analysis-coordinator.js";
import { createImageSource, takeSelectedFile } from "../services/image-service.js";
import { assessImageQuality } from "../quality/image-quality-assessor.js";
import { printReport } from "../services/report-service.js";
import { getElement } from "../utils/dom.js";
import { AppError, getErrorContent, safeLog } from "../utils/errors.js";
import { clearCanvas, renderCanvas, renderOverlay } from "./canvas-renderer.js";
import { renderConfiguration } from "./configuration-view.js";
import { renderApplicationState } from "./application-view.js";

export class UiController {
  constructor({ store, modelService, cameraService, audioController }) {
    this.store = store;
    this.modelService = modelService;
    this.cameraService = cameraService;
    this.audioController = audioController;
    this.elements = this.getElements();
    this.sourceIntent = 0;
    this.analysis = createAnalysisCoordinator({
      store,
      modelService,
      onComplete: (result) => this.handleAnalysisComplete(result),
      onError: (error) => this.handleAnalysisError(error)
    });
    this.thresholdReanalysis = createThresholdReanalysis(
      () => this.analysis.retry(),
      DEFAULTS.thresholdDebounceMilliseconds
    );
  }

  getElements() {
    const ids = ["model-status", "camera-preview", "detection-canvas", "detection-overlay", "empty-visual", "analysis-overlay",
      "start-camera", "retake-photo", "capture", "stop-camera", "stage-upload-label", "image-upload", "hero-upload", "analyse-upload",
      "reset-audit", "confidence", "confidence-value", "app-error", "error-title", "error-message",
      "error-action", "analysis-status", "capture-guidance", "configuration-section", "configuration-label", "configuration-grid",
      "load-example", "reset-configuration", "detection-results", "results-summary", "dashboard",
      "global-status", "audit-rows", "report-content", "print-report"];
    ids.push("quality-panel", "quality-summary", "quality-metrics", "quality-guidance", "low-threshold-warning");
    return Object.fromEntries(ids.map((id) => [id.replaceAll("-", "_"), getElement(`#${id}`)]));
  }

  start() {
    this.bindEvents();
    const state = this.store.getState();
    this.elements.confidence.min = String(DEFAULTS.minimumConfidenceThreshold * 100);
    this.elements.confidence.max = String(DEFAULTS.maximumConfidenceThreshold * 100);
    this.elements.confidence.step = String(DEFAULTS.confidenceStep * 100);
    this.elements.confidence.value = String(state.confidenceThreshold * 100);
    this.elements.confidence_value.textContent = `${Math.round(state.confidenceThreshold * 100)} %`;
    renderConfiguration(this.elements.configuration_grid, CATEGORIES, state.expectedConfiguration, (id, value) => {
      this.store.setExpected(id, value);
      this.recalculateAudit();
    });
    this.recalculateAudit();
    this.store.subscribe((nextState) => renderApplicationState(this.elements, nextState));
    renderApplicationState(this.elements, this.store.getState());
    void this.loadModel();
    window.addEventListener("beforeunload", () => {
      this.cameraService.stop(this.elements.camera_preview);
      this.audioController.stop();
    });
  }

  bindEvents() {
    this.elements.hero_upload.addEventListener("click", () => this.elements.image_upload.click());
    this.elements.image_upload.addEventListener("change", (event) => this.handleUpload(event));
    this.elements.start_camera.addEventListener("click", () => this.startCamera());
    this.elements.retake_photo.addEventListener("click", () => this.startCamera());
    this.elements.stop_camera.addEventListener("click", () => this.stopCamera());
    this.elements.capture.addEventListener("click", () => this.capturePhoto());
    this.elements.analyse_upload.addEventListener("click", () => this.analysis.retry());
    this.elements.reset_audit.addEventListener("click", () => this.reset());
    this.elements.print_report.addEventListener("click", printReport);
    this.elements.error_action.addEventListener("click", () => this.handleErrorAction());
    this.elements.confidence.addEventListener("input", (event) => this.updateThreshold(event));
    this.elements.load_example.addEventListener("click", () => this.loadExampleConfiguration());
    this.elements.reset_configuration.addEventListener("click", () => this.resetConfiguration());
    document.querySelectorAll('input[name="audit-mode"]').forEach((input) => {
      input.addEventListener("change", (event) => this.changeAuditMode(event.target.value));
    });
  }

  async loadModel() {
    this.store.setModelStatus(MODEL_STATUS.LOADING);
    this.store.update({ error: null });
    try {
      await this.modelService.load();
      this.store.setModelStatus(MODEL_STATUS.READY);
      await this.analysis.processQueue();
    } catch (error) {
      this.store.setModelStatus(MODEL_STATUS.ERROR);
      this.showError(error);
    }
  }

  async handleUpload(event) {
    const file = takeSelectedFile(event.target);
    if (!file) return;
    const intent = ++this.sourceIntent;
    try {
      const source = await createImageSource(file);
      if (intent !== this.sourceIntent) return;
      this.stopCamera();
      this.queueSource(source, INPUT_MODE.UPLOAD);
    } catch (error) {
      if (intent !== this.sourceIntent) return;
      this.showError(error);
    }
  }

  async startCamera() {
    this.thresholdReanalysis.cancel();
    this.audioController.stop();
    try {
      if (this.cameraService.isActive()) await this.cameraService.resume(this.elements.camera_preview);
      else await this.cameraService.start(this.elements.camera_preview);
      this.elements.camera_preview.hidden = false;
      this.elements.detection_canvas.hidden = true;
      this.elements.detection_overlay.hidden = true;
      this.elements.empty_visual.hidden = true;
      this.store.update({ cameraStatus: "active", error: null });
    } catch (error) {
      this.showError(error);
    }
  }

  stopCamera() {
    this.cameraService.stop(this.elements.camera_preview);
    this.elements.camera_preview.hidden = true;
    this.store.update({ cameraStatus: "idle" });
    if (this.analysis.hasSource()) this.showCanvas();
    else this.showEmpty();
  }

  capturePhoto() {
    try {
      const source = this.cameraService.capture(this.elements.camera_preview);
      this.sourceIntent += 1;
      this.cameraService.pause(this.elements.camera_preview);
      this.store.update({ cameraStatus: "paused" });
      this.queueSource(source, INPUT_MODE.CAMERA);
    } catch (error) {
      this.showError(error);
    }
  }

  queueSource(source, inputMode) {
    this.thresholdReanalysis.cancel();
    renderCanvas(this.elements.detection_canvas, source);
    clearCanvas(this.elements.detection_overlay);
    this.showCanvas();
    const record = this.analysis.setSource(source, inputMode);
    try {
      this.store.setImageQuality(assessImageQuality(record.asset, record));
    } catch (error) {
      safeLog("image-quality", error);
    }
    this.recalculateAudit();
  }

  handleAnalysisComplete({ source, detections }) {
    this.recalculateAudit();
    if (source.sourceId === this.store.getState().currentSource?.sourceId) {
      renderOverlay(this.elements.detection_overlay, source.asset, detections);
    }
    if (!detections.length) {
      this.showError(new AppError("NO_SAFE_OBJECTS"));
    }
  }

  handleAnalysisError(error) {
    this.showError(error);
  }

  updateThreshold(event) {
    const threshold = Number(event.target.value) / 100;
    this.store.setThreshold(threshold);
    this.elements.confidence_value.textContent = `${Math.round(threshold * 100)} %`;
    if (this.analysis.hasSource() && this.store.getState().cameraStatus !== "active") {
      this.elements.analysis_status.textContent = "Seuil modifié. Nouvelle analyse dans un instant…";
      this.thresholdReanalysis.schedule();
    }
  }

  changeAuditMode(auditMode) {
    this.store.setAuditMode(auditMode);
    this.recalculateAudit();
  }

  loadExampleConfiguration() {
    this.store.loadExampleConfiguration();
    this.recalculateAudit();
  }

  resetConfiguration() {
    this.store.resetConfiguration();
    this.recalculateAudit();
  }

  recalculateAudit() {
    const state = this.store.getState();
    const audit = calculateAudit({
      detections: state.detections,
      categories: CATEGORIES,
      expectedConfiguration: state.expectedConfiguration,
      analysed: state.analysed,
      auditMode: state.auditMode
    });
    this.store.update({ audit });
  }

  reset() {
    this.sourceIntent += 1;
    this.thresholdReanalysis.cancel();
    this.cameraService.stop(this.elements.camera_preview);
    this.analysis.reset();
    this.audioController.stop({ clear: true });
    this.elements.image_upload.value = "";
    clearCanvas(this.elements.detection_canvas);
    clearCanvas(this.elements.detection_overlay);
    this.showEmpty();
    this.recalculateAudit();
  }

  showError(error) {
    if (!(error instanceof AppError)) safeLog("interface", error);
    this.store.update({ error: getErrorContent(error) });
  }

  handleErrorAction() {
    const code = this.store.getState().error?.code;
    if (code === "MODEL_LOAD") return this.loadModel();
    if (code?.startsWith("CAMERA") || code === "INSECURE_CONTEXT" || code === "UNSUPPORTED_BROWSER") {
      return this.elements.image_upload.click();
    }
    if (this.analysis.hasSource()) return this.analysis.retry();
    this.reset();
  }

  showCanvas() {
    this.elements.camera_preview.hidden = true;
    this.elements.detection_canvas.hidden = false;
    this.elements.detection_overlay.hidden = false;
    this.elements.empty_visual.hidden = true;
  }

  showEmpty() {
    this.elements.camera_preview.hidden = true;
    this.elements.detection_canvas.hidden = true;
    this.elements.detection_overlay.hidden = true;
    this.elements.empty_visual.hidden = false;
  }

}
