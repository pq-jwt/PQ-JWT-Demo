/**
 * Server for @pq-jwt/express middleware demo.
 * Runs on http://localhost:3008
 */
import { webcrypto } from "node:crypto";
if (typeof globalThis.crypto === "undefined" || !globalThis.crypto.getRandomValues) {
  globalThis.crypto = webcrypto;
}

import express from "express";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { generateKeyPair, exportKey, importKey, sign } from "@pq-jwt/core";
import { pqAuth, requireRole } from "@pq-jwt/express";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, "..", ".env");

// 1. Load keys from parent .env
let publicKeyHex = "";
let privateKeyHex = "";
let issuer = "https://auth.yourdomain.com";

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

// Fallback in case keys are not in parent .env
if (!publicKeyHex || !privateKeyHex) {
  console.log("⚠️ No keys found in parent .env, generating ephemeral ML-DSA-65 keys for this run...");
  const kp = generateKeyPair("ML-DSA-65");
  publicKeyHex = exportKey(kp.publicKey);
  privateKeyHex = exportKey(kp.secretKey);
}

const secretKey = importKey(privateKeyHex);

const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, "public")));

// 2. Setup the @pq-jwt/express middleware
const authMiddleware = pqAuth({
  publicKey: publicKeyHex,
  issuer: issuer,
  userProperty: "user" // attaches verified claims payload to req.user
});

// Auth login endpoint
app.post("/api/auth/login", (req, res) => {
  const { username, role } = req.body;
  if (!username) {
    return res.status(400).json({ error: "Username is required" });
  }

  const userRole = role === "admin" ? "admin" : "member";

  // Sign a standard PQ-JWT token using the secret key
  const token = sign(
    { 
      username, 
      role: userRole,
      email: `${username}@example.com`
    }, 
    secretKey, 
    {
      algorithm: "ML-DSA-65",
      expiresIn: "1h",
      issuer
    }
  );

  res.json({ token, role: userRole });
});

// Protected Profile Endpoint (requires valid token via pqAuth middleware)
app.get("/api/user/profile", authMiddleware, (req, res) => {
  res.json({
    message: "Authenticated successfully using @pq-jwt/express!",
    user: req.user
  });
});

// Protected Admin Dashboard Endpoint (requires valid token AND 'admin' role)
app.get("/api/admin/dashboard", authMiddleware, requireRole("admin"), (req, res) => {
  res.json({
    message: "Welcome to the Post-Quantum Secure Admin Dashboard!",
    secretAdminData: "PQ-JWT-Express-Middleware-Is-Awesome",
    user: req.user
  });
});

// Health / Info endpoint
app.get("/api/info", (req, res) => {
  res.json({
    status: "healthy",
    library: "@pq-jwt/express",
    activeAlgorithm: "ML-DSA-65",
    publicKeyPrefix: publicKeyHex.slice(0, 32) + "..."
  });
});

// Custom Error Handler for @pq-jwt/express error routing
app.use((err, req, res, next) => {
  if (err.name === "PQExpressError" || err.name === "TokenExpiredError" || err.name === "SignatureError") {
    return res.status(err.statusCode || 401).json({
      error: err.message,
      code: err.code || "AUTH_FAILED"
    });
  }
  next(err);
});

const PORT = 3008;
app.listen(PORT, () => {
  console.log(`🚀 @pq-jwt/express demo server active at http://localhost:${PORT}`);
  console.log(`🔒 Middleware configured with issuer: ${issuer}`);
});
