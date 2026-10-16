import test from "node:test";
import assert from "node:assert/strict";
import { createModelService } from "../src/services/model-service.js";

test("removes person predictions before returning detections", async () => {
  let detectionArguments = null;
  globalThis.window = {
    cocoSsd: {
      load: async () => ({
        detect: async (...args) => {
          detectionArguments = args;
          return [
            { class: "person", score: 0.99, bbox: [1, 2, 3, 4] },
            { class: "chair", score: 0.91, bbox: [5, 6, 7, 8] },
            { class: "book", score: 0.82, bbox: [3, 4, 5, 6] },
            { class: "laptop", score: 0.2, bbox: [9, 10, 11, 12] }
          ];
        }
      })
    }
  };
  const service = createModelService();
  await service.load();
  const detections = await service.detect({}, 0.6);
  assert.equal(detections.length, 2);
  assert.deepEqual(detections.map(({ rawLabel, score, box }) => ({ rawLabel, score, box })), [
    { rawLabel: "chair", score: 0.91, box: { x: 5, y: 6, width: 7, height: 8 } },
    { rawLabel: "book", score: 0.82, box: { x: 3, y: 4, width: 5, height: 6 } }
  ]);
  assert.ok(detections.every((item) => item.detectorId === "coco-ssd-mobilenet-v2"));
  assert.ok(detections.every((item) => item.mask === null && item.orientedBox === null && item.polygon === null));
  assert.equal(detections.some((item) => item.rawLabel === "person"), false);
  assert.equal(detectionArguments[1], 100);
  assert.equal(detectionArguments[2], 0.6);
});

test("loads the accuracy-focused model and can recover after a load failure", async () => {
  let attempts = 0;
  const loadConfigurations = [];
  globalThis.window = {
    cocoSsd: {
      load: async (configuration) => {
        loadConfigurations.push(configuration);
        attempts += 1;
        if (attempts === 1) throw new Error("temporary failure");
        return { detect: async () => [] };
      }
    }
  };
  const originalError = console.error;
  console.error = () => {};
  try {
    const service = createModelService();
    await assert.rejects(service.load(), (error) => error.code === "MODEL_LOAD");
    await service.load();
  } finally {
    console.error = originalError;
  }
  assert.equal(attempts, 2);
  assert.deepEqual(loadConfigurations, [
    { base: "mobilenet_v2" },
    { base: "mobilenet_v2" }
  ]);
});

test("all defensive person labels are removed at the detector boundary", async () => {
  const privateLabels = ["person", "human", "student", "teacher", "face", "man", "woman", "boy", "girl"];
  const detector = {
    load: async () => {},
    detect: async () => [
      ...privateLabels.map((rawLabel, index) => ({ rawLabel, id: String(index), mask: { width: 1, height: 1, data: [1] } })),
      { rawLabel: "chair", id: "safe" }
    ],
    dispose() {},
    getMetadata: () => ({ id: "coco-ssd-mobilenet-v2" })
  };
  const service = createModelService({ detector });
  const detections = await service.detect({}, { threshold: 0, sourceId: "source" });
  assert.deepEqual(detections, [{ rawLabel: "chair", id: "safe" }]);
});
