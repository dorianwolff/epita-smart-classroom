import { extractAudioCategories, createAudioModelMetadata } from "./audio-classifier-adapter.js";

let classifier = null;
let metadata = null;

self.addEventListener("message", async (event) => {
  const { type, configuration, samples, sampleRate, generation } = event.data ?? {};
  try {
    if (type === "initialize") {
      const { AudioClassifier, FilesetResolver } = await import(configuration.packageUrl);
      const fileset = await FilesetResolver.forAudioTasks(configuration.wasmUrl, true);
      const modelResponse = await fetch(configuration.modelUrl);
      if (!modelResponse.ok) throw new Error(`YAMNet download failed (${modelResponse.status})`);
      const modelAssetBuffer = new Uint8Array(await modelResponse.arrayBuffer());
      classifier = await AudioClassifier.createFromOptions(fileset, {
        baseOptions: { modelAssetBuffer, delegate: "CPU" },
        maxResults: 12,
        scoreThreshold: 0
      });
      metadata = createAudioModelMetadata(configuration);
      self.postMessage({ type: "ready", generation, metadata });
    } else if (type === "classify" && classifier) {
      const startedAt = performance.now();
      const categories = extractAudioCategories(classifier.classify(samples, sampleRate));
      self.postMessage({ type: "result", generation, categories, inferenceMilliseconds: Math.round(performance.now() - startedAt) });
    } else if (type === "dispose") {
      classifier?.close?.();
      classifier = null;
      self.close();
    }
  } catch (error) {
    self.postMessage({ type: "error", generation, message: error instanceof Error ? error.message : String(error) });
  }
});
