#!/usr/bin/env node
/**
 * Exercises every export from @pq-jwt/core.
 * Run: npm run test:core
 */
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
} from "@pq-jwt/core";

const ISSUER = "pq-jwttest";
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

console.log("\n=== @pq-jwt/core — full export test ===\n");

// ── SUPPORTED_ALGORITHMS ──
console.log("── SUPPORTED_ALGORITHMS ──");
check("is non-empty array", Array.isArray(SUPPORTED_ALGORITHMS) && SUPPORTED_ALGORITHMS.length >= 4);
check("includes ML-DSA-65", SUPPORTED_ALGORITHMS.includes("ML-DSA-65"));
console.log(`   algorithms: ${SUPPORTED_ALGORITHMS.join(", ")}\n`);

// ── algorithmInfo ──
console.log("── algorithmInfo() ──");
for (const alg of SUPPORTED_ALGORITHMS) {
  const info = algorithmInfo(alg);
  check(
    `algorithmInfo(${alg})`,
    info.algorithm === alg &&
      info.publicKeyBytes > 0 &&
      info.secretKeyBytes > 0 &&
      info.signatureBytes > 0 &&
      info.nistStandard,
    `${info.publicKeyBytes}pk / ${info.signatureBytes}sig bytes`,
  );
}
assertThrows("algorithmInfo(unknown)", () => algorithmInfo("FAKE-ALG"), PQJWTError);
console.log();

// ── generateKeyPair + exportKey + importKey ──
console.log("── generateKeyPair / exportKey / importKey ──");
const defaultKp = generateKeyPair();
check("generateKeyPair() default alg", defaultKp.algorithm === "ML-DSA-65");
check("keys are Uint8Array", defaultKp.publicKey instanceof Uint8Array);

const hexSk = exportKey(defaultKp.secretKey);
const hexPk = exportKey(defaultKp.publicKey);
check("exportKey hex", /^[0-9a-f]+$/i.test(hexSk) && hexSk.length === defaultKp.secretKey.length * 2);

const reSk = importKey(hexSk);
const rePk = importKey(hexPk);
check("importKey round-trip sk", reSk.length === defaultKp.secretKey.length);
check("importKey round-trip pk", rePk.length === defaultKp.publicKey.length);

assertThrows("importKey bad hex", () => importKey("not-hex!"), PQJWTError);
assertThrows("exportKey non-bytes", () => exportKey("string"), PQJWTError);
console.log();

// ── sign / verify (string keys + all algorithms) ──
console.log("── sign() / verify() ──");
for (const alg of SUPPORTED_ALGORITHMS) {
  const kp = generateKeyPair(alg);
  const token = sign(
    { role: "test", alg },
    exportKey(kp.secretKey),
    {
      algorithm: alg,
      expiresIn: "1h",
      issuer: ISSUER,
      subject: "user-1",
      audience: AUDIENCE,
      jwtId: `jti-${alg}`,
    },
  );
  const parts = token.split(".");
  check(`sign/verify ${alg} (3 parts)`, parts.length === 3);

  const { header, payload } = verify(token, exportKey(kp.publicKey), {
    issuer: ISSUER,
    audience: AUDIENCE,
    subject: "user-1",
    algorithms: alg,
  });
  check(
    `verify ${alg} claims`,
    header.typ === "PQ-JWT" &&
      header.ver === "1" &&
      header.alg === alg &&
      payload.role === "test" &&
      payload.jti === `jti-${alg}` &&
      payload.iss === ISSUER &&
      payload.aud === AUDIENCE,
  );
}
console.log();

// ── decode() — no verify ──
console.log("── decode() ──");
const sampleToken = sign(
  { userId: "abc" },
  defaultKp.secretKey,
  { expiresIn: "1h", issuer: ISSUER, audience: AUDIENCE },
);
const decoded = decode(sampleToken);
check("decode header.typ", decoded.header.typ === "PQ-JWT");
check("decode payload.userId", decoded.payload.userId === "abc");
check("decode signature bytes", decoded.signature instanceof Uint8Array && decoded.signature.length > 0);

const tampered = sampleToken.slice(0, -4) + "XXXX";
assertThrows("decode invalid base64 part", () => decode(tampered.replace(/\./g, "..")), InvalidTokenError);
console.log();

// ── refresh() ──
console.log("── refresh() ──");
const shortLived = sign(
  { userId: "refresh-user", keep: true },
  defaultKp.secretKey,
  { expiresIn: "2s", issuer: ISSUER, audience: AUDIENCE, subject: "refresh-user" },
);
const refreshed = refresh(shortLived, defaultKp.publicKey, defaultKp.secretKey, {
  expiresIn: "1h",
  issuer: ISSUER,
  audience: AUDIENCE,
  subject: "refresh-user",
});
check("refresh returns new token", refreshed !== shortLived && refreshed.split(".").length === 3);

const refreshedPayload = verify(refreshed, defaultKp.publicKey, {
  issuer: ISSUER,
  audience: AUDIENCE,
}).payload;
check("refresh keeps custom claims", refreshedPayload.userId === "refresh-user" && refreshedPayload.keep === true);
check("refresh new iat/exp", refreshedPayload.exp > decoded.payload.exp || refreshedPayload.iat >= decoded.payload.iat);
console.log();

// ── Error classes ──
console.log("── error classes ──");
const expiredToken = sign(
  { x: 1, exp: Math.floor(Date.now() / 1000) - 60 },
  defaultKp.secretKey,
);
assertThrows("TokenExpiredError", () => verify(expiredToken, defaultKp.publicKey), TokenExpiredError);

const validToken = sign({ x: 1 }, defaultKp.secretKey, { expiresIn: "1h" });
const wrongKp = generateKeyPair();
assertThrows("SignatureError", () => verify(validToken, wrongKp.publicKey), SignatureError);

assertThrows(
  "InvalidTokenError issuer",
  () => verify(validToken, defaultKp.publicKey, { issuer: "wrong-issuer" }),
  InvalidTokenError,
);

assertThrows(
  "InvalidTokenError audience",
  () => verify(validToken, defaultKp.publicKey, { audience: "http://evil.com" }),
  InvalidTokenError,
);

assertThrows("InvalidTokenError malformed", () => verify("a.b", defaultKp.publicKey), InvalidTokenError);

check(
  "ignoreExpiry option",
  (() => {
    try {
      verify(expiredToken, defaultKp.publicKey, { ignoreExpiry: true });
      return true;
    } catch {
      return false;
    }
  })(),
);

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
