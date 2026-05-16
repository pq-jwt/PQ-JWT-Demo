import express from "express";
import cors from "cors";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadOrCreateKeys } from "./keys.js";
import {
  registerUser,
  loginUser,
  authMiddleware,
  getPublicUser,
  resolveAudienceFromRequest,
  getJwtConfig,
  ALLOWED_AUDIENCES,
} from "./auth.js";
import { setAuthCookie, clearAuthCookie, normalizeAuthMode, COOKIE_NAME } from "./cookies.js";
import { connectDb, closeDb, listItems, getItem, createItem, updateItem, deleteItem } from "./db.js";
import { SUPPORTED_ALGORITHMS, algorithmInfo, decode, refresh } from "./pqjwt.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3006;
const keys = loadOrCreateKeys();

const app = express();
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || ALLOWED_AUDIENCES.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.static(join(__dirname, "..", "public")));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    algorithm: keys.algorithm,
    tokenType: "PQ-JWT",
    db: "mongodb",
    jwt: getJwtConfig(),
    cookie: { name: COOKIE_NAME, httpOnly: true },
  });
});

const requireAuth = authMiddleware(keys.publicKey);

/** PQ-JWT library helpers: algorithmInfo, decode, refresh */
app.get("/api/jwt/info", (_req, res) => {
  res.json({
    supportedAlgorithms: SUPPORTED_ALGORITHMS,
    default: algorithmInfo(keys.algorithm),
    all: SUPPORTED_ALGORITHMS.map((a) => algorithmInfo(a)),
  });
});

app.post("/api/jwt/decode", (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: "token required" });
    const decoded = decode(token);
    res.json({
      header: decoded.header,
      payload: decoded.payload,
      signatureLength: decoded.signature.length,
      warning: "decode() does not verify signature — debug only",
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/jwt/refresh", requireAuth, (req, res) => {
  try {
    const audience = req.user.audience;
    const token = refresh(req.pqJwt, keys.publicKey, keys.secretKey, {
      expiresIn: "24h",
      issuer: process.env.JWT_ISSUER || "pq-jwttest",
      subject: req.user.userId,
      audience,
    });
    const authMode = normalizeAuthMode(req.body?.authMode);
    if (authMode === "cookie" || authMode === "both") setAuthCookie(res, token);
    const body = { audience, authMode };
    if (authMode === "bearer" || authMode === "both") body.token = token;
    res.json(body);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await registerUser(username, password);
    res.status(201).json({ user });
  } catch (err) {
    const status = err.code === 11000 ? 400 : 400;
    res.status(status).json({ error: err.message || "Registration failed" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password, authMode: rawMode } = req.body;
    const audience = resolveAudienceFromRequest(req);
    const authMode = normalizeAuthMode(rawMode);
    const result = await loginUser(username, password, keys.secretKey, audience);

    if (authMode === "cookie" || authMode === "both") setAuthCookie(res, result.token);

    const body = {
      user: result.user,
      audience: result.audience,
      authMode,
    };
    if (authMode === "bearer" || authMode === "both") body.token = result.token;

    res.json(body);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

app.post("/api/auth/logout", (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

app.get("/api/auth/me", authMiddleware(keys.publicKey), async (req, res) => {
  try {
    const user = await getPublicUser(req.user.userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/items", requireAuth, async (req, res) => {
  try {
    const items = await listItems(req.user.userId);
    res.json({ items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/items/:id", requireAuth, async (req, res) => {
  try {
    const item = await getItem(req.params.id, req.user.userId);
    if (!item) return res.status(404).json({ error: "Item not found" });
    res.json({ item });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/items", requireAuth, async (req, res) => {
  try {
    const { title, body } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: "Title is required" });
    const item = await createItem(req.user.userId, title.trim(), body ?? "");
    res.status(201).json({ item });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/items/:id", requireAuth, async (req, res) => {
  try {
    const { title, body } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: "Title is required" });
    const item = await updateItem(req.params.id, req.user.userId, title.trim(), body ?? "");
    if (!item) return res.status(404).json({ error: "Item not found" });
    res.json({ item });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/items/:id", requireAuth, async (req, res) => {
  try {
    const ok = await deleteItem(req.params.id, req.user.userId);
    if (!ok) return res.status(404).json({ error: "Item not found" });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function main() {
  await connectDb();
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`PQ-JWT algorithm: ${keys.algorithm}`);
    console.log(`MongoDB: ${process.env.MONGODB_URI || "mongodb://127.0.0.1:27017"}/${process.env.MONGODB_DB || "pq_jwttest"}`);
    console.log(`JWT issuer: ${getJwtConfig().issuer}`);
    console.log(`JWT audiences: ${getJwtConfig().allowedAudiences.join(", ")}`);
  });
}

main().catch((err) => {
  console.error("Failed to start:", err.message);
  process.exit(1);
});

process.on("SIGINT", async () => {
  await closeDb();
  process.exit(0);
});
