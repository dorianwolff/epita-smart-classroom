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
  let deviceId = null;

  async function start(videoElement, options = {}) {
    if (!window.isSecureContext) throw new AppError("INSECURE_CONTEXT");
    if (!navigator.mediaDevices?.getUserMedia) throw new AppError("UNSUPPORTED_BROWSER");
    stop(videoElement);
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          ...(options.deviceId ? { deviceId: { exact: options.deviceId } } : { facingMode: { ideal: "environment" } }),
          width: { ideal: DEFAULTS.camera.idealWidth },
          height: { ideal: DEFAULTS.camera.idealHeight }
        },
        audio: false
      });
      videoElement.srcObject = stream;
      await videoElement.play();
      deviceId = stream.getVideoTracks?.()[0]?.getSettings?.().deviceId ?? options.deviceId ?? null;
      stream.getVideoTracks?.()[0]?.addEventListener?.("ended", () => options.onEnded?.());
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

  async function listVideoInputs() {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    return (await navigator.mediaDevices.enumerateDevices()).filter((item) => item.kind === "videoinput");
  }

  async function switchCamera(videoElement, options = {}) {
    const devices = await listVideoInputs();
    if (devices.length < 2) return null;
    const currentIndex = Math.max(0, devices.findIndex((item) => item.deviceId === deviceId));
    const next = devices[(currentIndex + 1) % devices.length];
    return start(videoElement, { ...options, deviceId: next.deviceId });
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

  return { start, capture, stop, pause, resume, switchCamera, listVideoInputs, isActive: () => Boolean(stream) };
}
