import { apiError } from "./response.js";

export async function prepareDatabase(context, { rateLimit = true } = {}) {
  const database = context.env.SALLE_SCOPE_DB;
  if (!database) return { error: apiError(503, "D1_UNAVAILABLE", "Persistance Cloudflare indisponible.") };
  const owner = context.data.identity.ownerId;
  const now = new Date().toISOString();
  await database.prepare("DELETE FROM audits WHERE owner_id = ? AND expires_at <= ?").bind(owner, now).run();
  if (rateLimit) {
    const windowStart = new Date(Math.floor(Date.now() / 60000) * 60000).toISOString();
    await database.prepare(`INSERT INTO api_rate_limits(owner_id, window_start, request_count) VALUES (?, ?, 1)
      ON CONFLICT(owner_id) DO UPDATE SET window_start = excluded.window_start,
      request_count = CASE WHEN api_rate_limits.window_start = excluded.window_start THEN api_rate_limits.request_count + 1 ELSE 1 END`)
      .bind(owner, windowStart).run();
    const record = await database.prepare("SELECT request_count FROM api_rate_limits WHERE owner_id = ?").bind(owner).first();
    if (record?.request_count > 60) return { error: apiError(429, "RATE_LIMIT", "Trop de requêtes. Réessayez dans une minute.") };
  }
  return { database, owner, now };
}
