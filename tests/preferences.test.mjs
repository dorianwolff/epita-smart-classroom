import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULTS } from "../src/config/defaults.js";
import { loadPreferences, savePreferences } from "../src/state/preferences.js";

function storage(entries = {}) {
  const values = new Map(Object.entries(entries));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    values
  };
}

test("new installations use the new 30 percent visual and sound defaults", () => {
  const preferences = loadPreferences(storage());
  assert.equal(preferences.confidenceThreshold, 0.3);
  assert.equal(preferences.soundConfidenceThreshold, 0.3);
});

test("v2 untouched 40 percent migrates while a deliberate valid value is preserved", () => {
  const legacyKey = DEFAULTS.storageKeys.legacyPreferences;
  assert.equal(loadPreferences(storage({ [legacyKey]: JSON.stringify({ confidenceThreshold: 0.4 }) })).confidenceThreshold, 0.3);
  assert.equal(loadPreferences(storage({ [legacyKey]: JSON.stringify({ confidenceThreshold: 0.55 }) })).confidenceThreshold, 0.55);
});

test("legacy and current thresholds are clamped into the supported interval", () => {
  const legacyKey = DEFAULTS.storageKeys.legacyPreferences;
  const currentKey = DEFAULTS.storageKeys.preferences;
  assert.equal(loadPreferences(storage({ [legacyKey]: JSON.stringify({ confidenceThreshold: 0.01 }) })).confidenceThreshold, 0.1);
  assert.equal(loadPreferences(storage({ [currentKey]: JSON.stringify({ version: 3, confidenceThreshold: 4, soundConfidenceThreshold: -1 }) })).confidenceThreshold, 0.85);
  assert.equal(loadPreferences(storage({ [currentKey]: JSON.stringify({ version: 3, confidenceThreshold: 4, soundConfidenceThreshold: -1 }) })).soundConfidenceThreshold, 0.1);
});

test("saved preferences are explicitly versioned", () => {
  const target = storage();
  savePreferences(target, { confidenceThreshold: 0.5, soundConfidenceThreshold: 0.35, expectedConfiguration: {} });
  assert.equal(JSON.parse(target.values.get(DEFAULTS.storageKeys.preferences)).version, 3);
});
