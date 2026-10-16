import { CATEGORY_BY_CLASS } from "../config/categories.js";
import { getCocoLabel } from "../config/coco-labels.js";
import { DEFAULTS } from "../config/defaults.js";
import { getIntrinsicSize } from "../services/source-resolution.js";
import { formatPercent } from "../utils/formatting.js";

function getLabel(detection) {
  const modelId = detection.detectorId ?? detection.modelId;
  const modelLabel = modelId === DEFAULTS.model.id ? "COCO-SSD" : modelId;
  return `${detection.displayLabel ?? getCocoLabel(detection.rawLabel)} · ${formatPercent(detection.score)} · ${modelLabel}`;
}

function tracePoints(context, points) {
  if (!points?.length) return false;
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
  context.closePath();
  return true;
}

function drawMask(context, mask, color) {
  if (!mask?.data || !Number.isInteger(mask.width) || !Number.isInteger(mask.height)) return false;
  const surface = typeof OffscreenCanvas === "function"
    ? new OffscreenCanvas(mask.width, mask.height)
    : document.createElement("canvas");
  surface.width = mask.width;
  surface.height = mask.height;
  const maskContext = surface.getContext("2d");
  const pixels = maskContext.createImageData(mask.width, mask.height);
  const rgb = color.match(/[a-f\d]{2}/gi)?.map((value) => parseInt(value, 16)) ?? [32, 199, 181];
  for (let index = 0; index < mask.data.length; index += 1) {
    if (Number(mask.data[index]) <= 0) continue;
    pixels.data[index * 4] = rgb[0];
    pixels.data[index * 4 + 1] = rgb[1];
    pixels.data[index * 4 + 2] = rgb[2];
    pixels.data[index * 4 + 3] = 72;
  }
  maskContext.putImageData(pixels, 0, 0);
  context.drawImage(surface, Number(mask.originX ?? 0), Number(mask.originY ?? 0),
    mask.width * Number(mask.scaleX ?? 1), mask.height * Number(mask.scaleY ?? 1));
  return true;
}

function geometryBounds(detection) {
  if (detection.box ?? detection.bbox) return detection.box ?? detection.bbox;
  const points = detection.polygon ?? detection.orientedBox?.corners;
  if (points?.length) {
    const xs = points.map(({ x }) => x);
    const ys = points.map(({ y }) => y);
    return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
  }
  if (detection.mask) return {
    x: Number(detection.mask.originX ?? 0),
    y: Number(detection.mask.originY ?? 0),
    width: detection.mask.width * Number(detection.mask.scaleX ?? 1),
    height: detection.mask.height * Number(detection.mask.scaleY ?? 1)
  };
  return null;
}

function drawDetection(context, detection, canvasWidth) {
  const box = geometryBounds(detection);
  if (!box) return;
  const { x, y, width, height } = box;
  const color = CATEGORY_BY_CLASS.get(detection.rawLabel)?.color ?? "#20c7b5";
  const label = getLabel(detection);
  const fontSize = Math.max(16, Math.round(canvasWidth / 55));
  context.font = `700 ${fontSize}px system-ui, sans-serif`;
  context.lineWidth = Math.max(3, canvasWidth / 300);
  context.strokeStyle = color;
  const hasMask = drawMask(context, detection.mask, color);
  const outline = detection.polygon ?? detection.orientedBox?.corners;
  if (tracePoints(context, outline)) {
    context.fillStyle = `${color}24`;
    context.fill();
    context.stroke();
  } else if (!hasMask) context.strokeRect(x, y, width, height);

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
