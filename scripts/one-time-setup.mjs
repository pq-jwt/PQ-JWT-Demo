/**
 * Run once per environment to generate a PQ key pair and print .env lines.
 *
 *   node scripts/one-time-setup.mjs
 *
 * Copy the output into .env (never commit PQ_PRIVATE_KEY).
 */
import { generateKeyPair, exportKey } from "@pq-jwt/core";

const { algorithm, publicKey, secretKey } = generateKeyPair();

console.log("--- Add these lines to your .env file ---\n");
console.log(`PQ_ALGORITHM=${algorithm}`);
console.log(`PQ_PUBLIC_KEY=${exportKey(publicKey)}`);
console.log(`PQ_PRIVATE_KEY=${exportKey(secretKey)}`);
console.log("\n--- Optional (used by this app for iss/aud) ---\n");
console.log("JWT_ISSUER=pq-jwttest");
console.log("JWT_AUDIENCES=http://localhost:5173,http://localhost:3006");
