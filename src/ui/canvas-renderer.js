import { CATEGORY_BY_CLASS } from "../config/categories.js";
import { getCocoLabel } from "../config/coco-labels.js";
import { DEFAULTS } from "../config/defaults.js";
import { getIntrinsicSize } from "../services/source-resolution.js";
import { formatPercent } from "../utils/formatting.js";

function getLabel(detection) {
  const modelLabel = detection.modelId === DEFAULTS.model.id ? "COCO-SSD" : detection.modelId;
  return `${detection.displayLabel ?? getCocoLabel(detection.rawLabel)} · ${formatPercent(detection.score)} · ${modelLabel}`;
}

function drawDetection(context, detection, canvasWidth) {
  const { x, y, width, height } = detection.bbox;
  const color = CATEGORY_BY_CLASS.get(detection.rawLabel)?.color ?? "#20c7b5";
  const label = getLabel(detection);
  const fontSize = Math.max(16, Math.round(canvasWidth / 55));
  context.font = `700 ${fontSize}px system-ui, sans-serif`;
  context.lineWidth = Math.max(3, canvasWidth / 300);
  context.strokeStyle = color;
  context.strokeRect(x, y, width, height);

  const padding = Math.round(fontSize * 0.45);
  const labelWidth = context.measureText(label).width + padding * 2;
  const labelHeight = fontSize + padding * 1.4;
  const labelY = Math.max(0, y - labelHeight);
  context.fillStyle = color;
  context.fillRect(x, labelY, Math.min(labelWidth, canvasWidth - x), labelHeight);
  context.fillStyle = "#071426";
  context.fillText(label, x + padding, labelY + fontSize + padding * 0.25);
}

export function renderCanvas(canvas, source, detections = []) {
  const { width, height } = getIntrinsicSize(source);
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  context.drawImage(source, 0, 0, width, height);
  detections.forEach((detection) => drawDetection(context, detection, width));
}

export function renderOverlay(canvas, source, detections = []) {
  const { width, height } = getIntrinsicSize(source);
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, width, height);
  detections.forEach((detection) => drawDetection(context, detection, width));
}

export function clearCanvas(canvas) {
  canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
  canvas.width = 0;
  canvas.height = 0;
}
