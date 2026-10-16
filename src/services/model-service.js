import { DEFAULTS } from "../config/defaults.js";
import { createCocoDetector } from "../detection/adapters/coco-detector.js";
import { createDetectorRegistry } from "../detection/detector-registry.js";
import { removePrivatePredictions } from "../detection/privacy-filter.js";

export function createModelService(options = {}) {
  const detector = options.detector ?? createCocoDetector(options);
  const registry = createDetectorRegistry([detector], DEFAULTS.model.id);

  async function load() {
    return registry.getActive().load();
  }

  async function detect(source, optionsOrThreshold) {
    const options = typeof optionsOrThreshold === "number"
      ? { threshold: optionsOrThreshold, sourceId: "legacy-source" }
      : optionsOrThreshold;
    const predictions = await registry.getActive().detect(source, options);
    return removePrivatePredictions(predictions);
  }

  return {
    load,
    detect,
    dispose: () => registry.getActive().dispose(),
    getMetadata: () => registry.getActive().getMetadata(),
    getDetectorId: () => registry.getActiveId()
  };
}
