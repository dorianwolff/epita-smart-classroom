import { calculateImageQualityMetrics, interpretImageQuality } from "../quality/image-quality-assessor.js";

const SAMPLE_SIZE = 96;

export function createLightingMonitor({ video, onUpdate, intervalMilliseconds = 400 }) {
  const canvas = document.createElement("canvas");
  canvas.width = SAMPLE_SIZE;
  canvas.height = SAMPLE_SIZE;
  const context = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
  const history = [];
  let timer = null;

  function sample() {
    if (!video.videoWidth || document.hidden) return;
    context.drawImage(video, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    const data = context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data;
    const metrics = calculateImageQualityMetrics(data, SAMPLE_SIZE, SAMPLE_SIZE, {
      width: video.videoWidth, height: video.videoHeight
    });
    const quality = interpretImageQuality(metrics, history);
    history.push(metrics);
    if (history.length > 4) history.shift();
    onUpdate(Object.freeze({ metrics, ...quality }));
  }

  return {
    start() {
      if (timer) return;
      sample();
      timer = setInterval(sample, intervalMilliseconds);
    },
    stop() { clearInterval(timer); timer = null; history.length = 0; }
  };
}
