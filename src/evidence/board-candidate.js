export function proposeBoardCandidate(data, width, height) {
  if (!data?.length || width < 24 || height < 24) return null;
  let minX = width; let minY = height; let maxX = 0; let maxY = 0; let edges = 0;
  const luminance = (index) => 0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2];
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const offset = (y * width + x) * 4;
      const horizontal = Math.abs(luminance(offset - 4) - luminance(offset + 4));
      const vertical = Math.abs(luminance(offset - width * 4) - luminance(offset + width * 4));
      if (horizontal + vertical < 110) continue;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); edges += 1;
    }
  }
  const boxWidth = maxX - minX;
  const boxHeight = maxY - minY;
  const areaRatio = boxWidth * boxHeight / (width * height);
  const aspect = boxHeight ? boxWidth / boxHeight : 0;
  if (edges < 30 || areaRatio < 0.12 || areaRatio > 0.78 || aspect < 1.15 || aspect > 4.5) return null;
  return Object.freeze({ evidenceType: "segmented-region", status: "candidate", label: "board-surface-candidate",
    sourceModel: "classical-edge-rectangle-v1", score: null, mask: null,
    box: Object.freeze({ x: minX / width, y: minY / height, width: boxWidth / width, height: boxHeight / height }),
    polygon: null, explanation: "Surface de tableau possible : grand contour rectangulaire à confirmer.", canAffectAudit: false });
}
