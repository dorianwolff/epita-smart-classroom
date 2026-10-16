import { EMPTY_EXPECTED, EPITA_EXAMPLE_EXPECTED } from "../config/categories.js";
import { ANALYSIS_STATUS, AUDIT_MODE, DEFAULTS, INPUT_MODE, MODEL_STATUS } from "../config/defaults.js";

function sanitizeExpected(candidate = {}) {
  return Object.fromEntries(Object.keys(EMPTY_EXPECTED).map((id) => {
    const value = candidate[id];
    return [id, Number.isInteger(value) && value >= 0 ? value : null];
  }));
}

function loadPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(DEFAULTS.storageKeys.preferences) ?? "{}");
    const threshold = Number(saved.confidenceThreshold);
    return {
      expectedConfiguration: sanitizeExpected(saved.expectedConfiguration),
      confidenceThreshold: threshold >= DEFAULTS.minimumConfidenceThreshold && threshold <= DEFAULTS.maximumConfidenceThreshold
        ? threshold
        : DEFAULTS.confidenceThreshold
    };
  } catch {
    return { expectedConfiguration: { ...EMPTY_EXPECTED }, confidenceThreshold: DEFAULTS.confidenceThreshold };
  }
}

export function createStore() {
  const preferences = loadPreferences();
  const listeners = new Set();
  let state = {
    modelStatus: MODEL_STATUS.LOADING,
    cameraStatus: "idle",
    inputMode: INPUT_MODE.NONE,
    auditMode: AUDIT_MODE.FREE,
    configurationSource: null,
    confidenceThreshold: preferences.confidenceThreshold,
    expectedConfiguration: preferences.expectedConfiguration,
    hasVisualSource: false,
    sourceRevision: 0,
    analysisStatus: ANALYSIS_STATUS.IDLE,
    detections: [],
    audit: null,
    analysed: false,
    error: null,
    auditMetadata: null
  };

  const emit = () => listeners.forEach((listener) => listener(state));
  const update = (patch) => { state = { ...state, ...patch }; emit(); };
  const persist = () => {
    try {
      localStorage.setItem(DEFAULTS.storageKeys.preferences, JSON.stringify({
        confidenceThreshold: state.confidenceThreshold,
        expectedConfiguration: state.expectedConfiguration
      }));
    } catch (error) {
      console.warn(`[SalleScope] Préférences non enregistrées : ${error.message}`);
    }
  };

  return {
    getState: () => state,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    update,
    setModelStatus(modelStatus) { update({ modelStatus }); },
    setAuditMode(auditMode) { update({ auditMode }); },
    setExpected(id, value) {
      update({ expectedConfiguration: { ...state.expectedConfiguration, [id]: value }, configurationSource: "custom" });
      persist();
    },
    loadExampleConfiguration() {
      update({ expectedConfiguration: { ...EPITA_EXAMPLE_EXPECTED }, configurationSource: "example" });
      persist();
    },
    resetConfiguration() {
      update({ expectedConfiguration: { ...EMPTY_EXPECTED }, configurationSource: null });
      persist();
    },
    setThreshold(value) { update({ confidenceThreshold: value }); persist(); },
    queueVisualSource(inputMode) {
      const sourceRevision = state.sourceRevision + 1;
      update({
        inputMode,
        hasVisualSource: true,
        sourceRevision,
        analysisStatus: ANALYSIS_STATUS.QUEUED,
        detections: [],
        analysed: false,
        auditMetadata: null,
        error: null
      });
      return sourceRevision;
    },
    queueCurrentAnalysis() {
      if (!state.hasVisualSource) return false;
      update({ analysisStatus: ANALYSIS_STATUS.QUEUED, error: null });
      return true;
    },
    startAnalysis(revision) {
      const valid = state.modelStatus === MODEL_STATUS.READY && state.hasVisualSource &&
        state.analysisStatus === ANALYSIS_STATUS.QUEUED && state.sourceRevision === revision;
      if (!valid) return false;
      update({ analysisStatus: ANALYSIS_STATUS.RUNNING, error: null });
      return true;
    },
    completeAnalysis(revision, detections, auditMetadata) {
      if (state.sourceRevision !== revision || state.analysisStatus !== ANALYSIS_STATUS.RUNNING) return false;
      update({ detections, auditMetadata, analysed: true, analysisStatus: ANALYSIS_STATUS.COMPLETE, error: null });
      return true;
    },
    failAnalysis(revision) {
      if (state.sourceRevision !== revision || state.analysisStatus !== ANALYSIS_STATUS.RUNNING) return false;
      update({ analysisStatus: ANALYSIS_STATUS.IDLE });
      return true;
    },
    resetAnalysis() {
      update({
        inputMode: INPUT_MODE.NONE,
        cameraStatus: "idle",
        hasVisualSource: false,
        sourceRevision: state.sourceRevision + 1,
        analysisStatus: ANALYSIS_STATUS.IDLE,
        detections: [],
        audit: null,
        analysed: false,
        error: null,
        auditMetadata: null
      });
    }
  };
}
