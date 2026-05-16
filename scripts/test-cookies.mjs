#!/usr/bin/env node
/**
 * Session cookie + Bearer auth tests. Requires API on :3006 and MongoDB.
 */
const API = process.env.API_URL || "http://localhost:3006";
const AUD = process.env.TEST_AUDIENCE || "http://localhost:5173";
const USER = process.env.TEST_USER || "aud_test_user";
const PASS = process.env.TEST_PASS || "secret123";
const SESSION_COOKIE = "pq_session";

function parseSetCookie(res) {
  const raw = res.headers.getSetCookie?.() ?? [];
  if (raw.length) return raw.join("; ");
  return res.headers.get("set-cookie") || "";
}

function cookieValue(setCookieHeader, name = SESSION_COOKIE) {
  if (!setCookieHeader) return null;
  const match = setCookieHeader.match(new RegExp(`${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function login(authMode) {
  const res = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: AUD },
    body: JSON.stringify({
      username: USER,
      password: PASS,
      clientOrigin: AUD,
      authMode,
    }),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, setCookie: parseSetCookie(res) };
}

async function req(path, { method = "GET", sessionId, token, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (sessionId) headers.Cookie = `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { _raw: text?.slice(0, 120) };
  }
  return { status: res.status, data, setCookie: parseSetCookie(res) };
}

let ok = 0;
let fail = 0;
function check(label, cond, extra = "") {
  console.log(`${cond ? "✓" : "✗"} ${label}${extra ? ` → ${extra}` : ""}`);
  cond ? ok++ : fail++;
}

console.log("\n=== PQ-JWT session cookie tests ===\n");
console.log(`API: ${API}  audience: ${AUD}\n`);

const health = await req("/api/health");
check(
  "GET /api/health → pq_session cookie config",
  health.status === 200 && health.data?.cookie?.name === SESSION_COOKIE,
);

const bearerLogin = await login("bearer");
check("login bearer → token in JSON", bearerLogin.status === 200 && bearerLogin.data?.token);
check("login bearer → no pq_session cookie", !cookieValue(bearerLogin.setCookie));

const meBearer = await req("/api/auth/me", { token: bearerLogin.data.token });
check("GET /me with Bearer", meBearer.status === 200, meBearer.data?.user?.username);

const cookieLogin = await login("cookie");
check("login cookie → 200", cookieLogin.status === 200);
check("login cookie omits token in JSON", !cookieLogin.data?.token);
const sessionId = cookieValue(cookieLogin.setCookie);
check(
  "login cookie sets pq_session (UUID)",
  !!sessionId && sessionId.length >= 32 && sessionId.length <= 40,
  `${sessionId?.length ?? 0} chars`,
);
check("session id fits cookie limit", (sessionId?.length ?? 0) < 4096);

const meCookie = await req("/api/auth/me", { sessionId });
check("GET /me with pq_session only", meCookie.status === 200, meCookie.data?.user?.username);

const bothLogin = await login("both");
check(
  "login both → token + pq_session",
  bothLogin.status === 200 && bothLogin.data?.token && cookieValue(bothLogin.setCookie),
);

const itemsCookie = await req("/api/items", { sessionId });
check("GET /items with pq_session", itemsCookie.status === 200);

const logout = await req("/api/auth/logout", { method: "POST", sessionId });
check("POST /api/auth/logout", logout.status === 200);
check(
  "logout clears pq_session",
  /pq_session=;|Max-Age=0/i.test(logout.setCookie || ""),
);

const meAfterLogout = await req("/api/auth/me", { sessionId });
check("GET /me after logout → 401", meAfterLogout.status === 401);

console.log(`\n=== ${ok} passed, ${fail} failed ===\n`);
process.exit(fail > 0 ? 1 : 0);
