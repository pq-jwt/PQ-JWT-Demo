/**
 * Minimal example: load hybrid composite keys from .env, sign a hybrid composite token, and verify it.
 *
 *   node scripts/sign-verify-env-hybrid-example.mjs
 *
 * Generate keys first:
 *   node scripts/one-time-setup.mjs
 */
import { webcrypto } from "node:crypto";
if (typeof globalThis.crypto === "undefined" || !globalThis.crypto.getRandomValues) {
  globalThis.crypto = webcrypto;
}

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { importCompositeKey, signComposite, verifyComposite } from "@pq-jwt/hybrid";

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

loadEnvFile(ENV_PATH);

const { PQ_HYBRID_PRIVATE_KEY, PQ_HYBRID_PUBLIC_KEY, PQ_HYBRID_ALGORITHM, JWT_ISSUER } = process.env;

if (!PQ_HYBRID_PRIVATE_KEY || !PQ_HYBRID_PUBLIC_KEY) {
  console.error("Missing PQ_HYBRID_PRIVATE_KEY or PQ_HYBRID_PUBLIC_KEY in .env");
  console.error("Run: node scripts/one-time-setup.mjs and update your .env");
  process.exit(1);
}

const algorithm = PQ_HYBRID_ALGORITHM || "ML-DSA-65-ES256";
const secretKey = importCompositeKey(PQ_HYBRID_PRIVATE_KEY);
console.log(secretKey,"secretKey")
const publicKey = importCompositeKey(PQ_HYBRID_PUBLIC_KEY);
console.log(publicKey,"publicKey")
const issuer = JWT_ISSUER || "pq-jwt-hybrid-example";

const token = signComposite(
  { userId: "hybrid-demo-user", role: "admin" },
  secretKey,
  {
    algorithm,
    expiresIn: "1h",
    issuer,
  },
);

console.log("Signed Hybrid Token (first 80 chars):", token.slice(0, 80) + "…");
console.log("Signed Hybrid Token:", token);
console.log("Token length:", token.length);

const { header, payload } = verifyComposite(token, publicKey, { issuer });

console.log("\nVerified Hybrid Header:", header);
console.log("Verified Hybrid Payload:", payload);
