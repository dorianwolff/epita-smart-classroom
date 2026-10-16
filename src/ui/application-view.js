import { ANALYSIS_STATUS, AUDIT_MODE, MODEL_STATUS } from "../config/defaults.js";
import { renderReport } from "../services/report-service.js";
import { renderAuditRows } from "./audit-view.js";
import { updateConfigurationValues } from "./configuration-view.js";
import { renderDashboard } from "./dashboard-view.js";
import { renderResults } from "./results-view.js";

function renderModelStatus(element, status) {
  const content = {
    loading: ["Chargement du modèle de détection précise…", "status-loading"],
    ready: ["Modèle prêt", "status-ready"],
    error: ["Modèle indisponible", "status-error"]
  }[status];
  element.textContent = content[0];
  element.className = `status-pill ${content[1]}`;
}

export function renderAnalysisStatus(element, state) {
  let message = "Choisissez une source visuelle pour commencer.";
  if (state.cameraStatus === "active") message = "Caméra prête. Cadrez la salle puis capturez la photo.";
  else if (state.analysisStatus === ANALYSIS_STATUS.RUNNING) message = "Analyse locale en cours…";
  else if (state.analysisStatus === ANALYSIS_STATUS.QUEUED && state.modelStatus === MODEL_STATUS.LOADING) message = "Photo prête. L’analyse démarrera automatiquement.";
  else if (state.analysisStatus === ANALYSIS_STATUS.QUEUED && state.modelStatus === MODEL_STATUS.ERROR) message = "Photo prête. Réessayez le chargement du modèle pour lancer l’analyse.";
  else if (state.analysisStatus === ANALYSIS_STATUS.COMPLETE) message = "Analyse terminée. Consultez les détections et le rapport ci-dessous.";
  else if (state.hasVisualSource) message = "Photo prête. Vous pouvez relancer l’analyse.";
  element.textContent = message;
}

function renderError(elements, error) {
  elements.app_error.hidden = !error;
  if (!error) return;
  elements.error_title.textContent = error.title;
  elements.error_message.textContent = error.message;
  const cameraError = error.code.startsWith("CAMERA") || ["INSECURE_CONTEXT", "UNSUPPORTED_BROWSER"].includes(error.code);
  elements.error_action.textContent = error.code === "MODEL_LOAD" ? "Réessayer le chargement du modèle" : cameraError ? "Importer une image" : "Réessayer";
  elements.error_action.hidden = false;
}

export function renderApplicationState(elements, state) {
  const running = state.analysisStatus === ANALYSIS_STATUS.RUNNING;
  const activeCamera = state.cameraStatus === "active";
  const auditStarted = activeCamera || state.hasVisualSource;
  renderModelStatus(elements.model_status, state.modelStatus);
  document.body.setAttribute("aria-busy", String(state.modelStatus === MODEL_STATUS.LOADING || running));
  document.body.classList.toggle("has-audit-started", auditStarted);
  elements.analysis_overlay.parentElement.dataset.stageState = activeCamera ? "camera" : state.hasVisualSource ? "captured" : "empty";
  elements.analysis_overlay.parentElement.setAttribute("aria-busy", String(running));
  elements.analysis_overlay.hidden = !running;
  elements.start_camera.disabled = activeCamera;
  elements.start_camera.hidden = activeCamera || state.hasVisualSource;
  elements.retake_photo.hidden = activeCamera || !state.hasVisualSource;
  elements.capture.disabled = !activeCamera;
  elements.capture.hidden = !activeCamera;
  elements.stop_camera.disabled = !activeCamera;
  elements.stop_camera.hidden = !activeCamera;
  elements.stage_upload_label.textContent = state.hasVisualSource ? "Choisir une autre image" : "Importer une image";
  elements.capture_guidance.hidden = state.analysed;
  elements.analyse_upload.disabled = state.modelStatus !== MODEL_STATUS.READY || !state.hasVisualSource || activeCamera || running;
  elements.print_report.disabled = !state.analysed;
  elements.configuration_section.hidden = state.auditMode !== AUDIT_MODE.CONFIGURED;
  elements.configuration_label.hidden = state.configurationSource !== "example";
  document.querySelectorAll('input[name="audit-mode"]').forEach((input) => { input.checked = input.value === state.auditMode; });
  updateConfigurationValues(elements.configuration_grid, state.expectedConfiguration);
  renderAnalysisStatus(elements.analysis_status, state);
  renderError(elements, state.error);
  if (!state.audit) return;
  renderResults(elements.detection_results, elements.results_summary, state.audit);
  renderDashboard(elements.dashboard, elements.global_status, state.audit.metrics);
  renderAuditRows(elements.audit_rows, state.audit.rows);
  renderReport(elements.report_content, state);
}
