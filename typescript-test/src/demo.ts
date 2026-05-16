/**
 * Runtime + typed demo for every @pq-jwt/core export.
 * Run: npm test (in typescript-test/)
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
  type Algorithm,
  type KeyPair,
  type SignOptions,
  type DecodedToken,
} from "@pq-jwt/core";

const ISSUER = "pq-jwttest";
const AUDIENCE = "http://localhost:5173";

function log(step: string, detail?: string) {
  console.log(`✓ ${step}${detail ? ` — ${detail}` : ""}`);
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

// ── SUPPORTED_ALGORITHMS ──
assert(SUPPORTED_ALGORITHMS.length >= 4, "algorithms list");
log("SUPPORTED_ALGORITHMS", SUPPORTED_ALGORITHMS.join(", "));

// ── algorithmInfo ──
const defaultAlg: Algorithm = "ML-DSA-65";
const info = algorithmInfo(defaultAlg);
assert(info.nistStandard === "FIPS 204", "nist standard");
log("algorithmInfo", `${info.publicKeyBytes} byte public key`);

// ── generateKeyPair / exportKey / importKey ──
const kp: KeyPair = generateKeyPair(defaultAlg);
const skHex = exportKey(kp.secretKey);
const pkHex = exportKey(kp.publicKey);
const sk = importKey(skHex);
const pk = importKey(pkHex);
assert(sk.length === kp.secretKey.length, "sk round-trip");
log("generateKeyPair + exportKey + importKey");

// ── sign / verify with typed options ──
const signOptions: SignOptions = {
  algorithm: defaultAlg,
  expiresIn: "1h",
  issuer: ISSUER,
  subject: "ts-demo-user",
  audience: AUDIENCE,
  jwtId: "typescript-test-jti",
};

const token = sign(
  { userId: "ts-001", role: "tester" },
  sk,
  signOptions,
);

const { header, payload } = verify(token, pk, {
  issuer: ISSUER,
  audience: AUDIENCE,
  subject: "ts-demo-user",
  algorithms: defaultAlg,
});

assert(header.typ === "PQ-JWT" && header.ver === "1", "header");
assert(payload.userId === "ts-001" && payload.jti === "typescript-test-jti", "payload");
log("sign + verify", `alg=${header.alg}`);

// ── decode (no verify) ──
const decoded: DecodedToken = decode(token);
assert(decoded.payload.aud === AUDIENCE, "decode aud");
log("decode", `signature ${decoded.signature.length} bytes`);

// ── refresh ──
const refreshed = refresh(token, pk, sk, {
  expiresIn: "2h",
  issuer: ISSUER,
  audience: AUDIENCE,
  subject: "ts-demo-user",
});
assert(refreshed !== token, "new token");
verify(refreshed, pk, { issuer: ISSUER, audience: AUDIENCE });
log("refresh");

// ── Error classes (typed instanceof) ──
const expiredToken = sign(
  { x: 1, exp: Math.floor(Date.now() / 1000) - 120 },
  sk,
);
try {
  verify(expiredToken, pk);
  throw new Error("expected TokenExpiredError");
} catch (err) {
  assert(err instanceof TokenExpiredError, "TokenExpiredError");
  assert(typeof (err as TokenExpiredError).expiredAt === "number", "expiredAt");
}
log("TokenExpiredError");

const wrongKp = generateKeyPair();
try {
  verify(token, wrongKp.publicKey);
  throw new Error("expected SignatureError");
} catch (err) {
  assert(err instanceof SignatureError, "SignatureError");
}
log("SignatureError");

try {
  verify(token, pk, { issuer: "wrong" });
  throw new Error("expected InvalidTokenError");
} catch (err) {
  assert(err instanceof InvalidTokenError, "InvalidTokenError");
}
log("InvalidTokenError");

try {
  algorithmInfo("NOT-REAL" as Algorithm);
  throw new Error("expected PQJWTError");
} catch (err) {
  assert(err instanceof PQJWTError, "PQJWTError");
  assert(typeof (err as PQJWTError).code === "string", "error code");
}
log("PQJWTError");

console.log("\n=== TypeScript demo: all exports OK ===\n");
