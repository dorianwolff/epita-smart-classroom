import test from "node:test";
import assert from "node:assert/strict";
import { orderCornersClockwise, orientedBoxFromMask, transformPoints } from "../src/detection/shape-geometry.js";
import { normalizePrediction } from "../src/detection/prediction-normalizer.js";

test("corner ordering is deterministic and rejects degenerate input", () => {
  const corners = orderCornersClockwise([{ x: 10, y: 10 }, { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }]);
  assert.equal(corners.length, 4);
  assert.deepEqual(new Set(corners.map((point) => `${point.x}:${point.y}`)).size, 4);
  assert.equal(orderCornersClockwise([{ x: 0, y: 0 }]), null);
});

test("PCA produces a real oriented rectangle from mask pixels", () => {
  const width = 9;
  const height = 9;
  const data = new Uint8Array(width * height);
  for (let y = 1; y < 8; y += 1) {
    for (let x = 1; x < 8; x += 1) if (Math.abs(x - y) <= 1) data[y * width + x] = 1;
  }
  const box = orientedBoxFromMask({ width, height, data, scaleX: 2, scaleY: 2 });
  assert.equal(box.corners.length, 4);
  assert.ok(Math.abs(Math.abs(box.angle) - Math.PI / 4) < 0.15);
  assert.ok(box.width > box.height);
});

test("shape transforms handle scaling and mirrored previews", () => {
  assert.deepEqual(transformPoints([{ x: 2, y: 3 }], { scaleX: 2, scaleY: 4 }), [{ x: 4, y: 12 }]);
  assert.deepEqual(transformPoints([{ x: 2, y: 3 }], { scaleX: 2, scaleY: 4, mirrorX: true, width: 20 }), [{ x: 16, y: 12 }]);
});

test("the normalized contract represents supported and unsupported geometry honestly", () => {
  const mask = { width: 2, height: 2, data: new Uint8Array([0, 1, 1, 0]) };
  const result = normalizePrediction({
    prediction: { label: "chair", score: 0.8, mask }, index: 0,
    sourceId: "source", sourceVersion: 2, requestId: 9, modelId: "mask-detector", experimental: true
  });
  assert.equal(result.box, null);
  assert.equal(result.orientedBox, null);
  assert.equal(result.polygon, null);
  assert.equal(result.mask, mask);
  assert.equal(result.metadata.geometry, "mask");
  assert.equal(result.detectorId, "mask-detector");
});
