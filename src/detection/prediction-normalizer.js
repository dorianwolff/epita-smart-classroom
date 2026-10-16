import { CATEGORY_BY_CLASS } from "../config/categories.js";
import { getCocoLabel } from "../config/coco-labels.js";

export function normalizePrediction({ prediction, index, sourceId, modelId, experimental = false }) {
  const rawLabel = String(prediction.rawLabel ?? prediction.class ?? prediction.label ?? "unknown");
  const values = Array.isArray(prediction.bbox)
    ? prediction.bbox
    : [prediction.bbox.x, prediction.bbox.y, prediction.bbox.width, prediction.bbox.height];
  const category = CATEGORY_BY_CLASS.get(rawLabel) ?? null;
  return Object.freeze({
    id: `${sourceId}:${modelId}:${index}`,
    sourceId,
    modelId,
    rawLabel,
    categoryId: category?.id ?? null,
    displayLabel: category?.label ?? getCocoLabel(rawLabel),
    score: Number(prediction.score),
    bbox: Object.freeze({ x: values[0], y: values[1], width: values[2], height: values[3] }),
    experimental
  });
}
