/**
 * Run once per environment to generate both PQ (Core) and Hybrid key pairs and print .env lines.
 *
 *   node scripts/one-time-setup.mjs
 */
import { webcrypto } from "node:crypto";
if (typeof globalThis.crypto === "undefined" || !globalThis.crypto.getRandomValues) {
  globalThis.crypto = webcrypto;
}

import { generateKeyPair, exportKey } from "@pq-jwt/core";
import { generateCompositeKeyPair, exportCompositeKey } from "@pq-jwt/hybrid";

const coreAlg = "ML-DSA-65";
const hybridAlg = "ML-DSA-65-ES256";

const coreKp = generateKeyPair(coreAlg);
const hybridKp = generateCompositeKeyPair(hybridAlg);

console.log("--- Add these lines to your .env file ---\n");
console.log("# === @pq-jwt/core Configuration ===");
console.log(`PQ_ALGORITHM=${coreKp.algorithm}`);
console.log(`PQ_PUBLIC_KEY=${exportKey(coreKp.publicKey)}`);
console.log(`PQ_PRIVATE_KEY=${exportKey(coreKp.secretKey)}`);

console.log("\n# === @pq-jwt/hybrid Configuration ===");
console.log(`PQ_HYBRID_ALGORITHM=${hybridAlg}`);
console.log(`PQ_HYBRID_PUBLIC_KEY=${exportCompositeKey(hybridKp.compositePublicKey)}`);
console.log(`PQ_HYBRID_PRIVATE_KEY=${exportCompositeKey(hybridKp.compositePrivateKey)}`);

console.log("\n# === Server Settings ===");
console.log("JWT_ISSUER=https://auth.yourdomain.com");
console.log("JWT_AUDIENCES=https://app.yourdomain.com,https://www.yourdomain.com,http://localhost:5173,http://localhost:3006");
