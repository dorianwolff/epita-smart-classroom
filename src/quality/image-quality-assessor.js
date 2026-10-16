import { getIntrinsicSize } from "../services/source-resolution.js";

const SAMPLE_MAXIMUM = 192;
const HISTOGRAM_BINS = 256;

function linearizeSrgb(channel) {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function percentile(histogram, count, ratio) {
  const target = Math.max(0, Math.ceil(count * ratio));
  let seen = 0;
  for (let index = 0; index < histogram.length; index += 1) {
    seen += histogram[index];
    if (seen >= target) return index / 255;
  }
  return 1;
}

export function calculateImageQualityMetrics(data, width, height, source = {}) {
  if (!data?.length || width < 2 || height < 2) return null;
  const luminance = new Float32Array(width * height);
  let sum = 0;
  let dark = 0;
  let bright = 0;
  const histogram = new Uint32Array(HISTOGRAM_BINS);
  for (let index = 0; index < luminance.length; index += 1) {
    const offset = index * 4;
    const value = 0.2126 * linearizeSrgb(data[offset]) +
      0.7152 * linearizeSrgb(data[offset + 1]) + 0.0722 * linearizeSrgb(data[offset + 2]);
    luminance[index] = value;
    sum += value;
    const bin = Math.min(255, Math.round(value * 255));
    histogram[bin] += 1;
    if (value < 0.025) dark += 1;
    if (value > 0.9) bright += 1;
  }
  const meanLuminance = sum / luminance.length;
  let variance = 0;
  let gradient = 0;
  let gradientCount = 0;
  luminance.forEach((value) => { variance += (value - meanLuminance) ** 2; });
  for (let y = 0; y < height - 1; y += 1) {
    for (let x = 0; x < width - 1; x += 1) {
      const index = y * width + x;
      gradient += Math.abs(luminance[index] - luminance[index + 1]);
      gradient += Math.abs(luminance[index] - luminance[index + width]);
      gradientCount += 2;
    }
  }
  return Object.freeze({
    width: Number(source.width ?? width),
    height: Number(source.height ?? height),
    originalWidth: Number(source.originalWidth ?? source.width ?? width),
    originalHeight: Number(source.originalHeight ?? source.height ?? height),
    downscaled: Boolean(source.downscaled),
    meanLuminance: Number(meanLuminance.toFixed(4)),
    medianLuminance: Number(percentile(histogram, luminance.length, 0.5).toFixed(4)),
    percentile10: Number(percentile(histogram, luminance.length, 0.1).toFixed(4)),
    percentile90: Number(percentile(histogram, luminance.length, 0.9).toFixed(4)),
    contrast: Number((percentile(histogram, luminance.length, 0.9) - percentile(histogram, luminance.length, 0.1)).toFixed(4)),
    darkFraction: dark / luminance.length,
    brightFraction: bright / luminance.length,
    edgeStrength: gradient / gradientCount,
    histogram: Object.freeze(Array.from(histogram))
  });
}

export function interpretImageQuality(metrics, history = []) {
  if (!metrics) return Object.freeze({ status: "indisponible", guidance: ["Qualité non mesurable."] });
  const guidance = [];
  if (metrics.width < 640 || metrics.height < 480) guidance.push("Résolution faible : rapprochez-vous des équipements.");
  if (metrics.darkFraction > 0.42 || metrics.meanLuminance < 0.055) guidance.push("Image sombre : ajoutez de la lumière ou rapprochez-vous.");
  if (metrics.brightFraction > 0.25 || metrics.meanLuminance > 0.72) guidance.push("Image très claire : inclinez légèrement le téléphone pour réduire les reflets.");
  const probableBacklight = metrics.brightFraction > 0.08 && metrics.darkFraction > 0.28;
  if (probableBacklight) guidance.push("Contre-jour probable : évitez de filmer directement vers la fenêtre.");
  if (metrics.contrast < 0.12) guidance.push("Contraste insuffisant : améliorez l’éclairage ou changez légèrement d’angle.");
  if (metrics.edgeStrength < 0.018) guidance.push("Netteté possiblement faible : maintenez l’appareil immobile.");
  const recentMeans = [...history.slice(-3).map((item) => item.meanLuminance), metrics.meanLuminance];
  const exposureInstability = recentMeans.length >= 3 && Math.max(...recentMeans) - Math.min(...recentMeans) > 0.18;
  if (exposureInstability) guidance.push("Image instable : attendez que l’exposition se stabilise.");
  let state = "Éclairage correct";
  if (metrics.darkFraction > 0.42 || metrics.meanLuminance < 0.055) state = "Trop sombre";
  else if (metrics.meanLuminance < 0.11) state = "Éclairage faible";
  else if (metrics.brightFraction > 0.25 || metrics.meanLuminance > 0.72) state = "Trop lumineux";
  else if (probableBacklight) state = "Contre-jour probable";
  else if (metrics.contrast < 0.12) state = "Contraste insuffisant";
  else if (metrics.edgeStrength < 0.018 || exposureInstability) state = "Image instable";
  return Object.freeze({
    status: guidance.length ? "à améliorer" : "exploitable",
    state,
    probableBacklight,
    exposureInstability,
    guidance: Object.freeze(guidance.length ? guidance : ["Qualité compatible avec l’analyse, sous réserve du cadrage."])
  });
}

export function assessImageQuality(asset, source = {}) {
  const intrinsic = getIntrinsicSize(asset);
  const scale = Math.min(1, SAMPLE_MAXIMUM / Math.max(intrinsic.width, intrinsic.height));
  const width = Math.max(2, Math.round(intrinsic.width * scale));
  const height = Math.max(2, Math.round(intrinsic.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
  context.drawImage(asset, 0, 0, width, height);
  const metrics = calculateImageQualityMetrics(context.getImageData(0, 0, width, height).data, width, height, source);
  return Object.freeze({ metrics, ...interpretImageQuality(metrics), preprocessing: "original" });
}
