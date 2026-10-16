import { DEFAULTS } from "../config/defaults.js";
import { AppError } from "../utils/errors.js";
import { fitWithinMaximum } from "./source-resolution.js";

function mapCameraError(error) {
  if (["NotAllowedError", "SecurityError"].includes(error.name)) return "CAMERA_DENIED";
  if (["NotFoundError", "DevicesNotFoundError"].includes(error.name)) return "CAMERA_NOT_FOUND";
  if (["NotReadableError", "TrackStartError", "AbortError"].includes(error.name)) return "CAMERA_BUSY";
  return "UNSUPPORTED_BROWSER";
}

export function createCameraService() {
  let stream = null;

  async function start(videoElement) {
    if (!window.isSecureContext) throw new AppError("INSECURE_CONTEXT");
    if (!navigator.mediaDevices?.getUserMedia) throw new AppError("UNSUPPORTED_BROWSER");
    stop(videoElement);
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: DEFAULTS.camera.idealWidth },
          height: { ideal: DEFAULTS.camera.idealHeight }
        },
        audio: false
      });
      videoElement.srcObject = stream;
      await videoElement.play();
      return stream;
    } catch (error) {
      throw new AppError(mapCameraError(error));
    }
  }

  function capture(videoElement) {
    if (!stream || !videoElement.videoWidth) throw new AppError("CAMERA_NOT_FOUND");
    const fitted = fitWithinMaximum(videoElement.videoWidth, videoElement.videoHeight, DEFAULTS.maximumSourceDimension);
    const canvas = document.createElement("canvas");
    canvas.width = fitted.width;
    canvas.height = fitted.height;
    canvas.sourceOriginalWidth = videoElement.videoWidth;
    canvas.sourceOriginalHeight = videoElement.videoHeight;
    canvas.wasDownscaled = fitted.width !== videoElement.videoWidth || fitted.height !== videoElement.videoHeight;
    canvas.getContext("2d", { alpha: false }).drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  function stop(videoElement) {
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    if (videoElement) videoElement.srcObject = null;
  }

  function pause(videoElement) {
    videoElement?.pause?.();
  }

  async function resume(videoElement) {
    if (!stream) return start(videoElement);
    videoElement.srcObject = stream;
    await videoElement.play();
    return stream;
  }

  return { start, capture, stop, pause, resume, isActive: () => Boolean(stream) };
}
