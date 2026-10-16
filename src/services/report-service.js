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
  if (!state.audit?.analysed) {
    container.append(createElement("p", { className: "report-placeholder", text: "Le rapport sera généré après la première analyse." }));
    return;
  }

  const { audit, auditMetadata } = state;
  const configured = audit.mode === AUDIT_MODE.CONFIGURED;
  const reference = configured
    ? state.configurationSource === "example" ? "Configuration de démonstration fictive" : "Configuration personnalisée"
    : "Aucune configuration de référence sélectionnée";
  const intro = createElement("div", { className: "report-grid" });
  addListBlock(intro, "Contexte de l’audit", [
    `Date et heure : ${formatDateTime(new Date(auditMetadata.completedAt))}`,
    `Méthode d’entrée : ${formatInputMode(auditMetadata.inputMode)}`,
    `Seuil de confiance : ${Math.round(auditMetadata.confidenceThreshold * 100)} %`,
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

  addListBlock(container, "Limites de l’analyse", [
    "COCO-SSD est un modèle généraliste : ses classes ne correspondent pas toujours exactement au mobilier scolaire.",
    "Une quantité inférieure ne prouve pas l’absence d’un équipement.",
    "Les personnes sont supprimées des résultats avant tout affichage ou calcul.",
    "La photographie source est exclue de ce rapport pour protéger la vie privée."
  ], "Aucune limite documentée.");
}

export function printReport() {
  window.print();
}
