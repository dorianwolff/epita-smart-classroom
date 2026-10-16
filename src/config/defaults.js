export const DEFAULTS = Object.freeze({
  confidenceThreshold: 0.6,
  maximumDetectionBoxes: 100,
  maximumSourceDimension: 1280,
  maximumUploadBytes: 15 * 1024 * 1024,
  model: Object.freeze({ base: "lite_mobilenet_v2" }),
  storageKeys: Object.freeze({ preferences: "sallescope.preferences.v1" }),
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
