function intersectionOverUnion(a, b) {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  const intersection = Math.max(0, right - left) * Math.max(0, bottom - top);
  const union = a.width * a.height + b.width * b.height - intersection;
  return union > 0 ? intersection / union : 0;
}

function blend(previous, next, alpha) {
  return Object.fromEntries(["x", "y", "width", "height"].map((key) =>
    [key, previous[key] * (1 - alpha) + next[key] * alpha]));
}

export function createBoxTracker({ alpha = 0.42, minimumIoU = 0.25, missedTolerance = 2 } = {}) {
  let tracks = [];
  let nextId = 1;

  return {
    update(detections = []) {
      const unused = new Set(tracks.map((_, index) => index));
      const updated = detections.map((detection) => {
        let bestIndex = -1;
        let bestIoU = minimumIoU;
        tracks.forEach((track, index) => {
          if (!unused.has(index) || track.rawLabel !== detection.rawLabel) return;
          const iou = intersectionOverUnion(track.box, detection.box);
          if (iou > bestIoU) { bestIoU = iou; bestIndex = index; }
        });
        if (bestIndex < 0) return { ...detection, trackId: nextId++, missed: 0 };
        const previous = tracks[bestIndex];
        unused.delete(bestIndex);
        return {
          ...detection,
          trackId: previous.trackId,
          box: blend(previous.box, detection.box, alpha),
          score: previous.score * (1 - alpha) + detection.score * alpha,
          missed: 0
        };
      });
      unused.forEach((index) => {
        const track = tracks[index];
        if (track.missed + 1 <= missedTolerance) updated.push({ ...track, missed: track.missed + 1 });
      });
      tracks = updated;
      return tracks.map(({ missed, ...track }) => Object.freeze(track));
    },
    reset() { tracks = []; nextId = 1; }
  };
}

export { intersectionOverUnion };
