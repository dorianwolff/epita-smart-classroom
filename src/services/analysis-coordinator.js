import { ANALYSIS_STATUS, DEFAULTS, MODEL_STATUS } from "../config/defaults.js";
import { createSourceRecord, getSourceMetadata, releaseSource } from "./source-record.js";

export function createThresholdReanalysis(retry, delayMilliseconds) {
  let timeoutId = null;
  return {
    schedule() {
      if (timeoutId !== null) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        timeoutId = null;
        retry();
      }, delayMilliseconds);
    },
    cancel() {
      if (timeoutId !== null) clearTimeout(timeoutId);
      timeoutId = null;
    }
  };
}

export function createAnalysisCoordinator({ store, modelService, onComplete, onError }) {
  let currentSource = null;
  let activeJob = null;
  let pendingLatestJob = null;
  let requestId = 0;
  let sourceVersion = 0;

  function jobSummary(job) {
    return Object.freeze({
      requestId: job.requestId,
      sourceId: job.source.sourceId,
      sourceVersion: job.source.sourceVersion,
      detectorId: job.detectorId,
      threshold: job.threshold,
      preprocessingId: job.preprocessingId
    });
  }

  function createJob(source) {
    requestId += 1;
    return {
      requestId,
      source,
      detectorId: modelService.getDetectorId?.() ?? DEFAULTS.model.id,
      threshold: store.getState().confidenceThreshold,
      preprocessingId: DEFAULTS.preprocessing.id,
      stale: false,
      promise: null
    };
  }

  function replacePending(job) {
    if (pendingLatestJob && pendingLatestJob.source !== currentSource && pendingLatestJob.source !== activeJob?.source) {
      releaseSource(pendingLatestJob.source);
    }
    pendingLatestJob = job;
  }

  async function processQueue() {
    if (activeJob) return activeJob.promise;
    const state = store.getState();
    if (!pendingLatestJob || state.modelStatus !== MODEL_STATUS.READY || state.analysisStatus !== ANALYSIS_STATUS.QUEUED) return null;

    const job = pendingLatestJob;
    pendingLatestJob = null;
    const summary = jobSummary(job);
    if (!store.startAnalysis(summary)) return null;
    activeJob = job;
    const startedAt = performance.now();

    job.promise = modelService.detect(job.source.asset, {
      threshold: job.threshold,
      sourceId: job.source.sourceId,
      sourceVersion: job.source.sourceVersion,
      requestId: job.requestId
    })
      .then((detections) => {
        const model = modelService.getMetadata?.() ?? { id: DEFAULTS.model.id, label: DEFAULTS.model.label, backend: "unknown" };
        const metadata = {
          completedAt: new Date().toISOString(),
          inputMode: job.source.type,
          sourceId: job.source.sourceId,
          sourceVersion: job.source.sourceVersion,
          requestId: job.requestId,
          confidenceThreshold: job.threshold,
          sourceWidth: job.source.width,
          sourceHeight: job.source.height,
          inferenceMilliseconds: Math.round(performance.now() - startedAt),
          model: model.label,
          modelId: model.id,
          runtimeBackend: model.backend,
          preprocessingId: job.preprocessingId,
          preprocessingLabel: DEFAULTS.preprocessing.label
        };
        if (!job.stale && store.completeAnalysis(summary, detections, metadata)) {
          onComplete({ source: job.source, detections, requestId: job.requestId });
        } else store.noteStaleResult(summary);
      })
      .catch((error) => {
        if (!job.stale && store.failAnalysis(summary)) onError(error);
        else store.noteStaleResult(summary);
      })
      .finally(() => {
        if (job.source !== currentSource) releaseSource(job.source);
        activeJob = null;
        if (pendingLatestJob) void processQueue();
      });

    return job.promise;
  }

  function setSource(asset, inputMode) {
    const previousSource = currentSource;
    sourceVersion += 1;
    currentSource = createSourceRecord(asset, inputMode, sourceVersion);
    if (activeJob) activeJob.stale = true;
    const job = createJob(currentSource);
    replacePending(job);
    store.queueVisualSource(getSourceMetadata(currentSource), jobSummary(job));
    if (previousSource && previousSource !== activeJob?.source && previousSource !== pendingLatestJob?.source) {
      releaseSource(previousSource);
    }
    void processQueue();
    return currentSource;
  }

  function retry() {
    if (!currentSource) return null;
    if (activeJob) activeJob.stale = true;
    const job = createJob(currentSource);
    replacePending(job);
    if (!store.queueCurrentAnalysis(jobSummary(job))) return null;
    return processQueue();
  }

  function reset() {
    if (activeJob) activeJob.stale = true;
    if (pendingLatestJob && pendingLatestJob.source !== activeJob?.source) releaseSource(pendingLatestJob.source);
    if (currentSource && currentSource !== activeJob?.source) releaseSource(currentSource);
    pendingLatestJob = null;
    currentSource = null;
    store.resetAnalysis();
  }

  return {
    setSource,
    processQueue,
    retry,
    reset,
    getSource: () => currentSource,
    hasSource: () => Boolean(currentSource),
    getActiveJob: () => activeJob && jobSummary(activeJob),
    getPendingJob: () => pendingLatestJob && jobSummary(pendingLatestJob)
  };
}
