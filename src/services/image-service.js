import { DEFAULTS } from "../config/defaults.js";
import { AppError } from "../utils/errors.js";

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

export async function createImageSource(file) {
  validateFile(file);
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    const scale = Math.min(1, DEFAULTS.maximumSourceDimension / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    canvas.getContext("2d", { alpha: false }).drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
