import "./env.js";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { webcrypto } from "node:crypto";

if (typeof globalThis.crypto === "undefined" || !globalThis.crypto.getRandomValues) {
  globalThis.crypto = webcrypto;
}

import { generateKeyPair, exportKey, importKey } from "@pq-jwt/core";
import { generateCompositeKeyPair, exportCompositeKey, importCompositeKey } from "@pq-jwt/hybrid";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const KEYS_PATH = join(ROOT, ".keys.json");
const ALGORITHM = "ML-DSA-65";
const HYBRID_ALGORITHM = "ML-DSA-65-ES256";

function keysFromEnv() {
  const { 
    PQ_PRIVATE_KEY, PQ_PUBLIC_KEY, PQ_ALGORITHM,
    PQ_HYBRID_PRIVATE_KEY, PQ_HYBRID_PUBLIC_KEY, PQ_HYBRID_ALGORITHM
  } = process.env;

  if (!PQ_PRIVATE_KEY || !PQ_PUBLIC_KEY) return null;

  const coreKeys = {
    algorithm: PQ_ALGORITHM || ALGORITHM,
    publicKey: importKey(PQ_PUBLIC_KEY),
    secretKey: importKey(PQ_PRIVATE_KEY),
  };

  if (PQ_HYBRID_PRIVATE_KEY && PQ_HYBRID_PUBLIC_KEY) {
    return {
      ...coreKeys,
      hybridAlgorithm: PQ_HYBRID_ALGORITHM || HYBRID_ALGORITHM,
      hybridPublicKey: importCompositeKey(PQ_HYBRID_PUBLIC_KEY),
      hybridPrivateKey: importCompositeKey(PQ_HYBRID_PRIVATE_KEY),
    };
  }

  // Otherwise generate hybrid on-the-fly to be fully complete
  const hybridPair = generateCompositeKeyPair(HYBRID_ALGORITHM);
  return {
    ...coreKeys,
    hybridAlgorithm: HYBRID_ALGORITHM,
    hybridPublicKey: hybridPair.compositePublicKey,
    hybridPrivateKey: hybridPair.compositePrivateKey,
  };
}

export function loadOrCreateKeys() {
  const fromEnv = keysFromEnv();
  if (fromEnv) return fromEnv;

  if (existsSync(KEYS_PATH)) {
    const stored = JSON.parse(readFileSync(KEYS_PATH, "utf8"));
    
    let needsUpdate = false;
    let hybridAlgorithm = stored.hybridAlgorithm || HYBRID_ALGORITHM;
    let hybridPublicKeyHex = stored.hybridPublicKey;
    let hybridPrivateKeyHex = stored.hybridPrivateKey;

    if (!hybridPublicKeyHex || !hybridPrivateKeyHex) {
      const hybridPair = generateCompositeKeyPair(HYBRID_ALGORITHM);
      hybridPublicKeyHex = exportCompositeKey(hybridPair.compositePublicKey);
      hybridPrivateKeyHex = exportCompositeKey(hybridPair.compositePrivateKey);
      needsUpdate = true;
    }

    if (needsUpdate) {
      stored.hybridAlgorithm = hybridAlgorithm;
      stored.hybridPublicKey = hybridPublicKeyHex;
      stored.hybridPrivateKey = hybridPrivateKeyHex;
      writeFileSync(KEYS_PATH, JSON.stringify(stored, null, 2));
    }

    return {
      algorithm: stored.algorithm,
      publicKey: importKey(stored.publicKey),
      secretKey: importKey(stored.secretKey),
      hybridAlgorithm,
      hybridPublicKey: importCompositeKey(hybridPublicKeyHex),
      hybridPrivateKey: importCompositeKey(hybridPrivateKeyHex),
    };
  }

  const pair = generateKeyPair(ALGORITHM);
  const hybridPair = generateCompositeKeyPair(HYBRID_ALGORITHM);

  const keyData = {
    algorithm: pair.algorithm,
    publicKey: exportKey(pair.publicKey),
    secretKey: exportKey(pair.secretKey),
    hybridAlgorithm: HYBRID_ALGORITHM,
    hybridPublicKey: exportCompositeKey(hybridPair.compositePublicKey),
    hybridPrivateKey: exportCompositeKey(hybridPair.compositePrivateKey),
  };

  writeFileSync(KEYS_PATH, JSON.stringify(keyData, null, 2));

  return {
    algorithm: pair.algorithm,
    publicKey: pair.publicKey,
    secretKey: pair.secretKey,
    hybridAlgorithm: HYBRID_ALGORITHM,
    hybridPublicKey: hybridPair.compositePublicKey,
    hybridPrivateKey: hybridPair.compositePrivateKey,
  };
}
