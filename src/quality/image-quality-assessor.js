import { getIntrinsicSize } from "../services/source-resolution.js";

const SAMPLE_MAXIMUM = 192;

export function calculateImageQualityMetrics(data, width, height, source = {}) {
  if (!data?.length || width < 2 || height < 2) return null;
  const luminance = new Float32Array(width * height);
  let sum = 0;
  let dark = 0;
  let bright = 0;
  for (let index = 0; index < luminance.length; index += 1) {
    const offset = index * 4;
    const value = 0.2126 * data[offset] + 0.7152 * data[offset + 1] + 0.0722 * data[offset + 2];
    luminance[index] = value;
    sum += value;
    if (value < 30) dark += 1;
    if (value > 225) bright += 1;
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
    meanLuminance: Math.round(meanLuminance),
    contrast: Math.round(Math.sqrt(variance / luminance.length)),
    darkFraction: dark / luminance.length,
    brightFraction: bright / luminance.length,
    edgeStrength: gradient / gradientCount
  });
}

export function interpretImageQuality(metrics) {
  if (!metrics) return Object.freeze({ status: "indisponible", guidance: ["Qualité non mesurable."] });
  const guidance = [];
  if (metrics.width < 640 || metrics.height < 480) guidance.push("Résolution faible : rapprochez-vous des équipements.");
  if (metrics.darkFraction > 0.35 || metrics.meanLuminance < 55) guidance.push("Image sombre : augmentez l’éclairage sans utiliser un contre-jour.");
  if (metrics.brightFraction > 0.35 || metrics.meanLuminance > 205) guidance.push("Image très claire : évitez les fenêtres ou lampes face à l’objectif.");
  if (metrics.contrast < 22) guidance.push("Contraste faible : améliorez l’éclairage ou changez légèrement d’angle.");
  if (metrics.edgeStrength < 5) guidance.push("Netteté possiblement faible : stabilisez l’appareil et reprenez la photo.");
  return Object.freeze({
    status: guidance.length ? "à améliorer" : "exploitable",
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
