export const DEFAULTS = Object.freeze({
  confidenceThreshold: 0.3,
  minimumConfidenceThreshold: 0.1,
  maximumConfidenceThreshold: 0.85,
  confidenceStep: 0.05,
  soundConfidenceThreshold: 0.3,
  minimumSoundConfidenceThreshold: 0.1,
  maximumSoundConfidenceThreshold: 0.85,
  soundWindowSamples: 16384,
  thresholdDebounceMilliseconds: 350,
  maximumDetectionBoxes: 100,
  maximumSourceDimension: 1600,
  maximumUploadBytes: 15 * 1024 * 1024,
  model: Object.freeze({
    id: "coco-ssd-mobilenet-v2",
    base: "mobilenet_v2",
    label: "COCO-SSD · MobileNet v2"
  }),
  camera: Object.freeze({ idealWidth: 1920, idealHeight: 1080 }),
  preprocessing: Object.freeze({ id: "original", label: "Image originale, sans correction automatique" }),
  audio: Object.freeze({
    id: "yamnet-float32-v1",
    label: "YAMNet float32 v1",
    packageVersion: "1.1.0",
    packageUrl: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-audio@1.1.0/+esm",
    wasmUrl: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-audio@1.1.0/wasm",
    modelUrl: "https://storage.googleapis.com/mediapipe-models/audio_classifier/yamnet/float32/1/yamnet.tflite"
  }),
  storageKeys: Object.freeze({ preferences: "sallescope.preferences.v3", legacyPreferences: "sallescope.preferences.v2" }),
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
