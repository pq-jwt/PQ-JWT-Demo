/**
 * Integration test suite for @pq-jwt/express middleware demo.
 * Spins up the demo server at port 3008 programmatically, calls endpoints, and assertions.
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

console.log("=== Starting @pq-jwt/express Integration Tests ===\n");

// Spin up the demo server
const serverProcess = spawn("node", [SERVER_PATH]);

// Capture server output to verify it launched successfully
let serverStarted = false;

serverProcess.stdout.on("data", (data) => {
  const line = data.toString();
  if (line.includes("demo server active")) {
    serverStarted = true;
  }
});

// Wait up to 3 seconds for server to start
await new Promise((resolve) => {
  let elapsed = 0;
  const interval = setInterval(() => {
    elapsed += 200;
    if (serverStarted || elapsed >= 3000) {
      clearInterval(interval);
      resolve();
    }
  }, 200);
});

if (!serverStarted) {
  console.error("❌ Failed to start the express demo server.");
  serverProcess.kill();
  process.exit(1);
}

const BASE_URL = "http://localhost:3008";

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✓ ${message}`);
}

try {
  // Test 1: Healthcheck
  const infoRes = await fetch(`${BASE_URL}/api/info`);
  const infoData = await infoRes.json();
  assert(infoRes.ok, "GET /api/info returns 200");
  assert(infoData.library === "@pq-jwt/express", "GET /api/info reports correct middleware library");

  // Test 2: Login as Member
  const memberLogin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "member_bob", role: "member" })
  });
  const memberData = await memberLogin.json();
  assert(memberLogin.ok, "POST /api/auth/login as member returns 200");
  assert(typeof memberData.token === "string", "returns valid signed JWT token string");
  const memberToken = memberData.token;

  // Test 3: Login as Admin
  const adminLogin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin_alice", role: "admin" })
  });
  const adminData = await adminLogin.json();
  assert(adminLogin.ok, "POST /api/auth/login as admin returns 200");
  const adminToken = adminData.token;

  // Test 4: Member accessing member route (Profile)
  const memberProfileRes = await fetch(`${BASE_URL}/api/user/profile`, {
    headers: { "Authorization": `Bearer ${memberToken}` }
  });
  const memberProfileData = await memberProfileRes.json();
  assert(memberProfileRes.ok, "Member can access profile route");
  assert(memberProfileData.user.username === "member_bob", "Profile reports correct username claim");

  // Test 5: Member attempting to access admin route (Forbidden)
  const memberAdminRes = await fetch(`${BASE_URL}/api/admin/dashboard`, {
    headers: { "Authorization": `Bearer ${memberToken}` }
  });
  const memberAdminData = await memberAdminRes.json();
  assert(memberAdminRes.status === 403, "Member is rejected with 403 Forbidden from admin dashboard");
  assert(memberAdminData.code === "INSUFFICIENT_ROLE", "Rejection reports correct error code: INSUFFICIENT_ROLE");

  // Test 6: Admin accessing admin route (Allowed)
  const adminDashboardRes = await fetch(`${BASE_URL}/api/admin/dashboard`, {
    headers: { "Authorization": `Bearer ${adminToken}` }
  });
  const adminDashboardData = await adminDashboardRes.json();
  assert(adminDashboardRes.ok, "Admin can access admin dashboard route");
  assert(adminDashboardData.secretAdminData === "PQ-JWT-Express-Middleware-Is-Awesome", "Admin receives guarded secret payload");

  // Test 7: Unauthorized request without token
  const noTokenRes = await fetch(`${BASE_URL}/api/user/profile`);
  const noTokenData = await noTokenRes.json();
  assert(noTokenRes.status === 401, "No token request is rejected with 401 Unauthorized");
  assert(noTokenData.code === "MISSING_TOKEN", "Rejection reports correct error code: MISSING_TOKEN");

  console.log("\n🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY FOR @pq-jwt/express!");
  serverProcess.kill();
  process.exit(0);

} catch (err) {
  console.error(`\n❌ Tests failed: ${err.message}`);
  serverProcess.kill();
  process.exit(1);
}
