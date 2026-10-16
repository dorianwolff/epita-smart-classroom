import { DEFAULTS } from "../../config/defaults.js";
import { AppError, safeLog } from "../../utils/errors.js";
import { normalizePrediction } from "../prediction-normalizer.js";

function waitForLibrary(timeoutMilliseconds = 12000) {
  const startedAt = performance.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      if (window.cocoSsd) return resolve(window.cocoSsd);
      if (performance.now() - startedAt >= timeoutMilliseconds) return reject(new Error("COCO-SSD library unavailable"));
      requestAnimationFrame(check);
    };
    check();
  });
}

export function createCocoDetector(options = {}) {
  const resolveLibrary = options.resolveLibrary ?? waitForLibrary;
  let model = null;
  let loadPromise = null;

  async function load() {
    if (model) return model;
    if (loadPromise) return loadPromise;
    loadPromise = resolveLibrary()
      .then((cocoSsd) => cocoSsd.load({ base: DEFAULTS.model.base }))
      .then((loadedModel) => { model = loadedModel; return model; })
      .catch((error) => {
        loadPromise = null;
        safeLog("model-load", error);
        throw new AppError("MODEL_LOAD");
      });
    return loadPromise;
  }

  async function detect(source, { threshold, sourceId }) {
    if (!model) throw new AppError("MODEL_LOAD");
    try {
      const predictions = await model.detect(source, DEFAULTS.maximumDetectionBoxes, threshold);
      return predictions
        .filter((prediction) => prediction.score >= threshold)
        .map((prediction, index) => normalizePrediction({
          prediction,
          index,
          sourceId,
          modelId: DEFAULTS.model.id
        }));
    } catch (error) {
      safeLog("detection", error);
      throw new AppError("DETECTION");
    }
  }

  function dispose() {
    model?.dispose?.();
    model = null;
    loadPromise = null;
  }

  function getMetadata() {
    return {
      id: DEFAULTS.model.id,
      label: DEFAULTS.model.label,
      threshold: DEFAULTS.confidenceThreshold,
      backend: globalThis.tf?.getBackend?.() ?? "TensorFlow.js"
    };
  }

  return { load, detect, dispose, getMetadata };
}
