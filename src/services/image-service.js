import { DEFAULTS } from "../config/defaults.js";
import { AppError } from "../utils/errors.js";
import { fitWithinMaximum, getIntrinsicSize } from "./source-resolution.js";

function validateFile(file) {
  const validType = DEFAULTS.acceptedImageTypes.includes(file?.type);
  if (!file || !validType || file.size > DEFAULTS.maximumUploadBytes) throw new AppError("INVALID_FILE");
}

function loadImage(objectUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new AppError("IMAGE_LOAD"));
    image.src = objectUrl;
  });
}

async function decodeImage(file) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Fall back to the browser image decoder when ImageBitmap is unavailable for this file.
    }
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    return await loadImage(objectUrl);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function createImageSource(file) {
  validateFile(file);
  const image = await decodeImage(file);
  try {
    const intrinsic = getIntrinsicSize(image);
    if (intrinsic.width <= 0 || intrinsic.height <= 0) throw new AppError("IMAGE_LOAD");
    const fitted = fitWithinMaximum(intrinsic.width, intrinsic.height, DEFAULTS.maximumSourceDimension);
    const canvas = document.createElement("canvas");
    canvas.width = fitted.width;
    canvas.height = fitted.height;
    canvas.sourceOriginalWidth = intrinsic.width;
    canvas.sourceOriginalHeight = intrinsic.height;
    canvas.wasDownscaled = fitted.width !== intrinsic.width || fitted.height !== intrinsic.height;
    canvas.getContext("2d", { alpha: false }).drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    image.close?.();
  }
}

export function takeSelectedFile(input) {
  const file = input.files?.[0] ?? null;
  input.value = "";
  return file;
}
