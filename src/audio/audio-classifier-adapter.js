export function extractAudioCategories(result) {
  const chunks = Array.isArray(result) ? result : [result];
  return chunks.flatMap((chunk) => chunk?.classifications ?? [])
    .flatMap((classification) => classification?.categories ?? [])
    .map((category) => ({
      label: String(category.categoryName ?? category.displayName ?? "unknown"),
      score: Number(category.score ?? 0),
      index: Number(category.index ?? -1)
    }))
    .filter((category) => Number.isFinite(category.score))
    .sort((a, b) => b.score - a.score);
}

export function createAudioModelMetadata(configuration, backend = "WebAssembly") {
  return Object.freeze({
    id: configuration.id,
    label: configuration.label,
    source: "MediaPipe Tasks Audio",
    packageVersion: configuration.packageVersion,
    modelUrl: configuration.modelUrl,
    backend,
    processing: "local-worker"
  });
}
