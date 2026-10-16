export function buildCloudAudit(state, roomName = "") {
  const confirmedCounts = Object.fromEntries((state.audit?.rows ?? []).filter((row) => row.detected !== null)
    .map((row) => [row.id, row.detected]));
  const manualAnnotations = state.evidence.filter((item) => item.evidenceType === "manual" && item.status === "confirmed")
    .map(({ label, evidenceType, status, box, polygon, explanation }) => ({ label, evidenceType, status, box, polygon, explanation }));
  const contextualEvidence = state.evidence.filter((item) => item.evidenceType === "contextual")
    .map(({ label, evidenceType, status, explanation }) => ({ label, evidenceType, status, explanation }));
  const quality = state.imageQuality?.metrics ?? {};
  return Object.freeze({
    roomName,
    expectedConfiguration: state.expectedConfiguration,
    confirmedCounts,
    manualAnnotations,
    models: state.auditMetadata?.model ? [state.auditMetadata.model] : [],
    threshold: state.confidenceThreshold,
    imageQuality: Object.fromEntries(Object.entries(quality).filter(([, value]) => ["number", "string", "boolean"].includes(typeof value))),
    soundEvents: state.audioRecentEvents.map(({ label, score }) => ({ label, score })),
    anomalies: [],
    contextualEvidence,
    reportSchemaVersion: 1,
    appVersion: "1.1.0"
  });
}

export function exportAuditLocally(payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `sallescope-audit-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
