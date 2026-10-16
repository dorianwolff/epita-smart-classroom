import { clearElement, createElement } from "../utils/dom.js";

const METRICS = [
  ["totalSafeObjects", "Objets sûrs détectés"],
  ["distinctCategories", "Catégories reconnues"],
  ["verifiableRules", "Règles vérifiables"],
  ["observedDifferences", "Écarts observés"]
];

export function renderDashboard(container, statusElement, metrics) {
  clearElement(container);
  METRICS.forEach(([key, label]) => {
    const card = createElement("article", { className: "metric-card" });
    card.append(createElement("span", { text: label }), createElement("strong", { text: String(metrics[key]) }));
    container.append(card);
  });

  statusElement.textContent = metrics.globalStatus;
  statusElement.className = `global-status ${getGlobalStatusClass(metrics.globalStatus)}`;
}

function getGlobalStatusClass(status) {
  if (["Configuration vérifiée", "Détection terminée"].includes(status)) return "status-verified";
  if (status === "En attente") return "status-waiting";
  return "status-difference";
}
