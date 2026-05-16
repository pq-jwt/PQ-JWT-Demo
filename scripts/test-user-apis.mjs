#!/usr/bin/env node
/**
 * Test protected APIs with a Bearer token.
 * Usage:
 *   TOKEN="$(cat scripts/.test-token)" node scripts/test-user-apis.mjs
 *   node scripts/test-user-apis.mjs scripts/.test-token
 */
import { readFileSync } from "node:fs";

const API = process.env.API_URL || "http://localhost:3006";
const tokenFile = process.argv[2] || process.env.TOKEN_FILE;
const TOKEN = (
  process.env.TOKEN ||
  (tokenFile ? readFileSync(tokenFile, "utf8") : "") ||
  ""
).trim();

if (!TOKEN) {
  console.error("Set TOKEN, TOKEN_FILE, or pass a file path with the JWT.");
  process.exit(1);
}

const payload = JSON.parse(
  Buffer.from(TOKEN.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(),
);

async function req(method, path, { body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
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
  return { status: res.status, data };
}

function line(name, r) {
  const ok = r.status >= 200 && r.status < 300;
  const mark = ok ? "✓" : "✗";
  const detail =
    r.data?.error ||
    r.data?.user?.username ||
    (Array.isArray(r.data?.items) ? `${r.data.items.length} item(s)` : null) ||
    r.data?.item?.title ||
    r.data?.audience ||
    (r.status === 204 ? "no content" : JSON.stringify(r.data)?.slice(0, 80));
  console.log(`${mark} ${name} → ${r.status} ${detail ?? ""}`);
  return ok;
}

console.log(`\n=== API tests (user token) ===`);
console.log(`API: ${API}`);
console.log(`user: ${payload.username}, aud: ${payload.aud}, exp: ${payload.exp}\n`);

let ok = 0;
let fail = 0;
function check(name, r) {
  if (line(name, r)) ok++;
  else fail++;
}

check("GET /api/health", await req("GET", "/api/health"));
check("GET /api/jwt/info", await req("GET", "/api/jwt/info"));
check(
  "POST /api/jwt/decode",
  await req("POST", "/api/jwt/decode", { body: { token: TOKEN } }),
);
check("GET /api/auth/me", await req("GET", "/api/auth/me", { token: TOKEN }));
check("GET /api/items", await req("GET", "/api/items", { token: TOKEN }));

const created = await req("POST", "/api/items", {
  token: TOKEN,
  body: { title: "PQ-JWT test note", body: "Created by test-user-apis.mjs" },
});
if (line("POST /api/items", created)) {
  ok++;
  const id = created.data?.item?.id;
  if (id) {
    check("GET /api/items/:id", await req("GET", `/api/items/${id}`, { token: TOKEN }));
    check(
      "PUT /api/items/:id",
      await req("PUT", `/api/items/${id}`, {
        token: TOKEN,
        body: { title: "Updated PQ note", body: "updated" },
      }),
    );
    const del = await req("DELETE", `/api/items/${id}`, { token: TOKEN });
    if (line("DELETE /api/items/:id", del)) ok++;
    else fail++;
  }
} else {
  fail++;
}

const refresh = await req("POST", "/api/jwt/refresh", { token: TOKEN });
if (line("POST /api/jwt/refresh", refresh)) ok++;
else fail++;

const badBody = await req("POST", "/api/jwt/refresh", {
  body: { token: TOKEN },
});
if (badBody.status === 401) {
  console.log("✓ POST /api/jwt/refresh (body only) → 401 (expected)");
  ok++;
} else {
  console.log(`✗ POST /api/jwt/refresh (body only) → ${badBody.status} (expected 401)`);
  fail++;
}

console.log(`\n=== ${ok} passed, ${fail} failed ===\n`);
process.exit(fail > 0 ? 1 : 0);
