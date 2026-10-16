import { EMPTY_EXPECTED, EPITA_EXAMPLE_EXPECTED } from "../config/categories.js";
import { ANALYSIS_STATUS, AUDIT_MODE, DEFAULTS, INPUT_MODE, MODEL_STATUS } from "../config/defaults.js";
import { loadPreferences, savePreferences } from "./preferences.js";

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
    soundConfidenceThreshold: preferences.soundConfidenceThreshold,
    expectedConfiguration: preferences.expectedConfiguration,
    hasVisualSource: false,
    currentSource: null,
    currentAnalysis: null,
    analysisStatus: ANALYSIS_STATUS.IDLE,
    analysisNotice: null,
    detections: [],
    audit: null,
    analysed: false,
    error: null,
    auditMetadata: null,
    imageQuality: null,
    audioStatus: "idle",
    audioCurrentEvent: null,
    audioRecentEvents: [],
    audioError: null,
    audioMetadata: null,
    evidence: []
  };

  const emit = () => listeners.forEach((listener) => listener(state));
  const update = (patch) => { state = { ...state, ...patch }; emit(); };
  const persist = () => {
    try {
      savePreferences(localStorage, {
        confidenceThreshold: state.confidenceThreshold,
        soundConfidenceThreshold: state.soundConfidenceThreshold,
        expectedConfiguration: state.expectedConfiguration
      });
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
    setSoundThreshold(value) { update({ soundConfidenceThreshold: value }); persist(); },
    setImageQuality(imageQuality) { update({ imageQuality }); },
    setEvidence(evidence) { update({ evidence: [...evidence] }); },
    setAudioState(patch) { update(patch); },
    resetAudio() {
      update({ audioStatus: "idle", audioCurrentEvent: null, audioRecentEvents: [], audioError: null, audioMetadata: null });
    },
    queueVisualSource(source, analysis) {
      update({
        inputMode: source.type,
        hasVisualSource: true,
        currentSource: source,
        currentAnalysis: analysis,
        analysisStatus: ANALYSIS_STATUS.QUEUED,
        analysisNotice: state.analysisStatus === ANALYSIS_STATUS.RUNNING ? "new-source" : "image-ready",
        detections: [],
        audit: null,
        analysed: false,
        auditMetadata: null,
        imageQuality: null,
        evidence: [],
        error: null
      });
      return analysis.requestId;
    },
    queueCurrentAnalysis(analysis) {
      if (!state.hasVisualSource) return false;
      update({
        currentAnalysis: analysis,
        analysisStatus: ANALYSIS_STATUS.QUEUED,
        analysisNotice: "analysis-queued",
        detections: [],
        audit: null,
        analysed: false,
        auditMetadata: null,
        error: null
      });
      return true;
    },
    startAnalysis(analysis) {
      const valid = state.modelStatus === MODEL_STATUS.READY && state.hasVisualSource &&
        state.analysisStatus === ANALYSIS_STATUS.QUEUED && matchesAnalysis(state, analysis);
      if (!valid) return false;
      update({ analysisStatus: ANALYSIS_STATUS.RUNNING, analysisNotice: null, error: null });
      return true;
    },
    completeAnalysis(analysis, detections, auditMetadata) {
      if (state.analysisStatus !== ANALYSIS_STATUS.RUNNING || !matchesAnalysis(state, analysis)) return false;
      update({
        detections,
        auditMetadata,
        analysed: true,
        analysisStatus: ANALYSIS_STATUS.COMPLETE,
        analysisNotice: null,
        error: null
      });
      return true;
    },
    failAnalysis(analysis) {
      if (state.analysisStatus !== ANALYSIS_STATUS.RUNNING || !matchesAnalysis(state, analysis)) return false;
      update({ analysisStatus: ANALYSIS_STATUS.IDLE, analysisNotice: "analysis-failed" });
      return true;
    },
    noteStaleResult(analysis) {
      if (state.analysisStatus !== ANALYSIS_STATUS.QUEUED || matchesAnalysis(state, analysis)) return false;
      update({ analysisNotice: "stale-result" });
      return true;
    },
    resetAnalysis() {
      update({
        inputMode: INPUT_MODE.NONE,
        cameraStatus: "idle",
        hasVisualSource: false,
        currentSource: null,
        currentAnalysis: null,
        analysisStatus: ANALYSIS_STATUS.IDLE,
        analysisNotice: null,
        detections: [],
        audit: null,
        analysed: false,
        error: null,
        auditMetadata: null,
        imageQuality: null,
        evidence: []
      });
    }
  };
}

function matchesAnalysis(state, analysis) {
  const current = state.currentAnalysis;
  const source = state.currentSource;
  return Boolean(current && source &&
    analysis.requestId === current.requestId &&
    analysis.sourceId === source.sourceId &&
    analysis.sourceVersion === source.sourceVersion &&
    analysis.detectorId === current.detectorId &&
    analysis.threshold === current.threshold &&
    analysis.preprocessingId === current.preprocessingId);
}
