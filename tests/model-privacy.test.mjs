import test from "node:test";
import assert from "node:assert/strict";
import { createModelService } from "../src/services/model-service.js";

test("removes person predictions before returning detections", async () => {
  globalThis.window = {
    cocoSsd: {
      load: async () => ({
        detect: async () => [
          { class: "person", score: 0.99, bbox: [1, 2, 3, 4] },
          { class: "chair", score: 0.91, bbox: [5, 6, 7, 8] },
          { class: "laptop", score: 0.2, bbox: [9, 10, 11, 12] }
        ]
      })
    }
  };
  const service = createModelService();
  await service.load();
  const detections = await service.detect({}, 0.6);
  assert.deepEqual(detections, [{ className: "chair", score: 0.91, bbox: [5, 6, 7, 8] }]);
  assert.equal(detections.some((item) => item.className === "person"), false);
});
