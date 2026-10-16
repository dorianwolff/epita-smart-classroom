import { apiError } from "./response.js";

export function checkWriteRequest(request) {
  const origin = request.headers.get("Origin");
  const expected = new URL(request.url).origin;
  if (origin !== expected) return apiError(403, "ORIGIN_REJECTED", "Origine de requête refusée.");
  if (request.headers.get("X-SalleScope-Request") !== "1") return apiError(403, "CSRF_HEADER_MISSING", "En-tête de requête manquant.");
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) {
    return apiError(422, "CONTENT_TYPE", "Content-Type application/json requis.");
  }
  return null;
}

export async function readJson(request, maximumBytes = 65536) {
  const declared = Number(request.headers.get("Content-Length") ?? 0);
  if (declared > maximumBytes) return { error: apiError(413, "BODY_TOO_LARGE", "Requête trop volumineuse.") };
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maximumBytes) return { error: apiError(413, "BODY_TOO_LARGE", "Requête trop volumineuse.") };
  try { return { value: JSON.parse(text) }; }
  catch { return { error: apiError(422, "INVALID_JSON", "JSON invalide.") }; }
}
