/**
 * Unified Example: Load and execute both standard PQ (Core) and Hybrid (Composite)
 * signing and verification using configurations from your .env file.
 *
 *   node scripts/sign-verify-env-example.mjs
 *
 * Generate keys first if you haven't already:
 *   node scripts/one-time-setup.mjs
 */
import { webcrypto } from "node:crypto";
if (typeof globalThis.crypto === "undefined" || !globalThis.crypto.getRandomValues) {
  globalThis.crypto = webcrypto;
}

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// 1. Import Core PQ-JWT functions
import { 
  importKey as importCoreKey, 
  sign as signCore, 
  verify as verifyCore 
} from "@pq-jwt/core";

// 2. Import Hybrid PQ-JWT functions
import { 
  importCompositeKey, 
  signComposite, 
  verifyComposite 
} from "@pq-jwt/hybrid";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, "..", ".env");

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

// Load env variables
loadEnvFile(ENV_PATH);

const {
  PQ_PRIVATE_KEY,
  PQ_PUBLIC_KEY,
  PQ_ALGORITHM,
  PQ_HYBRID_PRIVATE_KEY,
  PQ_HYBRID_PUBLIC_KEY,
  PQ_HYBRID_ALGORITHM,
  JWT_ISSUER,
} = process.env;

const issuer = JWT_ISSUER || "https://auth.yourdomain.com";
const testPayload = { userId: "demo-user-123", role: "admin", email: "user@example.com" };

console.log("\n============================================================");
console.log("   PQ-JWT UNIFIED INTEGRATION: CORE & HYBRID SPECIFICATION  ");
console.log("============================================================\n");

// ==========================================
// PHASE 1: STANDARD POST-QUANTUM (CORE)
// ==========================================
console.log("─── PHASE 1: Standard Post-Quantum (@pq-jwt/core) ───");
if (!PQ_PRIVATE_KEY || !PQ_PUBLIC_KEY) {
  console.log("⚠️  Skipping: PQ_PRIVATE_KEY or PQ_PUBLIC_KEY not found in .env\n");
} else {
  const coreAlg = PQ_ALGORITHM || "ML-DSA-65";
  const coreSk = importCoreKey(PQ_PRIVATE_KEY);
  const corePk = importCoreKey(PQ_PUBLIC_KEY);

  console.log(`🔑 Core Algorithm:  ${coreAlg}`);
  console.log(`🔑 Key Size (SK):  ${coreSk.length} bytes`);
  console.log(`🔑 Key Size (PK):  ${corePk.length} bytes`);

  const coreToken = signCore(testPayload, coreSk, {
    algorithm: coreAlg,
    expiresIn: "1h",
    issuer,
  });

  console.log(`📝 Generated Token: ${coreToken.slice(0, 75)}...`);
  console.log(`📝 Token Length:    ${coreToken.length} characters`);

  const verifiedCore = verifyCore(coreToken, corePk, { issuer });
  console.log("✅ Verification:    SUCCESS");
  console.log("📝 Verified Header:", verifiedCore.header);
  console.log("📝 Verified Claims:", verifiedCore.payload);
  console.log("\n------------------------------------------------------------\n");
}

// ==========================================
// PHASE 2: COMPOSITE PQ-CLASSICAL (HYBRID)
// ==========================================
console.log("─── PHASE 2: Composite PQ-Classical (@pq-jwt/hybrid) ───");
if (!PQ_HYBRID_PRIVATE_KEY || !PQ_HYBRID_PUBLIC_KEY) {
  console.log("⚠️  Skipping: PQ_HYBRID_PRIVATE_KEY or PQ_HYBRID_PUBLIC_KEY not found in .env\n");
} else {
  const hybridAlg = PQ_HYBRID_ALGORITHM || "ML-DSA-65-ES256";
  const hybridSk = importCompositeKey(PQ_HYBRID_PRIVATE_KEY);
  const hybridPk = importCompositeKey(PQ_HYBRID_PUBLIC_KEY);

  console.log(`🔑 Hybrid Algorithm: ${hybridAlg}`);
  console.log(`🔑 Key Size (SK):   ${hybridSk.length} bytes`);
  console.log(`🔑 Key Size (PK):   ${hybridPk.length} bytes`);

  const hybridToken = signComposite(testPayload, hybridSk, {
    algorithm: hybridAlg,
    expiresIn: "1h",
    issuer,
  });

  console.log(`📝 Generated Token:  ${hybridToken.slice(0, 75)}...`);
  console.log(`📝 Token Length:     ${hybridToken.length} characters`);

  const verifiedHybrid = verifyComposite(hybridToken, hybridPk, { issuer });
  console.log("✅ Verification:     SUCCESS");
  console.log("📝 Verified Header: ", verifiedHybrid.header);
  console.log("📝 Verified Claims: ", verifiedHybrid.payload);
  console.log("\n============================================================\n");
}
