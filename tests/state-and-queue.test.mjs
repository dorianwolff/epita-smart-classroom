import test from "node:test";
import assert from "node:assert/strict";
import { EPITA_EXAMPLE_EXPECTED } from "../src/config/categories.js";
import { ANALYSIS_STATUS, AUDIT_MODE, INPUT_MODE, MODEL_STATUS } from "../src/config/defaults.js";
import { createAnalysisCoordinator } from "../src/services/analysis-coordinator.js";
import { createStore } from "../src/state/store.js";

function installStorage() {
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value)
  };
}

function createHarness() {
  installStorage();
  const store = createStore();
  const calls = [];
  const modelService = {
    async detect(source) {
      calls.push(source);
      return [{ className: "chair", score: 0.9, bbox: [0, 0, 1, 1] }];
    }
  };
  const coordinator = createAnalysisCoordinator({
    store,
    modelService,
    onComplete: () => {},
    onError: (error) => { throw error; }
  });
  return { store, calls, coordinator };
}

test("EPITA example is explicit and the default mode is free", () => {
  installStorage();
  const store = createStore();
  assert.equal(store.getState().auditMode, AUDIT_MODE.FREE);
  assert.ok(Object.values(store.getState().expectedConfiguration).every((value) => value === null));
  store.loadExampleConfiguration();
  assert.deepEqual(store.getState().expectedConfiguration, { ...EPITA_EXAMPLE_EXPECTED });
  assert.equal(store.getState().configurationSource, "example");
  store.resetConfiguration();
  assert.ok(Object.values(store.getState().expectedConfiguration).every((value) => value === null));
});

test("a photo queued while loading is analysed exactly once after readiness", async () => {
  const { store, calls, coordinator } = createHarness();
  coordinator.setSource("camera-frame", INPUT_MODE.CAMERA);
  assert.equal(store.getState().analysisStatus, ANALYSIS_STATUS.QUEUED);
  assert.equal(store.getState().inputMode, INPUT_MODE.CAMERA);
  assert.equal(calls.length, 0);
  store.setModelStatus(MODEL_STATUS.READY);
  await Promise.all([coordinator.processQueue(), coordinator.processQueue()]);
  assert.deepEqual(calls, ["camera-frame"]);
  assert.equal(store.getState().analysisStatus, ANALYSIS_STATUS.COMPLETE);
});

test("replacing a queued photo analyses only the newest source", async () => {
  const { store, calls, coordinator } = createHarness();
  coordinator.setSource("old-photo", INPUT_MODE.UPLOAD);
  coordinator.setSource("new-photo", INPUT_MODE.UPLOAD);
  store.setModelStatus(MODEL_STATUS.READY);
  await coordinator.processQueue();
  assert.deepEqual(calls, ["new-photo"]);
});

test("reset removes queued analysis", async () => {
  const { store, calls, coordinator } = createHarness();
  coordinator.setSource("discarded-photo", INPUT_MODE.UPLOAD);
  coordinator.reset();
  store.setModelStatus(MODEL_STATUS.READY);
  await coordinator.processQueue();
  assert.equal(calls.length, 0);
  assert.equal(store.getState().hasVisualSource, false);
  assert.equal(store.getState().analysisStatus, ANALYSIS_STATUS.IDLE);
});

test("model failure retains the local preview and queued state", () => {
  const { store, coordinator } = createHarness();
  coordinator.setSource("retained-photo", INPUT_MODE.UPLOAD);
  store.setModelStatus(MODEL_STATUS.ERROR);
  assert.equal(store.getState().hasVisualSource, true);
  assert.equal(store.getState().analysisStatus, ANALYSIS_STATUS.QUEUED);
  assert.equal(coordinator.getSource(), "retained-photo");
});
