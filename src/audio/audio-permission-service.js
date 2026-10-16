import { AppError } from "../utils/errors.js";

function mapMicrophoneError(error) {
  if (["NotAllowedError", "SecurityError"].includes(error?.name)) return "MICROPHONE_DENIED";
  if (["NotFoundError", "DevicesNotFoundError"].includes(error?.name)) return "MICROPHONE_NOT_FOUND";
  if (["NotReadableError", "TrackStartError", "AbortError"].includes(error?.name)) return "MICROPHONE_BUSY";
  return "AUDIO_UNSUPPORTED";
}

export async function requestMicrophoneStream(mediaDevices = navigator.mediaDevices) {
  if (!globalThis.isSecureContext || !mediaDevices?.getUserMedia) throw new AppError("AUDIO_UNSUPPORTED");
  try {
    return await mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: false }, video: false });
  } catch (error) {
    throw new AppError(mapMicrophoneError(error));
  }
}
