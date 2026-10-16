import { SECURITY_HEADERS } from "../../src/security/security-headers.js";

export function apiResponse(body, status = 200, extraHeaders = {}) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { ...SECURITY_HEADERS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store, private",
      "Access-Control-Allow-Origin": "null", ...extraHeaders }
  });
}

export function apiError(status, code, message) {
  return apiResponse({ error: { code, message } }, status);
}

export function withSecurityHeaders(response) {
  const next = new Response(response.body, response);
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => next.headers.set(key, value));
  if (next.headers.get("Content-Type")?.includes("application/json")) next.headers.set("Cache-Control", "no-store, private");
  return next;
}
