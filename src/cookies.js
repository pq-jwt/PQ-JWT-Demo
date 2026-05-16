/** PQ-JWT httpOnly cookie helpers (demo + client/server testing). */

export const COOKIE_NAME = process.env.PQ_JWT_COOKIE_NAME || "pq_jwt";

const MAX_AGE_SEC = Number(process.env.PQ_JWT_COOKIE_MAX_AGE_SEC || 86400); // 24h

function cookieSecure() {
  if (process.env.COOKIE_SECURE === "true") return true;
  if (process.env.COOKIE_SECURE === "false") return false;
  return process.env.NODE_ENV === "production";
}

/** Parse Cookie header into a plain object. */
export function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};
  const out = {};
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  }
  return out;
}

export function getTokenFromCookies(req) {
  return parseCookies(req.headers.cookie)[COOKIE_NAME] || null;
}

/** Set httpOnly PQ-JWT cookie after login / refresh. */
export function setAuthCookie(res, token) {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    `Max-Age=${MAX_AGE_SEC}`,
    "HttpOnly",
    `SameSite=${process.env.COOKIE_SAME_SITE || "Lax"}`,
  ];
  if (cookieSecure()) parts.push("Secure");
  res.append("Set-Cookie", parts.join("; "));
}

export function clearAuthCookie(res) {
  const parts = [
    `${COOKIE_NAME}=`,
    "Path=/",
    "Max-Age=0",
    "HttpOnly",
    `SameSite=${process.env.COOKIE_SAME_SITE || "Lax"}`,
  ];
  if (cookieSecure()) parts.push("Secure");
  res.append("Set-Cookie", parts.join("; "));
}

/** bearer | cookie | both */
export function normalizeAuthMode(mode) {
  const m = String(mode || "both").toLowerCase();
  if (m === "bearer" || m === "cookie" || m === "both") return m;
  return "both";
}
