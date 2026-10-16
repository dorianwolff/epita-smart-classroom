export function createAdaptiveSampler({ minimumInterval = 700, slowDuration = 1400, initialSize = 576, reducedSize = 448 } = {}) {
  let interval = minimumInterval;
  let longestSide = initialSize;
  let consecutiveSlow = 0;
  return {
    record(duration) {
      consecutiveSlow = duration > slowDuration ? consecutiveSlow + 1 : 0;
      interval = Math.max(minimumInterval, Math.min(2500, Math.round(duration * 1.15)));
      if (consecutiveSlow >= 2) longestSide = reducedSize;
      return this.getState();
    },
    getState: () => Object.freeze({ interval, longestSide, reduced: longestSide === reducedSize }),
    reset() { interval = minimumInterval; longestSide = initialSize; consecutiveSlow = 0; }
  };
}
