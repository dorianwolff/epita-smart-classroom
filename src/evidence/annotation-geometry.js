function clamp(value) { return Math.min(1, Math.max(0, value)); }

export function normalizePoint(point, width, height) {
  return Object.freeze({ x: clamp(point.x / width), y: clamp(point.y / height) });
}

export function denormalizePoint(point, width, height) {
  return Object.freeze({ x: point.x * width, y: point.y * height });
}

export function rectangleFromDrag(start, end, width, height) {
  const a = normalizePoint(start, width, height);
  const b = normalizePoint(end, width, height);
  return Object.freeze({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) });
}

export function rectangleToPolygon(box) {
  return Object.freeze([
    { x: box.x, y: box.y }, { x: box.x + box.width, y: box.y },
    { x: box.x + box.width, y: box.y + box.height }, { x: box.x, y: box.y + box.height }
  ].map(Object.freeze));
}

export function movePolygonHandle(polygon, index, point, width, height) {
  if (!polygon[index]) return polygon;
  return Object.freeze(polygon.map((item, position) => position === index ? normalizePoint(point, width, height) : item));
}
