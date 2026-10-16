import test from "node:test";
import assert from "node:assert/strict";
import { INPUT_MODE, MODEL_STATUS } from "../src/config/defaults.js";
import { createAnalysisCoordinator } from "../src/services/analysis-coordinator.js";
import { createStore } from "../src/state/store.js";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function installStorage() {
  globalThis.localStorage = { getItem: () => null, setItem: () => {} };
}

const prediction = (sourceId, modelId, rawLabel = "chair") => ({
  id: `${sourceId}:${modelId}:0`, sourceId, modelId, rawLabel,
  categoryId: rawLabel === "chair" ? "chairs" : null,
  displayLabel: rawLabel, score: 0.9,
  bbox: { x: 0, y: 0, width: 1, height: 1 }, experimental: false
});

function createHarness() {
  installStorage();
  const store = createStore();
  store.setModelStatus(MODEL_STATUS.READY);
  const calls = [];
  const controls = new Map();
  const completions = [];
  const errors = [];
  let detectorId = "detector-a";
  const modelService = {
    detect(source, options) {
      const control = deferred();
      calls.push({ name: source.name, ...options, detectorId });
      controls.set(`${source.name}:${calls.length}`, control);
      return control.promise;
    },
    getDetectorId: () => detectorId,
    getMetadata: () => ({ id: detectorId, label: detectorId, backend: "fake" })
  };
  const coordinator = createAnalysisCoordinator({
    store,
    modelService,
    onComplete: (result) => completions.push(result),
    onError: (error) => errors.push(error)
  });
  const source = (name) => ({ name, width: 10, height: 10 });
  return {
    store, calls, controls, completions, errors, coordinator, source,
    setDetectorId: (value) => { detectorId = value; }
  };
}

async function finish(control, detections = []) {
  control.resolve(detections);
  await control.promise;
  await Promise.resolve();
  await Promise.resolve();
}

test("A finishing after B is selected cannot commit over B", async () => {
  const h = createHarness();
  const a = h.coordinator.setSource(h.source("A"), INPUT_MODE.UPLOAD);
  const aControl = h.controls.get("A:1");
  const b = h.coordinator.setSource(h.source("B"), INPUT_MODE.UPLOAD);
  assert.equal(h.store.getState().analysisNotice, "new-source");
  await finish(aControl, [prediction(a.sourceId, "detector-a")]);
  assert.deepEqual(h.completions, []);
  assert.equal(h.calls[1].name, "B");
  const bControl = h.controls.get("B:2");
  await finish(bControl, [prediction(b.sourceId, "detector-a")]);
  assert.equal(h.completions.length, 1);
  assert.equal(h.store.getState().detections[0].sourceId, b.sourceId);
});

test("A then B then C runs only A and C", async () => {
  const h = createHarness();
  h.coordinator.setSource(h.source("A"), INPUT_MODE.UPLOAD);
  const aControl = h.controls.get("A:1");
  h.coordinator.setSource(h.source("B"), INPUT_MODE.UPLOAD);
  const c = h.coordinator.setSource(h.source("C"), INPUT_MODE.UPLOAD);
  await finish(aControl);
  assert.deepEqual(h.calls.map(({ name }) => name), ["A", "C"]);
  await finish(h.controls.get("C:2"), [prediction(c.sourceId, "detector-a")]);
  assert.equal(h.store.getState().currentSource.sourceId, c.sourceId);
});

test("a stale A error cannot replace B status", async () => {
  const h = createHarness();
  h.coordinator.setSource(h.source("A"), INPUT_MODE.UPLOAD);
  const aControl = h.controls.get("A:1");
  h.coordinator.setSource(h.source("B"), INPUT_MODE.UPLOAD);
  aControl.reject(new Error("A failed"));
  await assert.rejects(aControl.promise);
  await Promise.resolve();
  assert.deepEqual(h.errors, []);
  assert.notEqual(h.store.getState().analysisNotice, "analysis-failed");
});

test("two threshold changes during inference commit only the newest threshold", async () => {
  const h = createHarness();
  h.coordinator.setSource(h.source("A"), INPUT_MODE.UPLOAD);
  const first = h.controls.get("A:1");
  h.store.setThreshold(0.3);
  h.coordinator.retry();
  h.store.setThreshold(0.55);
  h.coordinator.retry();
  await finish(first);
  assert.deepEqual(h.calls.map(({ threshold }) => threshold), [0.3, 0.55]);
  const latest = h.controls.get("A:2");
  const current = h.coordinator.getSource();
  await finish(latest, [prediction(current.sourceId, "detector-a")]);
  assert.equal(h.store.getState().auditMetadata.confidenceThreshold, 0.55);
});

test("changing detector during inference discards the old detector result", async () => {
  const h = createHarness();
  const source = h.coordinator.setSource(h.source("A"), INPUT_MODE.UPLOAD);
  const old = h.controls.get("A:1");
  h.setDetectorId("detector-b");
  h.coordinator.retry();
  await finish(old, [prediction(source.sourceId, "detector-a")]);
  assert.equal(h.calls[1].detectorId, "detector-b");
  const current = h.controls.get("A:2");
  await finish(current, [prediction(source.sourceId, "detector-b")]);
  assert.equal(h.store.getState().auditMetadata.modelId, "detector-b");
});

test("reset during inference prevents every late state write", async () => {
  const h = createHarness();
  const source = h.coordinator.setSource(h.source("A"), INPUT_MODE.UPLOAD);
  const active = h.controls.get("A:1");
  h.coordinator.reset();
  await finish(active, [prediction(source.sourceId, "detector-a")]);
  assert.equal(h.store.getState().hasVisualSource, false);
  assert.deepEqual(h.store.getState().detections, []);
  assert.equal(h.store.getState().auditMetadata, null);
  assert.deepEqual(h.completions, []);
});
