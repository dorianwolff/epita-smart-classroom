import { CATEGORIES, CATEGORY_BY_CLASS } from "../config/categories.js";
import { INPUT_MODE, MODEL_STATUS } from "../config/defaults.js";
import { calculateAudit } from "../domain/audit-engine.js";
import { createImageSource } from "../services/image-service.js";
import { printReport, renderReport } from "../services/report-service.js";
import { getElement } from "../utils/dom.js";
import { AppError, getErrorContent, safeLog } from "../utils/errors.js";
import { renderAuditRows } from "./audit-view.js";
import { clearCanvas, renderCanvas } from "./canvas-renderer.js";
import { renderConfiguration } from "./configuration-view.js";
import { renderDashboard } from "./dashboard-view.js";
import { renderResults } from "./results-view.js";

export class UiController {
  constructor({ store, modelService, cameraService }) {
    this.store = store;
    this.modelService = modelService;
    this.cameraService = cameraService;
    this.source = null;
    this.elements = this.getElements();
  }

  getElements() {
    const ids = ["model-status", "camera-preview", "detection-canvas", "empty-visual", "analysis-overlay",
      "start-camera", "capture", "stop-camera", "image-upload", "hero-upload", "analyse-upload",
      "reset-audit", "confidence", "confidence-value", "app-error", "error-title", "error-message",
      "error-action", "analysis-status", "configuration-grid", "detection-results", "results-summary",
      "dashboard", "global-status", "audit-rows", "report-content", "print-report"];
    return Object.fromEntries(ids.map((id) => [id.replaceAll("-", "_"), getElement(`#${id}`)]));
  }

  start() {
    this.bindEvents();
    const state = this.store.getState();
    this.elements.confidence.value = String(state.confidenceThreshold * 100);
    renderConfiguration(this.elements.configuration_grid, CATEGORIES, state.expectedConfiguration, (id, value) => {
      this.store.setExpected(id, value);
      this.recalculateAudit();
    });
    this.recalculateAudit();
    this.store.subscribe((nextState) => this.render(nextState));
    this.render(this.store.getState());
    this.loadModel();
    window.addEventListener("beforeunload", () => this.cameraService.stop(this.elements.camera_preview));
  }

  bindEvents() {
    this.elements.hero_upload.addEventListener("click", () => this.elements.image_upload.click());
    this.elements.image_upload.addEventListener("change", (event) => this.handleUpload(event));
    this.elements.start_camera.addEventListener("click", () => this.startCamera());
    this.elements.stop_camera.addEventListener("click", () => this.stopCamera());
    this.elements.capture.addEventListener("click", () => this.captureAndAnalyse());
    this.elements.analyse_upload.addEventListener("click", () => this.runAnalysis());
    this.elements.reset_audit.addEventListener("click", () => this.reset());
    this.elements.print_report.addEventListener("click", printReport);
    this.elements.error_action.addEventListener("click", () => this.handleErrorAction());
    this.elements.confidence.addEventListener("input", (event) => this.updateThreshold(event));
  }

  async loadModel() {
    this.store.update({ modelStatus: MODEL_STATUS.LOADING, error: null });
    try {
      await this.modelService.load();
      this.store.update({ modelStatus: MODEL_STATUS.READY });
    } catch (error) {
      this.showError(error);
      this.store.update({ modelStatus: MODEL_STATUS.ERROR });
    }
  }

  async handleUpload(event) {
    const [file] = event.target.files;
    if (!file) return;
    try {
      this.stopCamera();
      this.source = await createImageSource(file);
      renderCanvas(this.elements.detection_canvas, this.source);
      this.showCanvas();
      this.store.update({ inputMode: INPUT_MODE.UPLOAD, error: null });
      this.setStatus("Image prête. Lancez l’analyse.");
    } catch (error) {
      this.source = null;
      event.target.value = "";
      this.showError(error);
    }
  }

  async startCamera() {
    try {
      await this.cameraService.start(this.elements.camera_preview);
      this.source = null;
      this.elements.camera_preview.hidden = false;
      this.elements.detection_canvas.hidden = true;
      this.elements.empty_visual.hidden = true;
      this.store.update({ cameraStatus: "active", inputMode: INPUT_MODE.CAMERA, error: null });
      this.setStatus("Caméra prête. Cadrez la salle puis capturez l’image.");
    } catch (error) {
      this.showError(error);
    }
  }

  stopCamera() {
    this.cameraService.stop(this.elements.camera_preview);
    this.elements.camera_preview.hidden = true;
    this.store.update({ cameraStatus: "idle" });
    if (!this.source) this.showEmpty();
  }

  async captureAndAnalyse() {
    try {
      this.source = this.cameraService.capture(this.elements.camera_preview);
      this.stopCamera();
      renderCanvas(this.elements.detection_canvas, this.source);
      this.showCanvas();
      this.store.update({ inputMode: INPUT_MODE.CAMERA });
      await this.runAnalysis();
    } catch (error) {
      this.showError(error);
    }
  }

  async runAnalysis() {
    const state = this.store.getState();
    if (!this.source || state.modelStatus !== MODEL_STATUS.READY || state.isAnalysing) return;
    this.store.update({ isAnalysing: true, error: null });
    this.setStatus("Analyse locale en cours…");
    try {
      const detections = await this.modelService.detect(this.source, state.confidenceThreshold);
      const metadata = { completedAt: new Date().toISOString(), inputMode: state.inputMode, confidenceThreshold: state.confidenceThreshold };
      this.store.setAnalysis(detections, metadata);
      this.recalculateAudit();
      renderCanvas(this.elements.detection_canvas, this.source, detections);
      this.setStatus("Analyse terminée. Vérifiez les résultats et les écarts.");
      if (!detections.some((detection) => CATEGORY_BY_CLASS.has(detection.className))) {
        this.showError(new AppError("NO_SUPPORTED_OBJECTS"));
      }
    } catch (error) {
      this.store.update({ isAnalysing: false });
      this.showError(error);
    }
  }

  updateThreshold(event) {
    const threshold = Number(event.target.value) / 100;
    this.store.setThreshold(threshold);
    this.elements.confidence_value.textContent = `${Math.round(threshold * 100)} %`;
    if (this.source) this.setStatus("Seuil modifié. Relancez l’analyse pour actualiser les détections.");
  }

  recalculateAudit() {
    const state = this.store.getState();
    const audit = calculateAudit({
      detections: state.detections,
      categories: CATEGORIES,
      expectedConfiguration: state.expectedConfiguration,
      analysed: state.analysed
    });
    this.store.update({ audit });
  }

  reset() {
    this.cameraService.stop(this.elements.camera_preview);
    this.source = null;
    this.elements.image_upload.value = "";
    clearCanvas(this.elements.detection_canvas);
    this.showEmpty();
    this.store.resetAnalysis();
    this.recalculateAudit();
    this.setStatus("Audit réinitialisé. Choisissez une nouvelle image.");
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
    if (this.source) return this.runAnalysis();
    this.reset();
  }

  showCanvas() {
    this.elements.camera_preview.hidden = true;
    this.elements.detection_canvas.hidden = false;
    this.elements.empty_visual.hidden = true;
  }

  showEmpty() {
    this.elements.camera_preview.hidden = true;
    this.elements.detection_canvas.hidden = true;
    this.elements.empty_visual.hidden = false;
  }

  setStatus(message) {
    this.elements.analysis_status.textContent = message;
  }

  render(state) {
    const ready = state.modelStatus === MODEL_STATUS.READY;
    const activeCamera = state.cameraStatus === "active";
    const hasSource = Boolean(this.source);
    this.renderModelStatus(state.modelStatus);
    document.body.setAttribute("aria-busy", String(state.modelStatus === MODEL_STATUS.LOADING || state.isAnalysing));
    this.elements.analysis_overlay.parentElement.setAttribute("aria-busy", String(state.isAnalysing));
    this.elements.analysis_overlay.hidden = !state.isAnalysing;
    this.elements.capture.disabled = !ready || !activeCamera || state.isAnalysing;
    this.elements.stop_camera.disabled = !activeCamera;
    this.elements.analyse_upload.disabled = !ready || !hasSource || activeCamera || state.isAnalysing;
    this.elements.print_report.disabled = !state.analysed;
    this.renderError(state.error);
    if (!state.audit) return;
    renderResults(this.elements.detection_results, this.elements.results_summary, state.audit);
    renderDashboard(this.elements.dashboard, this.elements.global_status, state.audit.metrics);
    renderAuditRows(this.elements.audit_rows, state.audit.rows);
    renderReport(this.elements.report_content, state);
  }

  renderModelStatus(status) {
    const content = {
      loading: ["Chargement du modèle", "status-loading"],
      ready: ["Modèle prêt", "status-ready"],
      error: ["Modèle indisponible", "status-error"]
    }[status];
    this.elements.model_status.textContent = content[0];
    this.elements.model_status.className = `status-pill ${content[1]}`;
  }

  renderError(error) {
    this.elements.app_error.hidden = !error;
    if (!error) return;
    this.elements.error_title.textContent = error.title;
    this.elements.error_message.textContent = error.message;
    const cameraError = error.code.startsWith("CAMERA") || ["INSECURE_CONTEXT", "UNSUPPORTED_BROWSER"].includes(error.code);
    this.elements.error_action.textContent = error.code === "MODEL_LOAD" ? "Réessayer" : cameraError ? "Importer une image" : "Réessayer";
    this.elements.error_action.hidden = false;
  }
}
