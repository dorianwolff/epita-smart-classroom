import { DEFAULTS, INPUT_MODE, MODEL_STATUS } from "../config/defaults.js";
import { DEFAULT_EXPECTED } from "../config/categories.js";

function sanitizeExpected(candidate = {}) {
  return Object.fromEntries(Object.entries(DEFAULT_EXPECTED).map(([id, fallback]) => {
    const value = Number(candidate[id]);
    return [id, Number.isInteger(value) && value >= 0 ? value : fallback];
  }));
}

function loadPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(DEFAULTS.storageKeys.preferences) ?? "{}");
    const threshold = Number(saved.confidenceThreshold);
    return {
      expectedConfiguration: sanitizeExpected(saved.expectedConfiguration),
      confidenceThreshold: threshold >= 0.3 && threshold <= 0.9 ? threshold : DEFAULTS.confidenceThreshold
    };
  } catch {
    return { expectedConfiguration: { ...DEFAULT_EXPECTED }, confidenceThreshold: DEFAULTS.confidenceThreshold };
  }
}

export function createStore() {
  const preferences = loadPreferences();
  const listeners = new Set();
  let state = {
    modelStatus: MODEL_STATUS.LOADING,
    cameraStatus: "idle",
    inputMode: INPUT_MODE.NONE,
    confidenceThreshold: preferences.confidenceThreshold,
    expectedConfiguration: preferences.expectedConfiguration,
    detections: [],
    audit: null,
    analysed: false,
    isAnalysing: false,
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
    setExpected(id, value) {
      update({ expectedConfiguration: { ...state.expectedConfiguration, [id]: Math.max(0, Math.trunc(value)) } });
      persist();
    },
    setThreshold(value) { update({ confidenceThreshold: value }); persist(); },
    setAnalysis(detections, auditMetadata) { update({ detections, auditMetadata, analysed: true, isAnalysing: false, error: null }); },
    resetAnalysis() { update({ detections: [], audit: null, analysed: false, isAnalysing: false, error: null, auditMetadata: null, inputMode: INPUT_MODE.NONE }); }
  };
}
