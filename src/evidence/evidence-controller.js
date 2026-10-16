import { inferContextualEvidence } from "./contextual-rules.js";
import { createEvidence, updateEvidenceStatus } from "./evidence-schema.js";
import { createElement } from "../utils/dom.js";

const CONFIRM_LABELS = Object.freeze({
  "desk-or-table": "desk",
  "board-or-screen-area": "whiteboard",
  "board-surface-candidate": "whiteboard",
  "lighting-fixture": "lighting-fixture"
});

function title(item) {
  if (item.evidenceType === "observed") return "Détecté";
  if (item.evidenceType === "manual") return "Confirmé manuellement";
  if (item.status === "confirmed") return "Confirmé";
  return "Probable — à confirmer";
}

export class EvidenceController {
  constructor({ store, onChange, annotation }) {
    this.store = store;
    this.onChange = onChange;
    this.annotation = annotation;
    this.list = document.querySelector("#evidence-list");
    this.addButton = document.querySelector("#add-equipment");
    this.panel = document.querySelector("#annotation-tools");
  }

  start() {
    this.addButton.addEventListener("click", () => { this.panel.hidden = false; document.querySelector("#annotation-label").focus(); });
    document.querySelector("#annotation-start").addEventListener("click", () => {
      this.annotation.begin(document.querySelector("#annotation-shape").value, document.querySelector("#annotation-label").value);
      this.panel.hidden = true;
    });
    document.querySelector("#annotation-cancel").addEventListener("click", () => { this.panel.hidden = true; this.annotation.cancel(); });
    this.store.subscribe((state) => this.render(state.evidence));
  }

  deriveContext() {
    const state = this.store.getState();
    const additions = inferContextualEvidence({ detections: state.detections, evidence: state.evidence });
    if (additions.length) this.replace([...state.evidence, ...additions.map(createEvidence)]);
  }

  add(item) { this.replace([...this.store.getState().evidence, item]); }
  update(item) { this.replace(this.store.getState().evidence.map((entry) => entry.id === item.id ? item : entry)); }
  remove(id) { this.replace(this.store.getState().evidence.filter((item) => item.id !== id)); }
  replace(evidence) { this.store.setEvidence(evidence); this.annotation.setEvidence(evidence); this.onChange(); }

  decide(item, status) {
    const label = status === "confirmed" ? (CONFIRM_LABELS[item.label] ?? item.label) : item.label;
    this.update(updateEvidenceStatus({ ...item, label, canAffectAudit: status === "confirmed" }, status));
  }

  render(evidence = []) {
    this.list.replaceChildren();
    if (!evidence.length) this.list.append(createElement("p", { className: "empty-note", text: "Aucune preuve incertaine à confirmer." }));
    evidence.forEach((item) => {
      const card = createElement("article", { className: `evidence-card evidence-${item.status}` });
      card.append(createElement("span", { className: "evidence-level", text: title(item) }),
        createElement("strong", { text: item.label }), createElement("p", { text: item.explanation }));
      const actions = createElement("div", { className: "evidence-actions" });
      if (item.status === "candidate") {
        const confirm = createElement("button", { className: "button button-small", text: "Confirmer" });
        confirm.addEventListener("click", () => this.decide(item, "confirmed"));
        const reject = createElement("button", { className: "button button-small button-ghost", text: "Rejeter" });
        reject.addEventListener("click", () => this.decide(item, "rejected"));
        actions.append(confirm, reject);
      } else {
        const remove = createElement("button", { className: "button button-small button-ghost", text: "Supprimer" });
        remove.addEventListener("click", () => this.remove(item.id));
        actions.append(remove);
      }
      card.append(actions);
      this.list.append(card);
    });
  }
}
