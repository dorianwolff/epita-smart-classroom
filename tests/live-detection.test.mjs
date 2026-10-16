import test from "node:test";
import assert from "node:assert/strict";
import { createLiveInferenceQueue } from "../src/live/live-inference-queue.js";
import { createBoxTracker, intersectionOverUnion } from "../src/live/box-tracker.js";
import { createAdaptiveSampler } from "../src/live/adaptive-sampler.js";
import { containTransform, transformBox } from "../src/live/overlay-transform.js";

function deferred() { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; }
const tick = async () => { await Promise.resolve(); await Promise.resolve(); };

test("live inference keeps one active frame and only the newest pending frame", async () => {
  const controls = new Map(); const accepted = []; const released = [];
  const queue = createLiveInferenceQueue({ run: (frame) => { const control = deferred(); controls.set(frame.frameId, control); return control.promise; },
    accept: (result) => accepted.push(result.frameId), release: (resource) => released.push(resource) });
  queue.start("session-a");
  queue.enqueue({ cameraSessionId: "session-a", frameId: 1, resource: "one" });
  queue.enqueue({ cameraSessionId: "session-a", frameId: 2, resource: "two" });
  queue.enqueue({ cameraSessionId: "session-a", frameId: 3, resource: "three" });
  assert.deepEqual(queue.getState(), { sessionId: "session-a", activeFrameId: 1, pendingFrameId: 3, stopped: false });
  assert.deepEqual(released, ["two"]);
  controls.get(1).resolve({ cameraSessionId: "session-a", frameId: 1 }); await tick();
  assert.equal(queue.getState().activeFrameId, 3);
  controls.get(3).resolve({ cameraSessionId: "session-a", frameId: 3 }); await tick();
  assert.deepEqual(accepted, [1, 3]);
  assert.deepEqual(released, ["two", "one", "three"]);
});

test("stale live-session results never reach the overlay", async () => {
  const control = deferred(); const accepted = [];
  const queue = createLiveInferenceQueue({ run: () => control.promise, accept: (result) => accepted.push(result), release: () => {} });
  queue.start("old"); queue.enqueue({ cameraSessionId: "old", frameId: 1 }); queue.start("new");
  control.resolve({ cameraSessionId: "old", frameId: 1 }); await tick();
  assert.deepEqual(accepted, []);
});

test("stopping a live session releases its pending resource", () => {
  const released = [];
  const queue = createLiveInferenceQueue({ run: () => new Promise(() => {}), accept: () => {}, release: (value) => released.push(value) });
  queue.start("s"); queue.enqueue({ cameraSessionId: "s", frameId: 1, resource: "active" });
  queue.enqueue({ cameraSessionId: "s", frameId: 2, resource: "pending" }); queue.stop();
  assert.deepEqual(released, ["pending"]);
  assert.equal(queue.getState().stopped, true);
});

test("box IoU and EMA tracking are label-aware", () => {
  assert.equal(intersectionOverUnion({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5, width: 10, height: 10 }).toFixed(3), "0.143");
  const tracker = createBoxTracker({ alpha: 0.5, minimumIoU: 0.2, missedTolerance: 1 });
  const first = tracker.update([{ rawLabel: "chair", score: 0.8, box: { x: 0, y: 0, width: 10, height: 10 } }])[0];
  const second = tracker.update([{ rawLabel: "chair", score: 1, box: { x: 2, y: 0, width: 10, height: 10 } }])[0];
  assert.equal(second.trackId, first.trackId); assert.equal(second.box.x, 1); assert.equal(second.score, 0.9);
  const different = tracker.update([{ rawLabel: "laptop", score: 0.9, box: { x: 2, y: 0, width: 10, height: 10 } }]);
  assert.notEqual(different.find((item) => item.rawLabel === "laptop").trackId, first.trackId);
});

test("tracks expire after the configured missed-frame tolerance", () => {
  const tracker = createBoxTracker({ missedTolerance: 1 });
  tracker.update([{ rawLabel: "chair", score: 0.8, box: { x: 0, y: 0, width: 10, height: 10 } }]);
  assert.equal(tracker.update([]).length, 1); assert.equal(tracker.update([]).length, 0);
});

test("adaptive sampling backs off and reduces repeated slow frames", () => {
  const sampler = createAdaptiveSampler({ minimumInterval: 500, slowDuration: 1000, initialSize: 576, reducedSize: 448 });
  assert.deepEqual(sampler.record(300), { interval: 500, longestSide: 576, reduced: false });
  sampler.record(1200); const reduced = sampler.record(1300);
  assert.equal(reduced.longestSide, 448); assert.equal(reduced.interval, 1495); assert.equal(reduced.reduced, true);
});

test("contain overlay transform preserves letterboxing and mirroring", () => {
  const transform = containTransform(1920, 1080, 390, 844);
  assert.equal(Math.round(transform.offsetY), 312);
  const box = transformBox({ x: 0, y: 0, width: 192, height: 108 }, transform);
  assert.equal(Math.round(box.width), 39); assert.equal(Math.round(box.y), 312);
  const mirrored = transformBox({ x: 0, y: 0, width: 192, height: 108 }, { ...transform, mirrored: true });
  assert.equal(Math.round(mirrored.x + mirrored.width), 390);
});
