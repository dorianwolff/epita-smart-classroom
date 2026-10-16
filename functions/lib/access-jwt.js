const textEncoder = new TextEncoder();
const certificateCache = new Map();

function decodeBase64Url(value) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function parsePart(value) {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
}

function normalizeIssuer(domain) {
  const origin = domain.startsWith("https://") ? domain : `https://${domain}`;
  return origin.replace(/\/$/, "");
}

async function getJwks(issuer) {
  const cached = certificateCache.get(issuer);
  if (cached && cached.expiresAt > Date.now()) return cached.keys;
  const response = await fetch(`${issuer}/cdn-cgi/access/certs`);
  if (!response.ok) throw new Error("Access certificate lookup failed");
  const payload = await response.json();
  const keys = payload.keys ?? [];
  certificateCache.set(issuer, { keys, expiresAt: Date.now() + 10 * 60 * 1000 });
  return keys;
}

export async function verifyAccessJwt(token, { domain, audience, now = () => Math.floor(Date.now() / 1000) }) {
  if (!token || !domain || !audience) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const header = parsePart(parts[0]);
    const payload = parsePart(parts[1]);
    const issuer = normalizeIssuer(domain);
    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    const time = now();
    if (header.alg !== "RS256" || payload.iss !== issuer || !audiences.includes(audience) ||
      !payload.sub || payload.exp <= time || (payload.nbf && payload.nbf > time)) return null;
    const jwk = (await getJwks(issuer)).find((key) => key.kid === header.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, decodeBase64Url(parts[2]),
      textEncoder.encode(`${parts[0]}.${parts[1]}`));
    return valid ? Object.freeze({ ownerId: payload.sub, expiresAt: payload.exp }) : null;
  } catch { return null; }
}
