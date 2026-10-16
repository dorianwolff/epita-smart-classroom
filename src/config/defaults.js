export const DEFAULTS = Object.freeze({
  confidenceThreshold: 0.4,
  minimumConfidenceThreshold: 0.25,
  maximumConfidenceThreshold: 0.85,
  confidenceStep: 0.05,
  thresholdDebounceMilliseconds: 350,
  maximumDetectionBoxes: 100,
  maximumSourceDimension: 1600,
  maximumUploadBytes: 15 * 1024 * 1024,
  model: Object.freeze({ base: "mobilenet_v2", label: "MobileNet v2 (précis)" }),
  camera: Object.freeze({ idealWidth: 1920, idealHeight: 1080 }),
  storageKeys: Object.freeze({ preferences: "sallescope.preferences.v2" }),
  acceptedImageTypes: Object.freeze(["image/jpeg", "image/png", "image/webp"])
});

export const MODEL_STATUS = Object.freeze({
  LOADING: "loading",
  READY: "ready",
  ERROR: "error"
});

export const INPUT_MODE = Object.freeze({
  NONE: "none",
  CAMERA: "camera",
  UPLOAD: "upload"
});

export const AUDIT_MODE = Object.freeze({
  FREE: "free",
  CONFIGURED: "configured"
});

export const ANALYSIS_STATUS = Object.freeze({
  IDLE: "idle",
  QUEUED: "queued",
  RUNNING: "running",
  COMPLETE: "complete"
});
