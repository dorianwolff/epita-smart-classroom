import { buildCloudAudit, exportAuditLocally } from "./audit-payload.js";
import { createCloudAuditService } from "./cloud-audit-service.js";
import { createElement } from "../utils/dom.js";

export class CloudController {
  constructor({ store, service = createCloudAuditService() }) {
    this.store = store;
    this.service = service;
    this.status = document.querySelector("#cloud-status");
    this.listElement = document.querySelector("#saved-audits");
    this.busy = false;
  }

  start() {
    document.querySelector("#save-cloud").addEventListener("click", () => this.save());
    document.querySelector("#refresh-cloud").addEventListener("click", () => this.list());
    document.querySelector("#export-local").addEventListener("click", () => exportAuditLocally(this.payload()));
    document.querySelector("#clear-local").addEventListener("click", () => this.store.update({ cloudRestoredAudit: null }));
  }

  payload() { return buildCloudAudit(this.store.getState(), document.querySelector("#room-name").value.trim()); }

  async save() {
    if (this.busy || !this.store.getState().audit?.analysed) return;
    this.busy = true;
    this.setStatus("Enregistrement sécurisé en cours…");
    try {
      const result = await this.service.save(this.payload());
      this.setStatus(`Audit enregistré · expiration ${new Date(result.expiresAt).toLocaleDateString("fr-FR")}`);
      await this.list();
    } catch (error) { this.setStatus(`${error.message} L’export local reste disponible.`, true); }
    finally { this.busy = false; }
  }

  async list() {
    this.setStatus("Chargement des audits enregistrés…");
    try {
      const { audits } = await this.service.list();
      this.listElement.replaceChildren();
      if (!audits.length) this.listElement.append(createElement("li", { text: "Aucun audit Cloudflare enregistré." }));
      audits.forEach((audit) => this.listElement.append(this.createRow(audit)));
      this.setStatus("Persistance Cloudflare disponible.");
    } catch (error) { this.setStatus(`${error.message} Le mode local continue de fonctionner.`, true); }
  }

  createRow(audit) {
    const row = createElement("li", { className: "saved-audit" });
    row.append(createElement("span", { text: `${audit.roomName || "Salle sans nom"} · ${new Date(audit.createdAt).toLocaleDateString("fr-FR")}` }));
    const open = createElement("button", { className: "button button-small", text: "Ouvrir" });
    open.addEventListener("click", async () => {
      try { const result = await this.service.get(audit.id); this.store.update({ cloudRestoredAudit: result.audit }); this.setStatus("Audit restauré en lecture structurée."); }
      catch (error) { this.setStatus(error.message, true); }
    });
    const remove = createElement("button", { className: "button button-small button-ghost", text: "Supprimer" });
    remove.addEventListener("click", async () => {
      try { await this.service.remove(audit.id); await this.list(); }
      catch (error) { this.setStatus(error.message, true); }
    });
    row.append(open, remove);
    return row;
  }

  setStatus(message, error = false) { this.status.textContent = message; this.status.dataset.error = String(error); }
}
