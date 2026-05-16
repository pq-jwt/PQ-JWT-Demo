/**
 * Minimal example: load keys from .env, sign a token, verify it.
 *
 *   node --env-file=.env scripts/sign-verify-env-example.mjs
 *
 * Generate keys first:
 *   node scripts/one-time-setup.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { importKey, sign, verify } from "@pq-jwt/core";

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

const { PQ_PRIVATE_KEY, PQ_PUBLIC_KEY, JWT_ISSUER } = process.env;

if (!PQ_PRIVATE_KEY || !PQ_PUBLIC_KEY) {
  console.error("Missing PQ_PRIVATE_KEY or PQ_PUBLIC_KEY in .env");
  console.error("Run: node scripts/one-time-setup.mjs");
  process.exit(1);
}

const secretKey = importKey(PQ_PRIVATE_KEY);
const publicKey = importKey(PQ_PUBLIC_KEY);
const issuer = JWT_ISSUER || "pq-jwttest-example";

const token = sign({ userId: "demo-user", role: "admin" }, secretKey, {
  expiresIn: "1h",
  issuer,
});

console.log("Signed token (first 80 chars):", token.slice(0, 80) + "…");
console.log("Token length:", token.length);

const { header, payload } = verify(token, publicKey, { issuer });

console.log("\nVerified header:", header);
console.log("Verified payload:", payload);
