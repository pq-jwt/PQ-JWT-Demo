#!/usr/bin/env node
/**
 * Full API smoke test. Usage:
 *   TOKEN='...' node scripts/test-all-apis.mjs
 *   node scripts/test-all-apis.mjs   # logs in as aud_test_user first
 */
const API = process.env.API_URL || "http://localhost:3006";
const AUD = process.env.TEST_AUDIENCE || "http://localhost:5173";
let TOKEN = process.env.TOKEN || "";

async function req(method, path, { body, token, origin } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (origin) headers.Origin = origin;

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
    data = { _raw: text?.slice(0, 200) };
  }
  return { status: res.status, data };
}

function ok(label, cond, extra = "") {
  const mark = cond ? "✓" : "✗";
  console.log(`${mark} ${label}${extra ? ` → ${extra}` : ""}`);
  return cond;
}

let passed = 0;
let failed = 0;
function check(label, cond, extra) {
  if (ok(label, cond, extra)) passed++;
  else failed++;
}

console.log(`\n=== PQ-JWT API test suite ===`);
console.log(`API: ${API}\n`);

// 1. Health
const health = await req("GET", "/api/health");
check("GET /api/health", health.status === 200, `issuer=${health.data?.jwt?.issuer}`);

// 2. Login (or use provided TOKEN)
if (!TOKEN) {
  const login = await req("POST", "/api/auth/login", {
    origin: AUD,
    body: {
      username: "aud_test_user",
      password: "secret123",
      clientOrigin: AUD,
    },
  });
  check("POST /api/auth/login", login.status === 200 && login.data?.token);
  TOKEN = login.data?.token || "";
  if (login.data?.audience) check("  token audience", login.data.audience === AUD, login.data.audience);
} else {
  const payload = JSON.parse(
    Buffer.from(TOKEN.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(),
  );
  check("Using provided TOKEN", true, `aud=${payload.aud}, user=${payload.username}`);
}

if (!TOKEN) {
  console.error("\nNo token available. Aborting.");
  process.exit(1);
}

// 3. Me
const me = await req("GET", "/api/auth/me", { token: TOKEN });
check("GET /api/auth/me", me.status === 200, me.data?.user?.username);

// 4. List items
const list = await req("GET", "/api/items", { token: TOKEN });
check("GET /api/items", list.status === 200, `${list.data?.items?.length ?? 0} item(s)`);

// 5. Create item
const create = await req("POST", "/api/items", {
  token: TOKEN,
  body: { title: "API test note", body: "Created by test-all-apis.mjs" },
});
check("POST /api/items", create.status === 201 && create.data?.item?.id);
const itemId = create.data?.item?.id;

// 6. Get one item
if (itemId) {
  const one = await req("GET", `/api/items/${itemId}`, { token: TOKEN });
  check("GET /api/items/:id", one.status === 200, one.data?.item?.title);

  // 7. Update
  const update = await req("PUT", `/api/items/${itemId}`, {
    token: TOKEN,
    body: { title: "Updated note", body: "Updated body" },
  });
  check("PUT /api/items/:id", update.status === 200, update.data?.item?.title);

  // 8. Delete
  const del = await req("DELETE", `/api/items/${itemId}`, { token: TOKEN });
  check("DELETE /api/items/:id", del.status === 204, "no content");

  const gone = await req("GET", `/api/items/${itemId}`, { token: TOKEN });
  check("GET deleted item → 404", gone.status === 404);
}

// 9. Bad token
const bad = await req("GET", "/api/auth/me", { token: "invalid.token.here" });
check("Invalid token → 401", bad.status === 401);

// 10. Login bad audience
const badLogin = await req("POST", "/api/auth/login", {
  body: {
    username: "aud_test_user",
    password: "secret123",
    clientOrigin: "http://evil.example.com",
  },
});
check("Login bad audience → 401", badLogin.status === 401);

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
