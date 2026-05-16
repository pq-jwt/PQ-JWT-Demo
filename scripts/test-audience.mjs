#!/usr/bin/env node
/**
 * Tests JWT audience (aud) binding.
 * Run while API is up: node scripts/test-audience.mjs
 */
const API = process.env.API_URL || "http://localhost:3006";
const AUD = process.env.TEST_AUDIENCE || "http://localhost:5173";
const BAD_AUD = "http://evil.example.com";

async function request(path, options = {}) {
  const res = await fetch(`${API}${path}`, options);
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  return { status: res.status, data };
}

function assert(label, cond, detail = "") {
  const ok = cond ? "PASS" : "FAIL";
  console.log(`${ok}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!cond) process.exitCode = 1;
}

console.log(`API: ${API}`);
console.log(`Expected aud: ${AUD}\n`);

const health = await request("/api/health");
assert("health ok", health.status === 200 && health.data?.jwt?.allowedAudiences?.includes(AUD));

const loginOk = await request("/api/auth/login", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Origin: AUD,
  },
  body: JSON.stringify({
    username: "aud_test_user",
    password: "secret123",
    clientOrigin: AUD,
  }),
});

if (loginOk.status === 401 && loginOk.data?.error?.includes("Invalid username")) {
  const reg = await request("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "aud_test_user", password: "secret123" }),
  });
  assert("register test user", reg.status === 201 || reg.status === 400);
}

const login = await request("/api/auth/login", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Origin: AUD,
  },
  body: JSON.stringify({
    username: "aud_test_user",
    password: "secret123",
    clientOrigin: AUD,
  }),
});

assert("login with valid audience", login.status === 200 && login.data?.token);
assert("login returns audience", login.data?.audience === AUD);

const token = login.data?.token;
if (!token) {
  console.error("No token; stopping.");
  process.exit(1);
}

const me = await request("/api/auth/me", {
  headers: { Authorization: `Bearer ${token}` },
});
assert("/api/auth/me", me.status === 200);

const loginBad = await request("/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    username: "aud_test_user",
    password: "secret123",
    clientOrigin: BAD_AUD,
  }),
});
assert("reject bad audience at login", loginBad.status === 401);

const loginNoAud = await request("/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    username: "aud_test_user",
    password: "secret123",
  }),
});
assert("reject login without audience", loginNoAud.status === 401);

console.log("\nDone.");
