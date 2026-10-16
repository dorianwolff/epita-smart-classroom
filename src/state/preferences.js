import { EMPTY_EXPECTED } from "../config/categories.js";
import { DEFAULTS } from "../config/defaults.js";

const VERSION = 3;

function clampThreshold(value, fallback, minimum, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(maximum, Math.max(minimum, number));
}

function sanitizeExpected(candidate = {}) {
  return Object.fromEntries(Object.keys(EMPTY_EXPECTED).map((id) => {
    const value = candidate[id];
    return [id, Number.isInteger(value) && value >= 0 ? value : null];
  }));
}

function parse(storage, key) {
  try {
    return JSON.parse(storage.getItem(key) ?? "null");
  } catch {
    return null;
  }
}

export function loadPreferences(storage = localStorage) {
  const current = parse(storage, DEFAULTS.storageKeys.preferences);
  if (current?.version === VERSION) {
    return {
      expectedConfiguration: sanitizeExpected(current.expectedConfiguration),
      confidenceThreshold: clampThreshold(current.confidenceThreshold, DEFAULTS.confidenceThreshold,
        DEFAULTS.minimumConfidenceThreshold, DEFAULTS.maximumConfidenceThreshold),
      soundConfidenceThreshold: clampThreshold(current.soundConfidenceThreshold, DEFAULTS.soundConfidenceThreshold,
        DEFAULTS.minimumSoundConfidenceThreshold, DEFAULTS.maximumSoundConfidenceThreshold)
    };
  }

  const legacy = parse(storage, DEFAULTS.storageKeys.legacyPreferences);
  const legacyThreshold = Number(legacy?.confidenceThreshold);
  // v2 shipped with 0.40 as its untouched default and had no "customised" flag.
  const migratedThreshold = legacyThreshold === 0.4 ? DEFAULTS.confidenceThreshold : legacyThreshold;
  return {
    expectedConfiguration: sanitizeExpected(legacy?.expectedConfiguration),
    confidenceThreshold: clampThreshold(migratedThreshold, DEFAULTS.confidenceThreshold,
      DEFAULTS.minimumConfidenceThreshold, DEFAULTS.maximumConfidenceThreshold),
    soundConfidenceThreshold: DEFAULTS.soundConfidenceThreshold
  };
}

export function savePreferences(storage, preferences) {
  storage.setItem(DEFAULTS.storageKeys.preferences, JSON.stringify({
    version: VERSION,
    confidenceThreshold: preferences.confidenceThreshold,
    soundConfidenceThreshold: preferences.soundConfidenceThreshold,
    expectedConfiguration: sanitizeExpected(preferences.expectedConfiguration)
  }));
}
