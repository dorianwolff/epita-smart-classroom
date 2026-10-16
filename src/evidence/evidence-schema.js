const TYPES = new Set(["observed", "segmented-region", "contextual", "manual"]);
const STATUSES = new Set(["candidate", "confirmed", "rejected"]);

export function createEvidence(candidate) {
  if (!TYPES.has(candidate.evidenceType) || !STATUSES.has(candidate.status)) throw new TypeError("Invalid evidence");
  return Object.freeze({
    id: candidate.id ?? globalThis.crypto?.randomUUID?.() ?? `evidence-${Date.now()}`,
    evidenceType: candidate.evidenceType,
    status: candidate.status,
    label: String(candidate.label),
    sourceModel: String(candidate.sourceModel ?? "manual"),
    score: Number.isFinite(candidate.score) ? candidate.score : null,
    mask: candidate.mask ?? null,
    box: candidate.box ?? null,
    polygon: candidate.polygon ?? null,
    explanation: String(candidate.explanation ?? ""),
    canAffectAudit: candidate.status === "confirmed" && Boolean(candidate.canAffectAudit)
  });
}

export function updateEvidenceStatus(evidence, status) {
  return createEvidence({ ...evidence, status, canAffectAudit: status === "confirmed" && evidence.canAffectAudit !== false });
}

export function isAuditEvidence(evidence) {
  return evidence.status === "confirmed" && evidence.canAffectAudit && evidence.evidenceType !== "contextual" ||
    evidence.status === "confirmed" && evidence.canAffectAudit;
}
