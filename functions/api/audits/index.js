import { validateAuditPayload } from "../../lib/audit-schema.js";
import { auditStatements } from "../../lib/audit-records.js";
import { prepareDatabase } from "../../lib/database.js";
import { checkWriteRequest, readJson } from "../../lib/request.js";
import { apiError, apiResponse } from "../../lib/response.js";

export async function onRequestGet(context) {
  const prepared = await prepareDatabase(context);
  if (prepared.error) return prepared.error;
  const url = new URL(context.request.url);
  const limit = Math.min(50, Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "20", 10) || 20));
  const cursor = url.searchParams.get("cursor") ?? "9999-12-31T23:59:59.999Z";
  const result = await prepared.database.prepare(`SELECT id, room_name, version, created_at, updated_at, expires_at
    FROM audits WHERE owner_id = ? AND created_at < ? ORDER BY created_at DESC LIMIT ?`)
    .bind(prepared.owner, cursor, limit + 1).all();
  const rows = result.results ?? [];
  const hasMore = rows.length > limit;
  const audits = rows.slice(0, limit).map((row) => ({ id: row.id, roomName: row.room_name, version: row.version,
    createdAt: row.created_at, updatedAt: row.updated_at, expiresAt: row.expires_at }));
  return apiResponse({ audits, nextCursor: hasMore ? audits.at(-1).createdAt : null });
}

export async function onRequestPost(context) {
  const invalidRequest = checkWriteRequest(context.request);
  if (invalidRequest) return invalidRequest;
  const idempotencyKey = context.request.headers.get("Idempotency-Key");
  if (!idempotencyKey || idempotencyKey.length > 100) return apiError(422, "IDEMPOTENCY_KEY", "Clé d’idempotence requise.");
  const parsed = await readJson(context.request);
  if (parsed.error) return parsed.error;
  const validation = validateAuditPayload(parsed.value);
  if (validation) return apiError(422, "VALIDATION", validation);
  const prepared = await prepareDatabase(context);
  if (prepared.error) return prepared.error;
  const existing = await prepared.database.prepare("SELECT id, version, created_at FROM audits WHERE owner_id = ? AND idempotency_key = ?")
    .bind(prepared.owner, idempotencyKey).first();
  if (existing) return apiResponse({ id: existing.id, version: existing.version, createdAt: existing.created_at, idempotent: true }, 200);
  const id = crypto.randomUUID();
  const retention = Math.min(365, Math.max(1, Number.parseInt(context.env.AUDIT_RETENTION_DAYS ?? "90", 10) || 90));
  const expiresAt = new Date(Date.now() + retention * 86400000).toISOString();
  try {
    await prepared.database.batch(auditStatements(prepared.database, { id, owner: prepared.owner, payload: parsed.value,
      idempotencyKey, now: prepared.now, expiresAt }));
  } catch (error) {
    if (String(error).includes("UNIQUE")) return apiError(409, "CONFLICT", "Conflit de création.");
    throw error;
  }
  return apiResponse({ id, version: 1, createdAt: prepared.now, expiresAt }, 201);
}
