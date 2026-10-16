import { clearElement, createElement } from "../utils/dom.js";
import { signedNumber } from "../utils/formatting.js";

function statusClass(status) {
  const classes = {
    "Vérifié": "status-verified",
    "Écart à contrôler": "status-difference",
    "Surplus observé": "status-surplus",
    "Non vérifiable": "status-unsupported",
    "Non configuré": "status-unconfigured"
  };
  return classes[status] ?? "status-waiting";
}

function createCell(label, text, className = "") {
  const cell = createElement("td", { className, text });
  cell.dataset.label = label;
  return cell;
}

export function renderAuditRows(container, rows) {
  clearElement(container);
  rows.forEach((row) => {
    const tableRow = createElement("tr");
    const equipment = createElement("td", { className: "audit-equipment" });
    equipment.dataset.label = "Équipement";
    equipment.append(createElement("strong", { text: row.label }), createElement("small", { text: row.limitation }));
    const status = createElement("span", { className: `row-status ${statusClass(row.status)}`, text: row.status });
    const statusCell = createElement("td");
    statusCell.dataset.label = "Statut";
    statusCell.append(status);
    tableRow.append(
      equipment,
      createCell("Attendu", row.expected === null ? "—" : String(row.expected)),
      createCell("Détecté", row.detected === null ? "—" : String(row.detected)),
      createCell("Différence", row.difference === null ? "—" : signedNumber(row.difference)),
      statusCell
    );
    container.append(tableRow);
  });
}
