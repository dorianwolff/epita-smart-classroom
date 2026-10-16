import { parseAudit } from "../../lib/audit-records.js";
import { prepareDatabase } from "../../lib/database.js";
import { checkWriteRequest, readJson } from "../../lib/request.js";
import { apiError, apiResponse } from "../../lib/response.js";

const SELECT_AUDIT = `SELECT id, room_name, expected_configuration_json, confirmed_counts_json, detector_versions_json,
  sound_summary_json, anomaly_summary_json, threshold, report_schema_version, app_version, version, created_at, updated_at, expires_at
  FROM audits WHERE id = ? AND owner_id = ?`;

export async function onRequestGet(context) {
  const prepared = await prepareDatabase(context);
  if (prepared.error) return prepared.error;
  const id = context.params.id;
  const record = await prepared.database.prepare(SELECT_AUDIT).bind(id, prepared.owner).first();
  if (!record) return apiError(404, "NOT_FOUND", "Audit introuvable.");
  const [items, measurements, confirmations] = await prepared.database.batch([
    prepared.database.prepare("SELECT category, quantity, evidence_type FROM audit_items WHERE audit_id = ? AND owner_id = ? ORDER BY category").bind(id, prepared.owner),
    prepared.database.prepare("SELECT metric, value_text FROM audit_measurements WHERE audit_id = ? AND owner_id = ? ORDER BY metric").bind(id, prepared.owner),
    prepared.database.prepare("SELECT label, evidence_type, status, geometry_json, explanation FROM audit_confirmations WHERE audit_id = ? AND owner_id = ? ORDER BY created_at").bind(id, prepared.owner)
  ]);
  return apiResponse({ audit: parseAudit(record, items.results ?? [], measurements.results ?? [], confirmations.results ?? []) });
}

export async function onRequestPut(context) {
  const invalidRequest = checkWriteRequest(context.request);
  if (invalidRequest) return invalidRequest;
  const parsed = await readJson(context.request, 4096);
  if (parsed.error) return parsed.error;
  const { version, roomName } = parsed.value ?? {};
  if (!Number.isInteger(version) || typeof roomName !== "string" || roomName.length > 120 ||
    Object.keys(parsed.value).some((key) => !["version", "roomName"].includes(key))) return apiError(422, "VALIDATION", "Mise à jour invalide.");
  const prepared = await prepareDatabase(context);
  if (prepared.error) return prepared.error;
  const result = await prepared.database.prepare(`UPDATE audits SET room_name = ?, version = version + 1, updated_at = ?
    WHERE id = ? AND owner_id = ? AND version = ?`).bind(roomName || null, prepared.now, context.params.id, prepared.owner, version).run();
  if (!result.meta?.changes) {
    const exists = await prepared.database.prepare("SELECT version FROM audits WHERE id = ? AND owner_id = ?").bind(context.params.id, prepared.owner).first();
    return exists ? apiError(409, "VERSION_CONFLICT", "L’audit a été modifié ailleurs.") : apiError(404, "NOT_FOUND", "Audit introuvable.");
  }
  return apiResponse({ id: context.params.id, version: version + 1, updatedAt: prepared.now });
}

export async function onRequestDelete(context) {
  const origin = context.request.headers.get("Origin");
  if (origin !== new URL(context.request.url).origin || context.request.headers.get("X-SalleScope-Request") !== "1") {
    return apiError(403, "ORIGIN_REJECTED", "Origine de requête refusée.");
  }
  const prepared = await prepareDatabase(context);
  if (prepared.error) return prepared.error;
  const result = await prepared.database.prepare("DELETE FROM audits WHERE id = ? AND owner_id = ?").bind(context.params.id, prepared.owner).run();
  if (!result.meta?.changes) return apiError(404, "NOT_FOUND", "Audit introuvable.");
  return apiResponse(null, 204);
}
