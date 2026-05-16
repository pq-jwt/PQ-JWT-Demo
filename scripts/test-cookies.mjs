#!/usr/bin/env node
/**
 * Cookie + Bearer auth tests. Requires API on :3006 and MongoDB.
 * Usage: node scripts/test-cookies.mjs
 */
const API = process.env.API_URL || "http://localhost:3006";
const AUD = process.env.TEST_AUDIENCE || "http://localhost:5173";
const USER = process.env.TEST_USER || "aud_test_user";
const PASS = process.env.TEST_PASS || "secret123";

function parseSetCookie(res) {
  const raw = res.headers.getSetCookie?.() ?? [];
  if (raw.length) return raw.join("; ");
  const single = res.headers.get("set-cookie");
  return single || "";
}

function cookieValue(setCookieHeader, name = "pq_jwt") {
  if (!setCookieHeader) return null;
  const match = setCookieHeader.match(new RegExp(`${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function login(authMode) {
  const res = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: AUD,
    },
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

async function req(path, { method = "GET", cookie, token, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cookie) headers.Cookie = cookie.includes("pq_jwt=") ? cookie : `pq_jwt=${cookie}`;
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

console.log("\n=== PQ-JWT cookie auth tests ===\n");
console.log(`API: ${API}  audience: ${AUD}\n`);

const health = await req("/api/health");
check("GET /api/health has cookie config", health.status === 200 && health.data?.cookie?.name === "pq_jwt");

const bearerLogin = await login("bearer");
check("login bearer → token, no cookie required in body", bearerLogin.status === 200 && bearerLogin.data?.token);
check("login bearer has no pq_jwt in Set-Cookie", !cookieValue(bearerLogin.setCookie));

const meBearer = await req("/api/auth/me", { token: bearerLogin.data.token });
check("GET /me with Bearer", meBearer.status === 200, meBearer.data?.user?.username);

const cookieLogin = await login("cookie");
check("login cookie → 200", cookieLogin.status === 200);
check("login cookie omits token in JSON", !cookieLogin.data?.token);
const pqCookie = cookieValue(cookieLogin.setCookie);
check("login cookie sets pq_jwt Set-Cookie", !!pqCookie);

const meCookie = await req("/api/auth/me", { cookie: pqCookie });
check("GET /me with cookie only", meCookie.status === 200, meCookie.data?.user?.username);

const bothLogin = await login("both");
check("login both → token + cookie", bothLogin.status === 200 && bothLogin.data?.token && cookieValue(bothLogin.setCookie));

const itemsCookie = await req("/api/items", { cookie: pqCookie });
check("GET /items with cookie", itemsCookie.status === 200);

const logout = await req("/api/auth/logout", { method: "POST", cookie: pqCookie });
check("POST /api/auth/logout", logout.status === 200);
check(
  "logout Set-Cookie clears pq_jwt",
  /pq_jwt=;|Max-Age=0/i.test(logout.setCookie || ""),
);

const meNoCookie = await req("/api/auth/me");
check("GET /me without cookie → 401", meNoCookie.status === 401);

console.log(`\n=== ${ok} passed, ${fail} failed ===\n`);
process.exit(fail > 0 ? 1 : 0);
