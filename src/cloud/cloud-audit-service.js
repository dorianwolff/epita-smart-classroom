async function request(path, options = {}) {
  const response = await fetch(path, { credentials: "same-origin", ...options,
    headers: { ...(options.body ? { "Content-Type": "application/json", "X-SalleScope-Request": "1" } : {}), ...(options.headers ?? {}) } });
  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(payload?.error?.message ?? "Cloudflare indisponible.");
    error.status = response.status;
    error.code = payload?.error?.code ?? "CLOUD_UNAVAILABLE";
    throw error;
  }
  return payload;
}

export function createCloudAuditService() {
  return {
    health: () => request("./api/health"),
    list: (cursor = null) => request(`./api/audits${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`),
    get: (id) => request(`./api/audits/${encodeURIComponent(id)}`),
    save: (audit, idempotencyKey = crypto.randomUUID()) => request("./api/audits", { method: "POST",
      headers: { "Idempotency-Key": idempotencyKey }, body: JSON.stringify(audit) }),
    rename: (id, version, roomName) => request(`./api/audits/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify({ version, roomName }) }),
    remove: (id) => request(`./api/audits/${encodeURIComponent(id)}`, { method: "DELETE",
      headers: { "X-SalleScope-Request": "1" } })
  };
}
