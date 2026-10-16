import { CATEGORIES } from "../config/categories.js";
import { DEFAULTS, INPUT_MODE, MODEL_STATUS } from "../config/defaults.js";
import { CloudController } from "../cloud/cloud-controller.js";
import { CameraWorkspaceController } from "../camera/camera-workspace-controller.js";
import { calculateAudit } from "../domain/audit-engine.js";
import { createEvidence } from "../evidence/evidence-schema.js";
import { proposeBoardCandidate } from "../evidence/board-candidate.js";
import { EvidenceController } from "../evidence/evidence-controller.js";
import { ManualAnnotationController } from "../evidence/manual-annotation-controller.js";
import { assessImageQuality } from "../quality/image-quality-assessor.js";
import { createAnalysisCoordinator, createThresholdReanalysis } from "../services/analysis-coordinator.js";
import { createImageSource, takeSelectedFile } from "../services/image-service.js";
import { printReport } from "../services/report-service.js";
import { getIntrinsicSize } from "../services/source-resolution.js";
import { getElement } from "../utils/dom.js";
import { getErrorContent, safeLog } from "../utils/errors.js";
import { clearCanvas, renderCanvas, renderOverlay } from "./canvas-renderer.js";
import { renderConfiguration } from "./configuration-view.js";
import { renderApplicationState } from "./application-view.js";
import { WorkflowController } from "./workflow-controller.js";

function boardCandidate(asset) {
  const { width: sourceWidth, height: sourceHeight } = getIntrinsicSize(asset);
  const longest = 160;
  const scale = Math.min(1, longest / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(24, Math.round(sourceWidth * scale));
  const height = Math.max(24, Math.round(sourceHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
  context.drawImage(asset, 0, 0, width, height);
  return proposeBoardCandidate(context.getImageData(0, 0, width, height).data, width, height);
}

export class UiController {
  constructor({ store, modelService, cameraService, audioController }) {
    this.store = store;
    this.modelService = modelService;
    this.cameraService = cameraService;
    this.audioController = audioController;
    this.elements = this.getElements();
    this.sourceIntent = 0;
    this.workflow = new WorkflowController();
    this.analysis = createAnalysisCoordinator({ store, modelService,
      onComplete: (result) => this.handleAnalysisComplete(result), onError: (error) => this.handleAnalysisError(error) });
    this.thresholdReanalysis = createThresholdReanalysis(() => this.analysis.retry(), DEFAULTS.thresholdDebounceMilliseconds);
  }

  getElements() {
    const ids = ["model-status", "analysis-canvas", "analysis-overlay", "detection-overlay", "results-canvas", "results-overlay", "annotation-overlay",
      "image-upload", "retry-analysis", "cancel-analysis", "confidence", "confidence-value", "app-error", "error-title",
      "error-message", "error-action", "analysis-status", "configuration-section", "configuration-label", "configuration-grid",
      "load-example", "reset-configuration", "detection-results", "results-summary", "dashboard", "global-status", "audit-rows",
      "report-content", "print-report", "quality-panel", "quality-summary", "quality-metrics", "quality-guidance", "low-threshold-warning"];
    return Object.fromEntries(ids.map((id) => [id.replaceAll("-", "_"), getElement(`#${id}`)]));
  }

  start() {
    this.bindEvents();
    const state = this.store.getState();
    this.elements.confidence.value = String(state.confidenceThreshold * 100);
    this.elements.confidence_value.textContent = `${Math.round(state.confidenceThreshold * 100)} %`;
    renderConfiguration(this.elements.configuration_grid, CATEGORIES, state.expectedConfiguration, (id, value) => {
      this.store.setExpected(id, value); this.recalculateAudit();
    });
    this.setupControllers();
    this.recalculateAudit();
    this.store.subscribe((nextState) => renderApplicationState(this.elements, nextState));
    renderApplicationState(this.elements, state);
    void this.loadModel();
    window.addEventListener("beforeunload", () => { this.cameraWorkspace.close(); this.audioController.stop(); });
  }

  setupControllers() {
    this.workflow.start();
    this.annotation = new ManualAnnotationController({ canvas: this.elements.annotation_overlay,
      sourceSize: () => ({ width: this.elements.annotation_overlay.width, height: this.elements.annotation_overlay.height }),
      onCreate: (item) => this.evidence.add(item), onUpdate: (item) => this.evidence.update(item) });
    this.annotation.start();
    this.evidence = new EvidenceController({ store: this.store, annotation: this.annotation, onChange: () => this.recalculateAudit() });
    this.evidence.start();
    this.cameraWorkspace = new CameraWorkspaceController({ cameraService: this.cameraService,
      threshold: () => this.store.getState().confidenceThreshold, onCapture: (source) => this.queueSource(source, INPUT_MODE.CAMERA),
      uploadInput: this.elements.image_upload });
    this.cameraWorkspace.start();
    this.cloud = new CloudController({ store: this.store });
    this.cloud.start();
  }

  bindEvents() {
    this.elements.image_upload.addEventListener("change", (event) => this.handleUpload(event));
    this.elements.retry_analysis.addEventListener("click", () => { this.workflow.show("analysis"); void this.analysis.retry(); });
    this.elements.cancel_analysis.addEventListener("click", () => this.reset());
    this.elements.print_report.addEventListener("click", printReport);
    this.elements.error_action.addEventListener("click", () => this.handleErrorAction());
    this.elements.confidence.addEventListener("input", (event) => this.updateThreshold(event));
    this.elements.load_example.addEventListener("click", () => { this.store.loadExampleConfiguration(); this.recalculateAudit(); });
    this.elements.reset_configuration.addEventListener("click", () => { this.store.resetConfiguration(); this.recalculateAudit(); });
    document.querySelectorAll('input[name="audit-mode"]').forEach((input) => input.addEventListener("change", (event) => {
      this.store.setAuditMode(event.target.value); this.recalculateAudit();
    }));
    const settings = getElement("#settings-dialog");
    [getElement("#open-settings"), ...document.querySelectorAll("[data-open-settings]")]
      .forEach((button) => button.addEventListener("click", () => settings.showModal()));
  }

  async loadModel() {
    this.store.setModelStatus(MODEL_STATUS.LOADING);
    this.store.update({ error: null });
    try { await this.modelService.load(); this.store.setModelStatus(MODEL_STATUS.READY); await this.analysis.processQueue(); }
    catch (error) { this.store.setModelStatus(MODEL_STATUS.ERROR); this.showError(error); }
  }

  async handleUpload(event) {
    const file = takeSelectedFile(event.target);
    if (!file) return;
    const intent = ++this.sourceIntent;
    try {
      const source = await createImageSource(file);
      if (intent !== this.sourceIntent) { source.close?.(); return; }
      this.cameraWorkspace.close();
      this.audioController.stop();
      this.queueSource(source, INPUT_MODE.UPLOAD);
    } catch (error) { if (intent === this.sourceIntent) this.showError(error); }
  }

  queueSource(source, inputMode) {
    this.thresholdReanalysis.cancel();
    renderCanvas(this.elements.analysis_canvas, source);
    renderCanvas(this.elements.results_canvas, source);
    clearCanvas(this.elements.detection_overlay);
    clearCanvas(this.elements.results_overlay);
    const { width, height } = getIntrinsicSize(source);
    this.elements.annotation_overlay.width = width; this.elements.annotation_overlay.height = height;
    this.elements.annotation_overlay.parentElement.style.aspectRatio = `${width} / ${height}`;
    const record = this.analysis.setSource(source, inputMode);
    try { this.store.setImageQuality(assessImageQuality(record.asset, record)); }
    catch (error) { safeLog("image-quality", error); }
    const candidate = boardCandidate(record.asset);
    if (candidate) this.store.setEvidence([createEvidence(candidate)]);
    this.annotation.setEvidence(this.store.getState().evidence);
    this.recalculateAudit();
    this.workflow.show("analysis");
  }

  handleAnalysisComplete({ source, detections }) {
    if (source.sourceId !== this.store.getState().currentSource?.sourceId) return;
    renderOverlay(this.elements.detection_overlay, source.asset, detections);
    renderOverlay(this.elements.results_overlay, source.asset, detections);
    this.evidence.deriveContext();
    this.recalculateAudit();
    this.workflow.show("results");
  }

  handleAnalysisError(error) { this.showError(error); }

  updateThreshold(event) {
    const threshold = Number(event.target.value) / 100;
    this.store.setThreshold(threshold);
    this.elements.confidence_value.textContent = `${Math.round(threshold * 100)} %`;
    if (this.analysis.hasSource()) this.thresholdReanalysis.schedule();
  }

  recalculateAudit() {
    const state = this.store.getState();
    this.store.update({ audit: calculateAudit({ detections: state.detections, evidence: state.evidence, categories: CATEGORIES,
      expectedConfiguration: state.expectedConfiguration, analysed: state.analysed, auditMode: state.auditMode }) });
  }

  reset() {
    this.sourceIntent += 1;
    this.thresholdReanalysis.cancel();
    this.cameraWorkspace?.close();
    this.analysis.reset();
    this.audioController.stop({ clear: true });
    this.elements.image_upload.value = "";
    [this.elements.analysis_canvas, this.elements.detection_overlay, this.elements.results_canvas,
      this.elements.results_overlay, this.elements.annotation_overlay].forEach(clearCanvas);
    this.annotation?.setEvidence([]);
    this.recalculateAudit();
    this.workflow.show("capture");
  }

  showError(error) { this.store.update({ error: getErrorContent(error) }); }
  handleErrorAction() {
    if (this.store.getState().error?.code === "MODEL_LOAD") return this.loadModel();
    if (this.analysis.hasSource()) return this.analysis.retry();
    this.workflow.show("capture");
  }
}
