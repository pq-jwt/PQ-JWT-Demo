/**
 * Compile-time only: proves @pq-jwt/core .d.ts types are wired correctly.
 * Included in `tsc --noEmit` — no runtime output required.
 */
import type {
  Algorithm,
  KeyPair,
  SignOptions,
  VerifyOptions,
  DecodedToken,
} from "@pq-jwt/core";

// ── Algorithm union (NIST names) ──
const validAlg: Algorithm = "ML-DSA-65";
void validAlg;

// @ts-expect-error RS256 is not a PQ-JWT algorithm
const invalidAlg: Algorithm = "RS256";
void invalidAlg;

// @ts-expect-error typo
const typoAlg: Algorithm = "ML-DSA-66";
void typoAlg;

// ── SignOptions / VerifyOptions ──
const signOpts: SignOptions = {
  algorithm: "ML-DSA-44",
  expiresIn: "24h",
  issuer: "pq-jwttest",
  subject: "user-id",
  audience: "http://localhost:5173",
  jwtId: "unique-jti",
};

const verifyOpts: VerifyOptions = {
  algorithms: ["ML-DSA-65", "ML-DSA-87"],
  issuer: "pq-jwttest",
  audience: "http://localhost:5173",
  subject: "user-id",
  ignoreExpiry: false,
};

void signOpts;
void verifyOpts;

// ── KeyPair shape from generateKeyPair ──
declare const kp: KeyPair;
const _pk: Uint8Array = kp.publicKey;
const _sk: Uint8Array = kp.secretKey;
const _alg: Algorithm = kp.algorithm;
void _pk;
void _sk;
void _alg;

// ── DecodedToken from decode() ──
declare const decoded: DecodedToken;
const headerAlg: string = decoded.header.alg;
const headerTyp: string = decoded.header.typ;
const payloadSub: unknown = decoded.payload.sub;
const sigBytes: Uint8Array = decoded.signature;
void headerAlg;
void headerTyp;
void payloadSub;
void sigBytes;

// expiresIn accepts number (seconds) or string duration
const numericExpiry: SignOptions = { expiresIn: 3600 };
void numericExpiry;
