import { DEFAULTS } from "../config/defaults.js";
import { AppError, safeLog } from "../utils/errors.js";

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

export function createModelService() {
  let model = null;
  let loadPromise = null;

  async function load() {
    if (model) return model;
    if (loadPromise) return loadPromise;
    loadPromise = waitForLibrary()
      .then((cocoSsd) => cocoSsd.load({ base: DEFAULTS.model.base }))
      .then((loadedModel) => { model = loadedModel; return model; })
      .catch((error) => {
        loadPromise = null;
        safeLog("model-load", error);
        throw new AppError("MODEL_LOAD");
      });
    return loadPromise;
  }

  async function detect(source, threshold) {
    if (!model) throw new AppError("MODEL_LOAD");
    try {
      const rawPredictions = await model.detect(source, DEFAULTS.maximumDetectionBoxes, threshold);
      return rawPredictions
        .filter((prediction) => prediction.class !== "person" && prediction.score >= threshold)
        .map((prediction) => ({
          className: prediction.class,
          score: prediction.score,
          bbox: [...prediction.bbox]
        }));
    } catch (error) {
      safeLog("detection", error);
      throw new AppError("DETECTION");
    }
  }

  return { load, detect };
}
