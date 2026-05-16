import bcrypt from "bcryptjs";
import { sign, verify, TokenExpiredError, InvalidTokenError, SignatureError } from "./pqjwt.js";
import { findUserByUsername, createUser, findUserById } from "./db.js";

export const ISSUER = process.env.JWT_ISSUER || "pq-jwttest";

export const ALLOWED_AUDIENCES = (
  process.env.JWT_AUDIENCES || "http://localhost:5173,http://localhost:3006"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export function getJwtConfig() {
  return { issuer: ISSUER, allowedAudiences: ALLOWED_AUDIENCES };
}

/** Resolve aud from browser Origin or clientOrigin; curl can send either. */
export function resolveAudienceFromRequest(req) {
  const candidate = req.headers.origin || req.body?.clientOrigin;
  if (candidate && ALLOWED_AUDIENCES.includes(candidate)) {
    return candidate;
  }
  const fallback = process.env.JWT_AUDIENCE;
  if (fallback && ALLOWED_AUDIENCES.includes(fallback)) {
    return fallback;
  }
  throw new Error(
    `Invalid or missing audience. Send Origin header or clientOrigin. Allowed: ${ALLOWED_AUDIENCES.join(", ")}`,
  );
}

export async function registerUser(username, password) {
  if (!username?.trim() || !password) {
    throw new Error("Username and password are required");
  }
  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }
  if (await findUserByUsername(username.trim())) {
    throw new Error("Username already taken");
  }
  const hash = await bcrypt.hash(password, 10);
  return createUser(username.trim(), hash);
}

export async function loginUser(username, password, secretKey, audience) {
  const user = await findUserByUsername(username?.trim());
  if (!user) throw new Error("Invalid username or password");
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new Error("Invalid username or password");

  const userId = user._id.toString();
  const token = sign(
    { userId, username: user.username },
    secretKey,
    { expiresIn: "24h", issuer: ISSUER, subject: userId, audience },
  );

  return {
    token,
    user: { id: userId, username: user.username },
    audience,
  };
}

export function verifyToken(token, publicKey) {
  try {
    const { payload } = verify(token, publicKey, { issuer: ISSUER });

    const aud = payload.aud;
    if (!aud || !ALLOWED_AUDIENCES.includes(aud)) {
      throw new InvalidTokenError("audience mismatch");
    }

    return { userId: payload.userId, username: payload.username, audience: aud };
  } catch (err) {
    if (err instanceof TokenExpiredError) throw new Error("Token expired");
    if (err instanceof SignatureError) throw new Error("Invalid token signature");
    if (err instanceof InvalidTokenError) throw new Error(err.message);
    throw err;
  }
}

export function authMiddleware(publicKey) {
  return (req, res, next) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid Authorization header" });
    }
    try {
      req.user = verifyToken(header.slice(7), publicKey);
      next();
    } catch (err) {
      res.status(401).json({ error: err.message });
    }
  };
}

export async function getPublicUser(userId) {
  return findUserById(userId);
}
