import { webcrypto } from "node:crypto";

if (typeof globalThis.crypto === "undefined" || !globalThis.crypto.getRandomValues) {
  globalThis.crypto = webcrypto;
}

import * as core from "@pq-jwt/core";
import * as hybrid from "@pq-jwt/hybrid";

export const CORE_ALGORITHMS = core.SUPPORTED_ALGORITHMS;
export const HYBRID_ALGORITHMS = hybrid.SUPPORTED_ALGORITHMS;
export const SUPPORTED_ALGORITHMS = [...CORE_ALGORITHMS, ...HYBRID_ALGORITHMS];

// Custom unified error classes inheriting from a common base
export class PQJWTError extends Error {
  constructor(message, code) { 
    super(message); 
    this.name = 'PQJWTError'; 
    this.code = code; 
  }
}

export class TokenExpiredError extends PQJWTError {
  constructor(expiredAt) { 
    super(`Token expired`, 'TOKEN_EXPIRED'); 
    this.name = 'TokenExpiredError'; 
    this.expiredAt = expiredAt; 
  }
}

export class InvalidTokenError extends PQJWTError {
  constructor(reason) { 
    super(`Invalid token: ${reason}`, 'INVALID_TOKEN'); 
    this.name = 'InvalidTokenError'; 
  }
}

export class SignatureError extends PQJWTError {
  constructor(reason) { 
    super(reason || 'Signature verification failed', 'SIGNATURE_INVALID'); 
    this.name = 'SignatureError'; 
  }
}

export function algorithmInfo(alg) {
  if (CORE_ALGORITHMS.includes(alg)) {
    return core.algorithmInfo(alg);
  }
  if (alg === 'ML-DSA-44-ES256') {
    return { algorithm: alg, publicKeyBytes: 1312 + 33, secretKeyBytes: 32 + 32, signatureBytes: 2420 + 64, description: 'Composite ML-DSA-44 + ECDSA P-256 (IETF 2025 Draft)' };
  }
  if (alg === 'ML-DSA-65-ES256') {
    return { algorithm: alg, publicKeyBytes: 1952 + 33, secretKeyBytes: 32 + 32, signatureBytes: 3309 + 64, description: 'Composite ML-DSA-65 + ECDSA P-256 (IETF 2025 Draft)' };
  }
  if (alg === 'ML-DSA-87-ES384') {
    return { algorithm: alg, publicKeyBytes: 2592 + 49, secretKeyBytes: 32 + 48, signatureBytes: 4627 + 96, description: 'Composite ML-DSA-87 + ECDSA P-384 (IETF 2025 Draft)' };
  }
  if (alg === 'ML-DSA-44-Ed25519') {
    return { algorithm: alg, publicKeyBytes: 1312 + 32, secretKeyBytes: 32 + 32, signatureBytes: 2420 + 64, description: 'Composite ML-DSA-44 + Ed25519 (IETF 2025 Draft)' };
  }
  if (alg === 'ML-DSA-65-Ed25519') {
    return { algorithm: alg, publicKeyBytes: 1952 + 32, secretKeyBytes: 32 + 32, signatureBytes: 3309 + 64, description: 'Composite ML-DSA-65 + Ed25519 (IETF 2025 Draft)' };
  }
  if (alg === 'ML-DSA-87-Ed448') {
    return { algorithm: alg, publicKeyBytes: 2592 + 57, secretKeyBytes: 32 + 57, signatureBytes: 4627 + 114, description: 'Composite ML-DSA-87 + Ed448 (IETF 2025 Draft)' };
  }
  throw new PQJWTError(`Unknown algorithm "${alg}"`, 'UNKNOWN_ALGORITHM');
}

export function generateKeyPair(alg = 'ML-DSA-65') {
  if (HYBRID_ALGORITHMS.includes(alg)) {
    const pair = hybrid.generateCompositeKeyPair(alg);
    return {
      algorithm: pair.algorithm,
      publicKey: pair.compositePublicKey,
      secretKey: pair.compositePrivateKey
    };
  }
  return core.generateKeyPair(alg);
}

export function exportKey(key, alg = 'ML-DSA-65') {
  if (HYBRID_ALGORITHMS.includes(alg)) {
    return hybrid.exportCompositeKey(key);
  }
  return core.exportKey(key);
}

export function importKey(hexString, alg = 'ML-DSA-65') {
  if (HYBRID_ALGORITHMS.includes(alg)) {
    return hybrid.importCompositeKey(hexString);
  }
  return core.importKey(hexString);
}

export function sign(payload, keys, options = {}) {
  const alg = options.algorithm || 'ML-DSA-65';
  
  if (HYBRID_ALGORITHMS.includes(alg)) {
    let sk = keys;
    if (keys && typeof keys === 'object' && keys.hybridPrivateKey) {
      sk = keys.hybridPrivateKey;
    }
    try {
      return hybrid.signComposite(payload, sk, options);
    } catch (err) {
      throw new PQJWTError(err.message, err.code);
    }
  } else {
    let sk = keys;
    if (keys && typeof keys === 'object' && keys.secretKey) {
      sk = keys.secretKey;
    }
    try {
      return core.sign(payload, sk, options);
    } catch (err) {
      throw new PQJWTError(err.message, err.code);
    }
  }
}

export function verify(token, keys, options = {}) {
  const { header } = decode(token);
  const alg = header.alg;

  if (HYBRID_ALGORITHMS.includes(alg)) {
    let pk = keys;
    if (keys && typeof keys === 'object' && keys.hybridPublicKey) {
      pk = keys.hybridPublicKey;
    }
    try {
      return hybrid.verifyComposite(token, pk, options);
    } catch (err) {
      if (err instanceof hybrid.HybridTokenExpiredError) {
        throw new TokenExpiredError(err.expiredAt);
      }
      if (err instanceof hybrid.HybridSignatureError) {
        throw new SignatureError(err.message);
      }
      throw new InvalidTokenError(err.message);
    }
  } else {
    let pk = keys;
    if (keys && typeof keys === 'object' && keys.publicKey) {
      pk = keys.publicKey;
    }
    try {
      return core.verify(token, pk, options);
    } catch (err) {
      if (err instanceof core.TokenExpiredError) {
        throw new TokenExpiredError(err.expiredAt);
      }
      if (err instanceof core.SignatureError) {
        throw new SignatureError(err.message);
      }
      throw new InvalidTokenError(err.message);
    }
  }
}

export function decode(token) {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new InvalidTokenError('token must have 3 dot-separated parts');
  }
  
  // Use core.decode for structural parsing since both use standard dot-separated base64url structures
  try {
    return core.decode(token);
  } catch (err) {
    throw new InvalidTokenError(err.message);
  }
}

export function refresh(token, keys, options = {}) {
  const { header, payload } = decode(token);
  const alg = header.alg;

  if (HYBRID_ALGORITHMS.includes(alg)) {
    let pk = keys;
    let sk = keys;
    if (keys && typeof keys === 'object') {
      pk = keys.hybridPublicKey || keys.publicKey;
      sk = keys.hybridPrivateKey || keys.secretKey;
    }

    // Verify first
    verify(token, pk, options);
    
    // Create new token with fresh iat and exp
    const cleanPayload = { ...payload };
    delete cleanPayload.iat;
    delete cleanPayload.exp;
    delete cleanPayload.nbf;
    delete cleanPayload.iss;
    delete cleanPayload.aud;
    delete cleanPayload.jti;
    delete cleanPayload.sub;

    return sign(cleanPayload, sk, {
      algorithm: alg,
      expiresIn: options.expiresIn,
      issuer: options.issuer || payload.iss,
      subject: options.subject || payload.sub,
      audience: options.audience || payload.aud,
      jwtId: options.jwtId,
    });
  } else {
    let pk = keys;
    let sk = keys;
    if (keys && typeof keys === 'object') {
      pk = keys.publicKey;
      sk = keys.secretKey;
    }
    try {
      return core.refresh(token, pk, sk, options);
    } catch (err) {
      throw new PQJWTError(err.message, err.code);
    }
  }
}
