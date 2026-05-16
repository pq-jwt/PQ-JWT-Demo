import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { generateKeyPair, exportKey, importKey } from "@pq-jwt/core";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const KEYS_PATH = join(ROOT, ".keys.json");
const ENV_PATH = join(ROOT, ".env");
const ALGORITHM = "ML-DSA-65";

/** Load .env into process.env when PQ_* are not already set (e.g. from shell). */
function loadEnvFile() {
  if (process.env.PQ_PRIVATE_KEY && process.env.PQ_PUBLIC_KEY) return;
  if (!existsSync(ENV_PATH)) return;

  for (const line of readFileSync(ENV_PATH, "utf8").split("\n")) {
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

function keysFromEnv() {
  const { PQ_PRIVATE_KEY, PQ_PUBLIC_KEY, PQ_ALGORITHM } = process.env;
  if (!PQ_PRIVATE_KEY || !PQ_PUBLIC_KEY) return null;

  return {
    algorithm: PQ_ALGORITHM || ALGORITHM,
    publicKey: importKey(PQ_PUBLIC_KEY),
    secretKey: importKey(PQ_PRIVATE_KEY),
  };
}

export function loadOrCreateKeys() {
  loadEnvFile();

  const fromEnv = keysFromEnv();
  if (fromEnv) return fromEnv;

  if (existsSync(KEYS_PATH)) {
    const stored = JSON.parse(readFileSync(KEYS_PATH, "utf8"));
    return {
      algorithm: stored.algorithm,
      publicKey: importKey(stored.publicKey),
      secretKey: importKey(stored.secretKey),
    };
  }

  const pair = generateKeyPair(ALGORITHM);
  writeFileSync(
    KEYS_PATH,
    JSON.stringify(
      {
        algorithm: pair.algorithm,
        publicKey: exportKey(pair.publicKey),
        secretKey: exportKey(pair.secretKey),
      },
      null,
      2,
    ),
  );
  return pair;
}
