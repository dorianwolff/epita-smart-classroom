import { ANALYSIS_STATUS, AUDIT_MODE, MODEL_STATUS } from "../config/defaults.js";
import { renderReport } from "../services/report-service.js";
import { renderAuditRows } from "./audit-view.js";
import { updateConfigurationValues } from "./configuration-view.js";
import { renderDashboard } from "./dashboard-view.js";
import { renderResults } from "./results-view.js";

function renderModelStatus(element, status) {
  const content = { loading: ["Chargement du modèle…", "status-loading"], ready: ["Modèle final prêt", "status-ready"],
    error: ["Modèle indisponible", "status-error"] }[status];
  element.textContent = content[0];
  element.className = `status-pill ${content[1]}`;
}

export function renderAnalysisStatus(element, state) {
  let message = "Choisissez une image pour commencer.";
  if (state.analysisStatus === ANALYSIS_STATUS.RUNNING) message = "Analyse finale locale en cours…";
  else if (state.analysisNotice === "stale-result") message = "Résultat obsolète ignoré ; la dernière image reste prioritaire.";
  else if (state.analysisNotice === "new-source") message = "Nouvelle image figée ; le précédent résultat sera ignoré.";
  else if (state.analysisStatus === ANALYSIS_STATUS.QUEUED && state.modelStatus === MODEL_STATUS.LOADING) message = "Image prête. Modèle en cours de chargement.";
  else if (state.analysisStatus === ANALYSIS_STATUS.QUEUED) message = "Analyse finale en attente.";
  else if (state.analysisStatus === ANALYSIS_STATUS.COMPLETE) message = "Analyse terminée. Les résultats sont prêts à être confirmés.";
  else if (state.analysisNotice === "analysis-failed") message = "Analyse impossible. Réessayez sans perdre la photo.";
  element.textContent = message;
}

function renderError(elements, error) {
  elements.app_error.hidden = !error;
  if (!error) return;
  elements.error_title.textContent = error.title;
  elements.error_message.textContent = error.message;
  elements.error_action.textContent = error.code === "MODEL_LOAD" ? "Recharger le modèle" : "Réessayer";
  elements.error_action.hidden = false;
}

function renderImageQuality(elements, quality) {
  elements.quality_panel.hidden = !quality;
  if (!quality) return;
  const { metrics } = quality;
  elements.quality_summary.textContent = `Qualité lumineuse de l’image : ${quality.state ?? quality.status}`;
  elements.quality_metrics.textContent = `${metrics.width} × ${metrics.height} px · luminance relative moyenne ${Math.round(metrics.meanLuminance * 100)} % · contraste percentile ${Math.round(metrics.contrast * 100)} %`;
  elements.quality_guidance.replaceChildren(...quality.guidance.map((text) => {
    const item = document.createElement("li"); item.textContent = text; return item;
  }));
}

export function renderApplicationState(elements, state) {
  const running = state.analysisStatus === ANALYSIS_STATUS.RUNNING;
  renderModelStatus(elements.model_status, state.modelStatus);
  document.body.setAttribute("aria-busy", String(state.modelStatus === MODEL_STATUS.LOADING || running));
  elements.analysis_overlay.hidden = !running;
  elements.retry_analysis.disabled = state.modelStatus !== MODEL_STATUS.READY || !state.hasVisualSource || running;
  elements.print_report.disabled = !state.analysed && !state.audioRecentEvents.length;
  elements.configuration_section.hidden = state.auditMode !== AUDIT_MODE.CONFIGURED;
  elements.configuration_label.hidden = state.configurationSource !== "example";
  elements.low_threshold_warning.hidden = state.confidenceThreshold >= 0.25;
  document.querySelectorAll('input[name="audit-mode"]').forEach((input) => { input.checked = input.value === state.auditMode; });
  updateConfigurationValues(elements.configuration_grid, state.expectedConfiguration);
  renderAnalysisStatus(elements.analysis_status, state);
  renderError(elements, state.error);
  renderImageQuality(elements, state.imageQuality);
  renderReport(elements.report_content, state);
  if (!state.audit) return;
  renderResults(elements.detection_results, elements.results_summary, state.audit);
  renderDashboard(elements.dashboard, elements.global_status, state.audit.metrics);
  renderAuditRows(elements.audit_rows, state.audit.rows);
}
