import { DEFAULTS } from "../config/defaults.js";
import { AppError } from "../utils/errors.js";

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
        video: { facingMode: { ideal: "environment" } },
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
    const scale = Math.min(1, DEFAULTS.maximumSourceDimension / Math.max(videoElement.videoWidth, videoElement.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(videoElement.videoWidth * scale);
    canvas.height = Math.round(videoElement.videoHeight * scale);
    canvas.getContext("2d", { alpha: false }).drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  function stop(videoElement) {
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    if (videoElement) videoElement.srcObject = null;
  }

  return { start, capture, stop, isActive: () => Boolean(stream) };
}
