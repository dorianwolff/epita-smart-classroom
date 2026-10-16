import { CATEGORY_BY_CLASS } from "../config/categories.js";
import { getCocoLabel } from "../config/coco-labels.js";

export function normalizePrediction({ prediction, index, sourceId, sourceVersion = null, requestId = null, modelId, experimental = false }) {
  const rawLabel = String(prediction.rawLabel ?? prediction.class ?? prediction.label ?? "unknown");
  const rawBox = prediction.box ?? prediction.bbox ?? null;
  const values = Array.isArray(rawBox)
    ? rawBox
    : rawBox ? [rawBox.x, rawBox.y, rawBox.width, rawBox.height] : null;
  const category = CATEGORY_BY_CLASS.get(rawLabel) ?? null;
  const box = values ? Object.freeze({ x: values[0], y: values[1], width: values[2], height: values[3] }) : null;
  const geometry = prediction.mask ? "mask" : prediction.polygon ? "polygon" : prediction.orientedBox ? "oriented-box" : box ? "axis-aligned-box" : "none";
  return Object.freeze({
    id: `${sourceId}:${modelId}:${index}`,
    sourceId,
    sourceVersion,
    requestId,
    modelId,
    detectorId: modelId,
    label: rawLabel,
    rawLabel,
    normalizedLabel: rawLabel.trim().toLowerCase(),
    categoryId: category?.id ?? null,
    displayLabel: category?.label ?? getCocoLabel(rawLabel),
    score: Number(prediction.score),
    box,
    bbox: box,
    orientedBox: prediction.orientedBox ?? null,
    mask: prediction.mask ?? null,
    polygon: prediction.polygon ?? null,
    experimental,
    requiresConfirmation: Boolean(prediction.requiresConfirmation),
    metadata: Object.freeze({ source: modelId, geometry, ...(prediction.metadata ?? {}) })
  });
}
