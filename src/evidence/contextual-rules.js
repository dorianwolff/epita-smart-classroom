export const CONTEXTUAL_RULES = Object.freeze([
  Object.freeze({
    id: "laptop-implies-support",
    when: Object.freeze({ observedAny: ["laptop", "keyboard", "monitor", "tv"], missingAll: ["desk", "table", "dining table"] }),
    suggest: Object.freeze({ label: "desk-or-table", message: "Un ordinateur est visible : un bureau ou une table est probablement présent.", requiresConfirmation: true })
  }),
  Object.freeze({
    id: "screen-wall-board-area",
    when: Object.freeze({ observedAny: ["tv", "screen"], segmentedAny: ["wall"] }),
    suggest: Object.freeze({ label: "board-or-screen-area", message: "Un écran apparaît près d’une zone murale : vérifiez s’il s’agit d’un écran ou d’un tableau.", requiresConfirmation: true })
  }),
  Object.freeze({
    id: "semantic-light-fixture",
    when: Object.freeze({ segmentedAny: ["lamp", "light"] }),
    suggest: Object.freeze({ label: "lighting-fixture", message: "Une région de lampe ou de lumière suggère un luminaire à confirmer.", requiresConfirmation: true })
  })
]);

function labelsOf(items, field = "rawLabel") {
  return new Set(items.map((item) => String(item[field] ?? item.label ?? "").toLowerCase()));
}

export function inferContextualEvidence({ detections = [], evidence = [], rules = CONTEXTUAL_RULES }) {
  const observed = labelsOf(detections);
  const segmented = labelsOf(evidence.filter((item) => item.evidenceType === "segmented-region"), "label");
  const existing = new Set(evidence.map((item) => item.sourceModel));
  return rules.filter((rule) => {
    const when = rule.when;
    if (existing.has(`context-rule:${rule.id}`)) return false;
    if (when.observedAny && !when.observedAny.some((label) => observed.has(label))) return false;
    if (when.segmentedAny && !when.segmentedAny.some((label) => segmented.has(label))) return false;
    if (when.missingAll?.some((label) => observed.has(label))) return false;
    return true;
  }).map((rule) => ({
    id: `context:${rule.id}`,
    evidenceType: "contextual",
    status: "candidate",
    label: rule.suggest.label,
    sourceModel: `context-rule:${rule.id}`,
    score: null, mask: null, box: null, polygon: null,
    explanation: rule.suggest.message,
    canAffectAudit: false
  }));
}
