function finitePoint(point) {
  return point && Number.isFinite(point.x) && Number.isFinite(point.y);
}

export function orderCornersClockwise(points = []) {
  const valid = points.filter(finitePoint);
  if (valid.length < 3) return null;
  const center = valid.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), { x: 0, y: 0 });
  center.x /= valid.length;
  center.y /= valid.length;
  return [...valid].sort((a, b) => Math.atan2(a.y - center.y, a.x - center.x) - Math.atan2(b.y - center.y, b.x - center.x));
}

export function transformPoints(points = [], { scaleX = 1, scaleY = 1, mirrorX = false, width = 0 } = {}) {
  return points.filter(finitePoint).map((point) => {
    const x = point.x * scaleX;
    return { x: mirrorX ? width - x : x, y: point.y * scaleY };
  });
}

export function orientedBoxFromMask(mask) {
  const width = Number(mask?.width);
  const height = Number(mask?.height);
  const data = mask?.data;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || !data?.length) return null;
  const points = [];
  const originX = Number(mask.originX ?? 0);
  const originY = Number(mask.originY ?? 0);
  const scaleX = Number(mask.scaleX ?? 1);
  const scaleY = Number(mask.scaleY ?? 1);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (Number(data[y * width + x]) > 0) points.push({ x: originX + (x + 0.5) * scaleX, y: originY + (y + 0.5) * scaleY });
    }
  }
  if (points.length < 3) return null;
  const center = points.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), { x: 0, y: 0 });
  center.x /= points.length;
  center.y /= points.length;
  let xx = 0;
  let yy = 0;
  let xy = 0;
  points.forEach((point) => {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    xx += dx * dx;
    yy += dy * dy;
    xy += dx * dy;
  });
  const angle = 0.5 * Math.atan2(2 * xy, xx - yy);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  points.forEach((point) => {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    const u = dx * cos + dy * sin;
    const v = -dx * sin + dy * cos;
    minU = Math.min(minU, u); maxU = Math.max(maxU, u);
    minV = Math.min(minV, v); maxV = Math.max(maxV, v);
  });
  const corner = (u, v) => ({ x: center.x + u * cos - v * sin, y: center.y + u * sin + v * cos });
  return Object.freeze({
    center: Object.freeze(center),
    width: maxU - minU,
    height: maxV - minV,
    angle,
    corners: Object.freeze(orderCornersClockwise([
      corner(minU, minV), corner(maxU, minV), corner(maxU, maxV), corner(minU, maxV)
    ]).map(Object.freeze))
  });
}
