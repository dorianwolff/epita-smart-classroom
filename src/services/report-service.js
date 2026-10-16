import { clearElement, createElement } from "../utils/dom.js";
import { formatDateTime, formatInputMode, signedNumber } from "../utils/formatting.js";
import { AUDIT_MODE } from "../config/defaults.js";

function addListBlock(container, title, values, fallback) {
  const block = createElement("section", { className: "report-block" });
  block.append(createElement("h3", { text: title }));
  if (!values.length) block.append(createElement("p", { text: fallback }));
  else {
    const list = createElement("ul");
    values.forEach((value) => list.append(createElement("li", { text: value })));
    block.append(list);
  }
  container.append(block);
}

function createComparisonTable(rows) {
  const table = createElement("table", { className: "report-table" });
  const head = document.createElement("thead");
  const headerRow = document.createElement("tr");
  ["Équipement", "Attendu", "Détecté", "Écart", "Statut"].forEach((label) => headerRow.append(createElement("th", { text: label })));
  head.append(headerRow);
  const body = document.createElement("tbody");
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    [row.label, row.expected ?? "—", row.detected ?? "—", row.difference === null ? "—" : signedNumber(row.difference), row.status]
      .forEach((value) => tr.append(createElement("td", { text: String(value) })));
    body.append(tr);
  });
  table.append(head, body);
  return table;
}

export function renderReport(container, state) {
  clearElement(container);
  if (!state.audit?.analysed && !state.audioRecentEvents?.length) {
    container.append(createElement("p", { className: "report-placeholder", text: "Le rapport sera généré après la première analyse." }));
    return;
  }

  if (state.audioRecentEvents?.length) {
    const audioMetadata = state.audioMetadata ?? {};
    addListBlock(container, "Événements sonores confirmés", state.audioRecentEvents.map((event) =>
      `${event.label} · ${Math.round(event.score * 100)} % · ${formatDateTime(new Date(event.detectedAt))}`), "Aucun événement sonore confirmé.");
    addListBlock(container, "Méthode sonore", [
      `Modèle : ${audioMetadata.label ?? "YAMNet float32 v1"}`,
      `Seuil : ${Math.round(state.soundConfidenceThreshold * 100)} %`,
      "Traitement local par fenêtres, sans conservation du son brut.",
      "Aucune transcription ni identification de la voix."
    ], "Méthode indisponible.");
  }

  if (!state.audit?.analysed) return;

  const { audit, auditMetadata } = state;
  const configured = audit.mode === AUDIT_MODE.CONFIGURED;
  const reference = configured
    ? state.configurationSource === "example" ? "Configuration de démonstration fictive" : "Configuration personnalisée"
    : "Aucune configuration de référence sélectionnée";
  const intro = createElement("div", { className: "report-grid" });
  addListBlock(intro, "Contexte de l’audit", [
    `Date et heure : ${formatDateTime(new Date(auditMetadata.completedAt))}`,
    `Méthode d’entrée : ${formatInputMode(auditMetadata.inputMode)}`,
    `Source analysée : ${auditMetadata.sourceWidth} × ${auditMetadata.sourceHeight} px`,
    `Modèle : ${auditMetadata.model}`,
    `Moteur d’exécution : ${auditMetadata.runtimeBackend}`,
    `Temps d’inférence mesuré : ${auditMetadata.inferenceMilliseconds} ms`,
    `Seuil de confiance : ${Math.round(auditMetadata.confidenceThreshold * 100)} %`,
    `Prétraitement : ${auditMetadata.preprocessingLabel ?? "Image originale"}`,
    `Mode : ${configured ? "Audit configuré" : "Détection libre"}`,
    `Configuration de référence : ${reference}`,
    `Statut global : ${audit.metrics.globalStatus}`
  ], "Contexte indisponible");
  addListBlock(intro, "Synthèse", [
    `${audit.metrics.totalSafeObjects} objet(s) sûr(s) détecté(s)`,
    `${audit.metrics.distinctCategories} catégorie(s) reconnue(s)`,
    `${audit.metrics.verifiableRules} règle(s) vérifiable(s)`,
    `${audit.metrics.observedDifferences} écart(s) observé(s)`
  ], "Aucune donnée");
  container.append(intro);

  if (state.imageQuality?.metrics) {
    const quality = state.imageQuality;
    addListBlock(container, "Qualité lumineuse de l’image", [
      `Évaluation : ${quality.status}`,
      `Dimensions analysées : ${quality.metrics.width} × ${quality.metrics.height} px`,
      `Luminance relative moyenne : ${Math.round(quality.metrics.meanLuminance * 100)} %`,
      `Luminance relative médiane : ${Math.round(quality.metrics.medianLuminance * 100)} %`,
      `Contraste par étendue P10–P90 : ${Math.round(quality.metrics.contrast * 100)} %`,
      "Mesure issue des pixels après linéarisation sRGB ; ce n’est pas un éclairement physique en lux.",
      ...quality.guidance
    ], "Qualité non mesurée.");
  }

  const comparison = createElement("section", { className: "report-block" });
  comparison.append(createElement("h3", { text: configured ? "Comparaison attendu / détecté" : "Détections par catégorie" }), createComparisonTable(audit.rows));
  container.append(comparison);

  const mapped = audit.rows.filter((row) => row.supported && row.detected > 0).map((row) => `${row.label} : ${row.detected}`);
  const others = audit.otherObjects.map((item) => `${item.label} : ${item.count}`);
  const lowerGrid = createElement("div", { className: "report-grid" });
  addListBlock(lowerGrid, "Équipements détectés", [...mapped, ...others], "Aucun objet sûr reconnu.");
  const differenceFallback = configured
    ? "Aucune différence sur les catégories vérifiables."
    : "Aucune comparaison : aucune configuration de référence n’a été sélectionnée.";
  addListBlock(lowerGrid, "Différences", audit.differences.map((row) => `${row.label} : ${signedNumber(row.difference)}`), differenceFallback);
  addListBlock(lowerGrid, "Catégories non vérifiables", audit.rows.filter((row) => !row.supported).map((row) => `${row.label} — ${row.limitation}`), "Aucune.");
  addListBlock(lowerGrid, "Contrôles manuels recommandés", [
    "Vérifier les objets masqués ou hors cadre.",
    "Contrôler manuellement les tableaux et fenêtres.",
    "Confirmer les écarts avant toute décision opérationnelle."
  ], "Aucun.");
  container.append(lowerGrid);

  const confirmedEvidence = (state.evidence ?? []).filter((item) => item.status === "confirmed");
  const candidates = (state.evidence ?? []).filter((item) => item.status === "candidate");
  addListBlock(container, "Équipements confirmés manuellement", confirmedEvidence.map((item) =>
    `${item.label} — ${item.evidenceType === "manual" ? "Confirmé manuellement" : "Suggestion confirmée"}`), "Aucune confirmation manuelle.");
  addListBlock(container, "À vérifier", candidates.map((item) => `${item.label} — ${item.explanation}`), "Aucune suggestion en attente.");

  addListBlock(container, "Limites de l’analyse", [
    "COCO-SSD est un modèle généraliste : ses classes ne correspondent pas toujours exactement au mobilier scolaire.",
    "Les bureaux sont approximés par la classe « dining table » et les moniteurs par « tv ».",
    "COCO-SSD ne détecte pas les tableaux ; un tableau ne peut être compté qu’après confirmation manuelle.",
    "Les suggestions contextuelles et les régions sémantiques ne sont pas des détections d’instance.",
    "La qualité lumineuse de l’image n’est pas une mesure calibrée de l’éclairement de la salle.",
    "Les objets petits, éloignés, partiellement masqués ou mal éclairés peuvent ne pas être détectés.",
    "Une quantité inférieure ne prouve pas l’absence d’un équipement.",
    "Les personnes sont supprimées des résultats avant tout affichage ou calcul.",
    "La photographie source est exclue de ce rapport pour protéger la vie privée."
  ], "Aucune limite documentée.");
}

export function printReport() {
  window.print();
}
