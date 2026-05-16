/** httpOnly session cookie (small UUID only — not the full PQ-JWT). */

export const SESSION_COOKIE_NAME = process.env.PQ_SESSION_COOKIE_NAME || "pq_session";

/** @deprecated use SESSION_COOKIE_NAME — old name stored full token and exceeded 4KB */
export const COOKIE_NAME = SESSION_COOKIE_NAME;

const MAX_AGE_SEC = Number(process.env.PQ_JWT_COOKIE_MAX_AGE_SEC || 86400);

function cookieSecure() {
  if (process.env.COOKIE_SECURE === "true") return true;
  if (process.env.COOKIE_SECURE === "false") return false;
  return process.env.NODE_ENV === "production";
}

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

export function getSessionIdFromCookies(req) {
  return parseCookies(req.headers.cookie)[SESSION_COOKIE_NAME] || null;
}

/** Set httpOnly session id cookie (UUID ~36 bytes). */
export function setSessionCookie(res, sessionId) {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId)}`,
    "Path=/",
    `Max-Age=${MAX_AGE_SEC}`,
    "HttpOnly",
    `SameSite=${process.env.COOKIE_SAME_SITE || "Lax"}`,
  ];
  if (cookieSecure()) parts.push("Secure");
  res.append("Set-Cookie", parts.join("; "));
}

export function clearSessionCookie(res) {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
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
