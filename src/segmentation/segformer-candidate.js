import { DEFAULTS } from "../config/defaults.js";

const RELEVANT_LABELS = new Map([
  ["desk", "desk"], ["table", "table"], ["chair", "chair"], ["seat", "seat"], ["windowpane", "window"],
  ["window", "window"], ["lamp", "lamp"], ["light", "light"], ["computer", "computer"], ["screen", "screen"],
  ["bulletin board", "board-surface-candidate"], ["signboard", "board-surface-candidate"], ["wall", "wall"]
]);

export function getSegformerDecision() { return DEFAULTS.segmentation; }

export function normalizeSemanticRegion(region) {
  const label = RELEVANT_LABELS.get(String(region.label).toLowerCase());
  if (!label || label === "person") return null;
  const uncertain = ["board-surface-candidate", "lamp", "light", "desk", "table"].includes(label);
  return Object.freeze({ evidenceType: "segmented-region", status: "candidate", label,
    sourceModel: DEFAULTS.segmentation.id, score: null, mask: region.mask ?? null, box: null, polygon: null,
    explanation: uncertain ? "Région sémantique à confirmer ; elle ne constitue pas un comptage d’instance." : "Région sémantique de contexte.",
    canAffectAudit: false });
}
