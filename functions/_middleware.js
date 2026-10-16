import { verifyAccessJwt } from "./lib/access-jwt.js";
import { apiError, withSecurityHeaders } from "./lib/response.js";

export async function onRequest(context) {
  if (!new URL(context.request.url).pathname.startsWith("/api/")) return withSecurityHeaders(await context.next());
  const token = context.request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) return apiError(401, "AUTH_REQUIRED", "Authentification Cloudflare Access requise.");
  const identity = await verifyAccessJwt(token, { domain: context.env.ACCESS_TEAM_DOMAIN, audience: context.env.ACCESS_AUD });
  if (!identity) return apiError(403, "AUTH_INVALID", "Jeton Cloudflare Access invalide ou expiré.");
  context.data.identity = identity;
  try { return withSecurityHeaders(await context.next()); }
  catch { return apiError(500, "INTERNAL_ERROR", "Erreur interne de persistance."); }
}
