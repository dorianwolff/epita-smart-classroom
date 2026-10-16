import test from "node:test";
import assert from "node:assert/strict";
import { calculateImageQualityMetrics, interpretImageQuality } from "../src/quality/image-quality-assessor.js";

function pixels(width, height, valueAt) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    const value = valueAt(index);
    data.set([value, value, value, 255], index * 4);
  }
  return data;
}

test("quality metrics report dimensions, downscaling, exposure and contrast", () => {
  const metrics = calculateImageQualityMetrics(pixels(4, 4, (index) => index % 2 ? 255 : 0), 4, 4,
    { width: 800, height: 600, originalWidth: 1600, originalHeight: 1200, downscaled: true });
  assert.equal(metrics.width, 800);
  assert.equal(metrics.originalWidth, 1600);
  assert.equal(metrics.downscaled, true);
  assert.equal(metrics.darkFraction, 0.5);
  assert.equal(metrics.brightFraction, 0.5);
  assert.equal(metrics.medianLuminance, 0);
  assert.ok(metrics.contrast > 0.9);
  assert.equal(metrics.histogram.length, 256);
});

test("flat dark frames receive conservative capture guidance", () => {
  const metrics = calculateImageQualityMetrics(pixels(8, 8, () => 10), 8, 8, { width: 320, height: 240 });
  const quality = interpretImageQuality(metrics);
  assert.equal(quality.status, "à améliorer");
  assert.ok(quality.guidance.some((item) => item.includes("sombre")));
  assert.ok(quality.guidance.some((item) => item.includes("Netteté")));
});

test("linear sRGB luminance follows BT.709 rather than encoded-channel averaging", () => {
  const data = new Uint8ClampedArray([255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255]);
  const metrics = calculateImageQualityMetrics(data, 2, 2, {});
  assert.ok(Math.abs(metrics.meanLuminance - 0.2126) < 0.001);
});

test("bright clipping is separated from ordinary correct exposure", () => {
  const bright = calculateImageQualityMetrics(pixels(8, 8, () => 255), 8, 8, {});
  assert.equal(interpretImageQuality(bright).state, "Trop lumineux");
  assert.equal(bright.brightFraction, 1);
});

test("mixed highlights and shadows produce a probable backlight warning", () => {
  const metrics = calculateImageQualityMetrics(pixels(10, 10, (index) => index < 35 ? 0 : index < 50 ? 255 : 100), 10, 10, {});
  const quality = interpretImageQuality(metrics);
  assert.equal(quality.probableBacklight, true);
  assert.ok(quality.guidance.some((item) => item.includes("Contre-jour")));
});

test("exposure history identifies sudden instability", () => {
  const low = calculateImageQualityMetrics(pixels(8, 8, () => 80), 8, 8, {});
  const high = calculateImageQualityMetrics(pixels(8, 8, () => 220), 8, 8, {});
  const quality = interpretImageQuality(high, [low, low]);
  assert.equal(quality.exposureInstability, true);
  assert.ok(quality.guidance.some((item) => item.includes("stabilise")));
});
