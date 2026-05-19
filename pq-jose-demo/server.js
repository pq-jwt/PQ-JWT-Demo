/**
 * Server for @pq-jose/jose demo — SignJWT, jwtVerify, EncryptJWT, jwtDecrypt.
 * Runs on http://localhost:3009
 */
import { webcrypto } from "node:crypto";
if (typeof globalThis.crypto === "undefined" || !globalThis.crypto.getRandomValues) {
  globalThis.crypto = webcrypto;
}

import express from "express";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SignJWT,
  jwtVerify,
  EncryptJWT,
  jwtDecrypt,
  generateKeyPair,
  importKey,
  exportKey,
  exportJWK,
  PQJWTError,
  TokenExpiredError,
  SignatureError,
} from "@pq-jose/jose";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, "..", ".env");

let publicKeyHex = process.env.PQ_PUBLIC_KEY || "";
let privateKeyHex = process.env.PQ_PRIVATE_KEY || "";
let issuer = process.env.JWT_ISSUER || "https://auth.yourdomain.com";

if (existsSync(ENV_PATH)) {
  const content = readFileSync(ENV_PATH, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (key === "PQ_PUBLIC_KEY") publicKeyHex = val.replace(/['"]/g, "");
    if (key === "PQ_PRIVATE_KEY") privateKeyHex = val.replace(/['"]/g, "");
    if (key === "JWT_ISSUER") issuer = val.replace(/['"]/g, "");
  }
}

if (!publicKeyHex || !privateKeyHex) {
  console.log("⚠️ No keys in parent .env — generating ephemeral ML-DSA-65 keys for this run...");
  const kp = generateKeyPair("ML-DSA-65");
  publicKeyHex = exportKey(kp.publicKey);
  privateKeyHex = exportKey(kp.secretKey);
}

const signPublicKey = importKey(publicKeyHex);
const signSecretKey = importKey(privateKeyHex);

const kemKeys = generateKeyPair("ML-KEM-768");
const kemPublicHex = exportKey(kemKeys.publicKey);
const kemSecretHex = exportKey(kemKeys.secretKey);

const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, "public")));

function pqJoseAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing Bearer token", code: "MISSING_TOKEN" });
  }
  try {
    const { payload } = jwtVerify(header.slice(7), signPublicKey, { issuer });
    req.user = payload;
    next();
  } catch (err) {
    const status = err instanceof TokenExpiredError ? 401 : 401;
    return res.status(status).json({
      error: err.message,
      code: err instanceof TokenExpiredError ? "TOKEN_EXPIRED" : "AUTH_FAILED",
    });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.user?.role !== role) {
      return res.status(403).json({
        error: `Role '${role}' required`,
        code: "INSUFFICIENT_ROLE",
      });
    }
    next();
  };
}

app.get("/api/info", (_req, res) => {
  const signJwk = exportJWK(signPublicKey, "ML-DSA-65", { use: "sig" });
  const kemJwk = exportJWK(kemKeys.publicKey, "ML-KEM-768", { use: "enc" });
  res.json({
    status: "healthy",
    library: "@pq-jose/jose",
    issuer,
    keys: {
      signing: {
        algorithm: "ML-DSA-65",
        use: "sig",
        publicKeyBytes: signPublicKey.length,
        publicKeyHex: publicKeyHex,
        publicKeyPreview: formatKeyPreview(publicKeyHex),
        jwk: signJwk,
      },
      encryption: {
        algorithm: "ML-KEM-768",
        use: "enc",
        publicKeyBytes: kemKeys.publicKey.length,
        publicKeyHex: kemPublicHex,
        publicKeyPreview: formatKeyPreview(kemPublicHex),
        jwk: kemJwk,
      },
    },
  });
});

function formatKeyPreview(hex) {
  if (hex.length <= 96) return hex;
  return `${hex.slice(0, 48)}…${hex.slice(-48)}`;
}

app.post("/api/auth/login", (req, res) => {
  const { username, role } = req.body;
  if (!username?.trim()) {
    return res.status(400).json({ error: "Username is required" });
  }
  const userRole = role === "admin" ? "admin" : "member";

  const token = new SignJWT({
    username: username.trim(),
    role: userRole,
    email: `${username.trim()}@example.com`,
  })
    .setAlgorithm("ML-DSA-65")
    .setExpirationTime("1h")
    .setIssuer(issuer)
    .sign(signSecretKey);

  res.json({ token, role: userRole });
});

app.get("/api/user/profile", pqJoseAuth, (req, res) => {
  res.json({
    message: "Authenticated successfully using @pq-jose/jose jwtVerify()!",
    user: req.user,
  });
});

app.get("/api/admin/dashboard", pqJoseAuth, requireRole("admin"), (req, res) => {
  res.json({
    message: "Welcome to the Post-Quantum JOSE Admin Dashboard!",
    secretAdminData: "PQ-JOSE-jwtVerify-Works",
    user: req.user,
  });
});

app.post("/api/jwe/encrypt", pqJoseAuth, (req, res) => {
  try {
    const { plaintext } = req.body;
    if (!plaintext?.trim()) {
      return res.status(400).json({ error: "plaintext is required" });
    }
    const token = new EncryptJWT({ secret: plaintext.trim(), by: req.user.username })
      .setAlgorithm("ML-KEM-768")
      .setEncryption("A256GCM")
      .setExpirationTime("15m")
      .setIssuer(issuer)
      .encrypt(kemKeys.publicKey);

    res.json({
      token,
      algorithm: "ML-KEM-768+A256GCM",
      encryptKeyPreview: formatKeyPreview(kemPublicHex),
      encryptKeyBytes: kemKeys.publicKey.length,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/jwe/decrypt", pqJoseAuth, (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: "token is required" });

    const { payload, protectedHeader } = jwtDecrypt(token, kemKeys.secretKey, { issuer });
    res.json({ payload, protectedHeader });
  } catch (err) {
    res.status(400).json({ error: err.message, code: err.code || "JWE_DECRYPT_FAILED" });
  }
});

app.use((err, _req, res, next) => {
  if (
    err instanceof PQJWTError ||
    err instanceof TokenExpiredError ||
    err instanceof SignatureError
  ) {
    return res.status(err.statusCode || 401).json({
      error: err.message,
      code: err.code || "AUTH_FAILED",
    });
  }
  next(err);
});

const PORT = process.env.PORT || 3009;
app.listen(PORT, () => {
  console.log(`🚀 @pq-jose/jose demo server active at http://localhost:${PORT}`);
  console.log(`🔒 SignJWT/jwtVerify issuer: ${issuer}`);
  console.log(`🔐 JWE ML-KEM-768 public key prefix: ${kemPublicHex.slice(0, 24)}...`);
});
