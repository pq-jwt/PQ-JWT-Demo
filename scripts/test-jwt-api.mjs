#!/usr/bin/env node
/** Tests /api/jwt/* endpoints (decode, refresh, info) */
const API = process.env.API_URL || "http://localhost:3006";
const AUD = "http://localhost:5173";

async function req(method, path, { body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}

let ok = 0;
let fail = 0;
function check(label, cond) {
  console.log(`${cond ? "✓" : "✗"} ${label}`);
  cond ? ok++ : fail++;
}

console.log("\n=== JWT API routes test ===\n");

const info = await req("GET", "/api/jwt/info");
check("GET /api/jwt/info", info.status === 200 && info.data?.supportedAlgorithms?.length >= 4);

const login = await req("POST", "/api/auth/login", {
  body: {
    username: "aud_test_user",
    password: "secret123",
    clientOrigin: AUD,
  },
});
check("login for token", login.status === 200 && login.data?.token);
const token = login.data?.token;

const decoded = await req("POST", "/api/jwt/decode", { body: { token } });
check("POST /api/jwt/decode", decoded.status === 200 && decoded.data?.header?.typ === "PQ-JWT");
check("decode shows aud", decoded.data?.payload?.aud === AUD);

const refreshed = await req("POST", "/api/jwt/refresh", { token });
check("POST /api/jwt/refresh", refreshed.status === 200 && refreshed.data?.token);
check("refresh new token differs", refreshed.data?.token !== token);

const me = await req("GET", "/api/auth/me", { token: refreshed.data?.token });
check("refreshed token works on /me", me.status === 200);

console.log(`\n${ok} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
