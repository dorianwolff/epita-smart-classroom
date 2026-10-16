export function createAudioSmoother({ minimumWindows = 2, maximumRecent = 8, now = () => Date.now() } = {}) {
  let previousId = null;
  let consecutive = 0;
  let missingWindows = 0;
  let current = null;
  let recent = [];

  function update(events) {
    const top = events[0] ?? null;
    if (!top) {
      previousId = null;
      consecutive = 0;
      missingWindows += 1;
      if (missingWindows >= minimumWindows) current = null;
      return { current, recent };
    }
    missingWindows = 0;
    consecutive = top.id === previousId ? consecutive + 1 : 1;
    previousId = top.id;
    if (consecutive >= minimumWindows) {
      current = Object.freeze({ ...top, detectedAt: new Date(now()).toISOString() });
      const prior = recent[0];
      if (prior?.id === current.id) recent = [current, ...recent.slice(1)];
      else recent = [current, ...recent].slice(0, maximumRecent);
    }
    return { current, recent: [...recent] };
  }

  function reset() {
    previousId = null;
    consecutive = 0;
    missingWindows = 0;
    current = null;
    recent = [];
  }

  return { update, reset };
}
