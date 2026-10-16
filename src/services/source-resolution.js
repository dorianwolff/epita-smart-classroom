export function getIntrinsicSize(source) {
  return {
    width: Number(source.videoWidth || source.naturalWidth || source.width),
    height: Number(source.videoHeight || source.naturalHeight || source.height)
  };
}

export function fitWithinMaximum(width, height, maximumDimension) {
  const scale = Math.min(1, maximumDimension / Math.max(width, height));
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale)
  };
}
