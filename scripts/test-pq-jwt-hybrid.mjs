#!/usr/bin/env node
/**
 * Test suite for @pq-jwt/hybrid integrated in the pq-jwttest app wrapper.
 * Exercises hybrid signature algorithms and core helper routes.
 * Run: node scripts/test-pq-jwt-hybrid.mjs
 */
import { webcrypto } from "node:crypto";
if (typeof globalThis.crypto === "undefined" || !globalThis.crypto.getRandomValues) {
  globalThis.crypto = webcrypto;
}

import {
  SUPPORTED_ALGORITHMS,
  algorithmInfo,
  generateKeyPair,
  exportKey,
  importKey,
  sign,
  verify,
  decode,
  refresh,
  PQJWTError,
  TokenExpiredError,
  InvalidTokenError,
  SignatureError,
} from "../src/pqjwt.js";

const ISSUER = "pq-jwttest-hybrid";
const AUDIENCE = "http://localhost:5173";

let passed = 0;
let failed = 0;

function check(label, cond, detail = "") {
  const mark = cond ? "✓" : "✗";
  console.log(`${mark} ${label}${detail ? ` — ${detail}` : ""}`);
  if (cond) passed++;
  else failed++;
}

function assertThrows(label, fn, ErrorClass) {
  try {
    fn();
    check(label, false, "expected throw");
  } catch (err) {
    check(label, err instanceof ErrorClass, err.message?.slice(0, 60));
  }
}

console.log("\n=== @pq-jwt/hybrid — transparent wrapper tests ===\n");

// ── Hybrid Algorithms list ──
console.log("── Hybrid Algorithms in SUPPORTED_ALGORITHMS ──");
const hybridAlgs = SUPPORTED_ALGORITHMS.filter(a => a.includes("-ES") || a.includes("-Ed"));
check("hybrid algorithms present", hybridAlgs.length > 0);
console.log(`   Hybrid algorithms: ${hybridAlgs.join(", ")}\n`);

// ── algorithmInfo for Hybrid ──
console.log("── algorithmInfo() for Hybrid ──");
for (const alg of hybridAlgs) {
  const info = algorithmInfo(alg);
  check(
    `algorithmInfo(${alg})`,
    info.algorithm === alg &&
      info.publicKeyBytes > 0 &&
      info.secretKeyBytes > 0 &&
      info.signatureBytes > 0 &&
      info.description,
    `${info.publicKeyBytes}pk / ${info.signatureBytes}sig bytes — ${info.description}`
  );
}
console.log();

// ── generateKeyPair / exportKey / importKey for hybrid ──
console.log("── generateKeyPair / exportKey / importKey for Hybrid ──");
const hybridKp = generateKeyPair("ML-DSA-65-ES256");
check("generateKeyPair('ML-DSA-65-ES256')", hybridKp.algorithm === "ML-DSA-65-ES256");
check("keys are Uint8Array", hybridKp.publicKey instanceof Uint8Array && hybridKp.secretKey instanceof Uint8Array);

const hexSk = exportKey(hybridKp.secretKey, "ML-DSA-65-ES256");
const hexPk = exportKey(hybridKp.publicKey, "ML-DSA-65-ES256");
check("exportKey hex", /^[0-9a-f]+$/i.test(hexSk) && hexSk.length === hybridKp.secretKey.length * 2);

const reSk = importKey(hexSk, "ML-DSA-65-ES256");
const rePk = importKey(hexPk, "ML-DSA-65-ES256");
check("importKey round-trip sk", reSk.length === hybridKp.secretKey.length);
check("importKey round-trip pk", rePk.length === hybridKp.publicKey.length);
console.log();

// ── sign / verify with hybrid algorithms ──
console.log("── sign() / verify() with Hybrid Algorithms ──");
for (const alg of hybridAlgs) {
  // Let's test the primary algorithms
  if (alg !== "ML-DSA-65-ES256" && alg !== "ML-DSA-44-ES256") continue;

  const kp = generateKeyPair(alg);
  const token = sign(
    { role: "hybrid-tester", alg },
    kp.secretKey,
    {
      algorithm: alg,
      expiresIn: "1h",
      issuer: ISSUER,
      subject: "hybrid-subject",
      audience: AUDIENCE,
      jwtId: `jti-hybrid-${alg}`,
    },
  );
  
  const parts = token.split(".");
  check(`sign ${alg} (3 parts)`, parts.length === 3);

  const { header, payload } = verify(token, kp.publicKey, {
    issuer: ISSUER,
    audience: AUDIENCE,
    subject: "hybrid-subject",
  });
  
  check(
    `verify ${alg} claims`,
    header.typ === "JWT" &&
      header.ver === "2" &&
      header.alg === alg &&
      payload.role === "hybrid-tester" &&
      payload.jti === `jti-hybrid-${alg}` &&
      payload.iss === ISSUER &&
      payload.aud === AUDIENCE,
  );
}
console.log();

// ── decode() with Hybrid Token ──
console.log("── decode() Hybrid ──");
const sampleToken = sign(
  { user: "hybrid" },
  hybridKp.secretKey,
  { algorithm: "ML-DSA-65-ES256", expiresIn: "1h", issuer: ISSUER, audience: AUDIENCE },
);
const decoded = decode(sampleToken);
check("decode header.typ", decoded.header.typ === "JWT");
check("decode payload.user", decoded.payload.user === "hybrid");
check("decode signature bytes", decoded.signature instanceof Uint8Array && decoded.signature.length > 0);
console.log();

// ── refresh() Hybrid ──
console.log("── refresh() Hybrid ──");
const shortLived = sign(
  { userId: "refresh-user", flag: true },
  hybridKp.secretKey,
  { algorithm: "ML-DSA-65-ES256", expiresIn: "2s", issuer: ISSUER, audience: AUDIENCE, subject: "refresh-user" },
);
const refreshed = refresh(shortLived, hybridKp, {
  expiresIn: "1h",
  issuer: ISSUER,
  audience: AUDIENCE,
  subject: "refresh-user",
});
check("refresh returns new token", refreshed !== shortLived && refreshed.split(".").length === 3);

const refreshedPayload = verify(refreshed, hybridKp.publicKey, {
  issuer: ISSUER,
  audience: AUDIENCE,
}).payload;
check("refresh keeps custom claims", refreshedPayload.userId === "refresh-user" && refreshedPayload.flag === true);
console.log();

// ── Error handling for Hybrid ──
console.log("── Error Handling for Hybrid ──");
const expiredToken = sign(
  { exp: Math.floor(Date.now() / 1000) - 10 },
  hybridKp.secretKey,
  { algorithm: "ML-DSA-65-ES256" }
);
assertThrows("TokenExpiredError for hybrid", () => verify(expiredToken, hybridKp.publicKey), TokenExpiredError);

const wrongKp = generateKeyPair("ML-DSA-65-ES256");
assertThrows("SignatureError for hybrid", () => verify(sampleToken, wrongKp.publicKey), SignatureError);

console.log(`\n=== Hybrid Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
