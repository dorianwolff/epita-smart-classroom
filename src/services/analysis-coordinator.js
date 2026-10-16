import { ANALYSIS_STATUS, MODEL_STATUS } from "../config/defaults.js";

export function createAnalysisCoordinator({ store, modelService, onComplete, onError }) {
  let currentSource = null;
  let activePromise = null;

  async function processQueue() {
    if (activePromise) return activePromise;
    const state = store.getState();
    if (!currentSource || state.modelStatus !== MODEL_STATUS.READY || state.analysisStatus !== ANALYSIS_STATUS.QUEUED) return null;

    const revision = state.sourceRevision;
    const source = currentSource;
    const threshold = state.confidenceThreshold;
    if (!store.startAnalysis(revision)) return null;

    activePromise = modelService.detect(source, threshold)
      .then((detections) => {
        const metadata = {
          completedAt: new Date().toISOString(),
          inputMode: store.getState().inputMode,
          confidenceThreshold: threshold
        };
        if (store.completeAnalysis(revision, detections, metadata)) onComplete({ source, detections });
      })
      .catch((error) => {
        if (store.failAnalysis(revision)) onError(error);
      })
      .finally(() => {
        activePromise = null;
        if (store.getState().analysisStatus === ANALYSIS_STATUS.QUEUED) void processQueue();
      });

    return activePromise;
  }

  function setSource(source, inputMode) {
    currentSource = source;
    store.queueVisualSource(inputMode);
    void processQueue();
  }

  function retry() {
    if (!currentSource || !store.queueCurrentAnalysis()) return null;
    return processQueue();
  }

  function reset() {
    currentSource = null;
    store.resetAnalysis();
  }

  return {
    setSource,
    processQueue,
    retry,
    reset,
    getSource: () => currentSource,
    hasSource: () => Boolean(currentSource)
  };
}
