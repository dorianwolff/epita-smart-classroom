import test from "node:test";
import assert from "node:assert/strict";
import { EPITA_EXAMPLE_EXPECTED } from "../src/config/categories.js";
import { ANALYSIS_STATUS, AUDIT_MODE, INPUT_MODE, MODEL_STATUS } from "../src/config/defaults.js";
import { createAnalysisCoordinator, createThresholdReanalysis } from "../src/services/analysis-coordinator.js";
import { createStore } from "../src/state/store.js";
import { renderAnalysisStatus } from "../src/ui/application-view.js";

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
      return [{ rawLabel: "chair", score: 0.9, bbox: { x: 0, y: 0, width: 1, height: 1 } }];
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

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test("a selected source receives immutable identity and request metadata", () => {
  const { store, coordinator } = createHarness();
  coordinator.setSource({ width: 20, height: 10 }, INPUT_MODE.UPLOAD);
  const source = coordinator.getSource();
  assert.equal(typeof source.sourceId, "string");
  assert.equal(source.sourceVersion, 1);
  assert.equal(source.type, INPUT_MODE.UPLOAD);
  assert.deepEqual(store.getState().currentSource, {
    sourceId: source.sourceId,
    sourceVersion: 1,
    type: INPUT_MODE.UPLOAD,
    width: 20,
    height: 10,
    createdAt: source.createdAt,
    status: "ready"
  });
  assert.equal(typeof store.getState().currentAnalysis.requestId, "number");
  assert.ok(Object.isFrozen(source));
});

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
  assert.equal(coordinator.getSource().asset, "retained-photo");
});

test("a queued photo announces automatic analysis while the model loads", () => {
  const element = { textContent: "" };
  renderAnalysisStatus(element, {
    cameraStatus: "idle",
    analysisStatus: ANALYSIS_STATUS.QUEUED,
    modelStatus: MODEL_STATUS.LOADING,
    hasVisualSource: true
  });
  assert.equal(element.textContent, "Image prête. Modèle en cours de chargement.");
});

test("threshold changes trigger one controlled reanalysis after debouncing", async () => {
  let retries = 0;
  const reanalysis = createThresholdReanalysis(() => { retries += 1; }, 10);
  reanalysis.schedule();
  reanalysis.schedule();
  reanalysis.schedule();
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(retries, 1);
});
