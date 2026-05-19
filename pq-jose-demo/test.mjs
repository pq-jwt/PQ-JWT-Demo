/**
 * Integration tests for @pq-jose/jose demo (port 3009).
 */
import { webcrypto } from "node:crypto";
if (typeof globalThis.crypto === "undefined" || !globalThis.crypto.getRandomValues) {
  globalThis.crypto = webcrypto;
}

import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = join(__dirname, "server.js");
const BASE_URL = "http://localhost:3009";

console.log("=== Starting @pq-jose/jose Integration Tests ===\n");

const serverProcess = spawn("node", [SERVER_PATH], {
  env: { ...process.env, PORT: "3009" },
});

let serverStarted = false;
serverProcess.stdout.on("data", (data) => {
  if (data.toString().includes("demo server active")) serverStarted = true;
});

await new Promise((resolve) => {
  let elapsed = 0;
  const interval = setInterval(() => {
    elapsed += 200;
    if (serverStarted || elapsed >= 5000) {
      clearInterval(interval);
      resolve();
    }
  }, 200);
});

if (!serverStarted) {
  console.error("❌ Failed to start pq-jose demo server.");
  serverProcess.kill();
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
  console.log(`✓ ${message}`);
}

try {
  const infoRes = await fetch(`${BASE_URL}/api/info`);
  const info = await infoRes.json();
  assert(infoRes.ok, "GET /api/info returns 200");
  assert(info.library === "@pq-jose/jose", "reports @pq-jose/jose library");

  const memberLogin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "member_bob", role: "member" }),
  });
  const memberData = await memberLogin.json();
  assert(memberLogin.ok, "POST /api/auth/login (member)");
  assert(typeof memberData.token === "string" && memberData.token.length > 20, "returns JWS token");
  const memberToken = memberData.token;

  const adminLogin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin_alice", role: "admin" }),
  });
  const adminData = await adminLogin.json();
  assert(adminLogin.ok, "POST /api/auth/login (admin)");
  const adminToken = adminData.token;

  const profileRes = await fetch(`${BASE_URL}/api/user/profile`, {
    headers: { Authorization: `Bearer ${memberToken}` },
  });
  const profile = await profileRes.json();
  assert(profileRes.ok, "Member jwtVerify profile OK");
  assert(profile.user.username === "member_bob", "Profile has username claim");

  const memberAdminRes = await fetch(`${BASE_URL}/api/admin/dashboard`, {
    headers: { Authorization: `Bearer ${memberToken}` },
  });
  const memberAdmin = await memberAdminRes.json();
  assert(memberAdminRes.status === 403, "Member blocked from admin route");
  assert(memberAdmin.code === "INSUFFICIENT_ROLE", "INSUFFICIENT_ROLE code");

  const adminDashRes = await fetch(`${BASE_URL}/api/admin/dashboard`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const adminDash = await adminDashRes.json();
  assert(adminDashRes.ok, "Admin dashboard OK");
  assert(adminDash.secretAdminData === "PQ-JOSE-jwtVerify-Works", "Admin secret payload");

  const encRes = await fetch(`${BASE_URL}/api/jwe/encrypt`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${memberToken}`,
    },
    body: JSON.stringify({ plaintext: "classified-pq-data" }),
  });
  const enc = await encRes.json();
  assert(encRes.ok, "POST /api/jwe/encrypt OK");
  assert(typeof enc.token === "string" && enc.token.split(".").length === 5, "JWE has 5 parts");

  const decRes = await fetch(`${BASE_URL}/api/jwe/decrypt`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${memberToken}`,
    },
    body: JSON.stringify({ token: enc.token }),
  });
  const dec = await decRes.json();
  assert(decRes.ok, "POST /api/jwe/decrypt OK");
  assert(dec.payload.secret === "classified-pq-data", "JWE payload matches plaintext");

  const noTokenRes = await fetch(`${BASE_URL}/api/user/profile`);
  const noToken = await noTokenRes.json();
  assert(noTokenRes.status === 401, "No token → 401");
  assert(noToken.code === "MISSING_TOKEN", "MISSING_TOKEN code");

  console.log("\n🎉 ALL INTEGRATION TESTS PASSED FOR @pq-jose/jose!");
  serverProcess.kill();
  process.exit(0);
} catch (err) {
  console.error(`\n❌ Tests failed: ${err.message}`);
  serverProcess.kill();
  process.exit(1);
}
