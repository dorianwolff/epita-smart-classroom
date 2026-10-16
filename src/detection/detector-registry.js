export function createDetectorRegistry(detectors, initialDetectorId) {
  const byId = new Map(detectors.map((detector) => [detector.getMetadata().id, detector]));
  let activeId = initialDetectorId;

  function getActive() {
    const detector = byId.get(activeId);
    if (!detector) throw new Error(`Détecteur inconnu : ${activeId}`);
    return detector;
  }

  function select(detectorId) {
    if (!byId.has(detectorId)) throw new Error(`Détecteur inconnu : ${detectorId}`);
    activeId = detectorId;
    return getActive();
  }

  return { getActive, select, getActiveId: () => activeId };
}
