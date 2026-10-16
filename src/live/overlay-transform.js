export function containTransform(sourceWidth, sourceHeight, viewWidth, viewHeight, mirrored = false) {
  const scale = Math.min(viewWidth / sourceWidth, viewHeight / sourceHeight);
  const drawnWidth = sourceWidth * scale;
  const drawnHeight = sourceHeight * scale;
  return Object.freeze({
    scale,
    offsetX: (viewWidth - drawnWidth) / 2,
    offsetY: (viewHeight - drawnHeight) / 2,
    sourceWidth,
    sourceHeight,
    viewWidth,
    viewHeight,
    mirrored
  });
}

export function transformBox(box, transform) {
  const x = box.x * transform.scale;
  const width = box.width * transform.scale;
  return {
    x: transform.mirrored ? transform.viewWidth - transform.offsetX - x - width : transform.offsetX + x,
    y: transform.offsetY + box.y * transform.scale,
    width,
    height: box.height * transform.scale
  };
}
