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
  assert.deepEqual(detections, [
    { className: "chair", score: 0.91, bbox: [5, 6, 7, 8] },
    { className: "book", score: 0.82, bbox: [3, 4, 5, 6] }
  ]);
  assert.equal(detections.some((item) => item.className === "person"), false);
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
