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
  assert.ok(metrics.contrast > 100);
});

test("flat dark frames receive conservative capture guidance", () => {
  const metrics = calculateImageQualityMetrics(pixels(8, 8, () => 10), 8, 8, { width: 320, height: 240 });
  const quality = interpretImageQuality(metrics);
  assert.equal(quality.status, "à améliorer");
  assert.ok(quality.guidance.some((item) => item.includes("sombre")));
  assert.ok(quality.guidance.some((item) => item.includes("Netteté")));
});
