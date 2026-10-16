import { CATEGORY_BY_CLASS } from "../config/categories.js";
import { clearElement, createElement } from "../utils/dom.js";

function createChip(label, count) {
  const chip = createElement("span", { className: "detection-chip" });
  chip.append(createElement("b", { text: String(count) }), createElement("span", { text: label }));
  return chip;
}

function createGroup(title, items) {
  const group = createElement("div", { className: "result-group" });
  group.append(createElement("h3", { text: title }));
  const list = createElement("div", { className: "detection-list" });
  items.forEach((item) => list.append(createChip(item.label, item.count)));
  group.append(list);
  return group;
}

export function renderResults(container, summary, audit) {
  clearElement(container);
  if (!audit.analysed) {
    container.className = "results-empty";
    container.append(createElement("p", { text: "Aucun résultat pour le moment." }));
    summary.textContent = "Lancez une analyse pour afficher les objets reconnus.";
    return;
  }

  container.className = "";
  summary.textContent = `${audit.metrics.totalSafeObjects} objet(s) reconnu(s), hors personnes.`;
  const mapped = Object.entries(audit.classCounts)
    .filter(([className]) => CATEGORY_BY_CLASS.has(className))
    .map(([className, count]) => ({ label: CATEGORY_BY_CLASS.get(className).label, count }));
  if (mapped.length) container.append(createGroup("Équipements SalleScope", mapped));
  if (audit.otherObjects.length) {
    const others = audit.otherObjects.map(({ label, count }) => ({ label, count }));
    container.append(createGroup("Autres objets détectés", others));
  }
  if (!mapped.length && !audit.otherObjects.length) {
    container.className = "results-empty";
    container.append(createElement("p", { text: "Aucun objet sûr n’a été reconnu dans cette image." }));
  }
}
