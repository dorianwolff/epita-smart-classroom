const ROOT_FIELDS = new Set(["roomName", "expectedConfiguration", "confirmedCounts", "manualAnnotations", "models", "threshold",
  "imageQuality", "soundEvents", "anomalies", "contextualEvidence", "reportSchemaVersion", "appVersion"]);
const EVIDENCE_TYPES = new Set(["observed", "segmented-region", "contextual", "manual"]);
const STATUSES = new Set(["candidate", "confirmed", "rejected"]);

function plainObject(value) { return value && typeof value === "object" && !Array.isArray(value); }
function boundedString(value, maximum, optional = false) {
  if (optional && (value === null || value === undefined || value === "")) return true;
  return typeof value === "string" && value.length <= maximum;
}
function finiteRange(value, minimum, maximum) { return Number.isFinite(value) && value >= minimum && value <= maximum; }
function safeCoordinates(value) {
  if (value === null) return true;
  if (Array.isArray(value)) return value.length >= 3 && value.length <= 8 && value.every((point) => plainObject(point) && finiteRange(point.x, 0, 1) && finiteRange(point.y, 0, 1));
  return plainObject(value) && [value.x, value.y, value.width, value.height].every((item) => finiteRange(item, 0, 1));
}

export function validateAuditPayload(payload) {
  if (!plainObject(payload) || Object.keys(payload).some((field) => !ROOT_FIELDS.has(field))) return "Champs de premier niveau invalides.";
  if (!boundedString(payload.roomName, 120, true) || !boundedString(payload.appVersion, 32) || payload.reportSchemaVersion !== 1) return "Métadonnées invalides.";
  if (!finiteRange(payload.threshold, 0.1, 0.85)) return "Seuil invalide.";
  if (!plainObject(payload.expectedConfiguration) || !plainObject(payload.confirmedCounts) || Object.keys(payload.expectedConfiguration).length > 30) return "Configuration invalide.";
  if (![...Object.values(payload.expectedConfiguration), ...Object.values(payload.confirmedCounts)]
    .every((value) => value === null || Number.isInteger(value) && value >= 0 && value <= 1000)) return "Quantité invalide.";
  if (!Array.isArray(payload.models) || payload.models.length > 10 || !payload.models.every((item) => boundedString(item, 120))) return "Modèles invalides.";
  if (!Array.isArray(payload.manualAnnotations) || payload.manualAnnotations.length > 100) return "Annotations invalides.";
  for (const item of payload.manualAnnotations) {
    if (!plainObject(item) || !boundedString(item.label, 80) || item.evidenceType !== "manual" || item.status !== "confirmed" ||
      !safeCoordinates(item.polygon ?? item.box ?? null)) return "Annotation invalide.";
  }
  if (!Array.isArray(payload.contextualEvidence) || payload.contextualEvidence.length > 100) return "Éléments contextuels invalides.";
  for (const item of payload.contextualEvidence) {
    if (!plainObject(item) || !boundedString(item.label, 80) || !boundedString(item.explanation, 500) ||
      !EVIDENCE_TYPES.has(item.evidenceType) || !STATUSES.has(item.status)) return "Élément contextuel invalide.";
  }
  if (!plainObject(payload.imageQuality) || Object.keys(payload.imageQuality).length > 30 ||
    !Object.values(payload.imageQuality).every((value) => Number.isFinite(value) || typeof value === "string" || typeof value === "boolean")) return "Mesures invalides.";
  if (!Array.isArray(payload.soundEvents) || payload.soundEvents.length > 30 || !Array.isArray(payload.anomalies) || payload.anomalies.length > 30) return "Résumé invalide.";
  if (payload.soundEvents.some((item) => !plainObject(item) || !boundedString(item.label, 80) || !finiteRange(item.score, 0, 1))) return "Événement sonore invalide.";
  if (payload.anomalies.some((item) => !boundedString(item, 200))) return "Anomalie invalide.";
  const serialized = JSON.stringify(payload).toLowerCase();
  if (["data:image", "audio/", "video/", "person\"", "rawaudio", "tensor"].some((term) => serialized.includes(term))) return "Donnée interdite dans un audit structuré.";
  return null;
}
