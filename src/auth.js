import "./env.js";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { sign, verify, TokenExpiredError, InvalidTokenError, SignatureError } from "./pqjwt.js";
import { findUserByUsername, createUser, findUserById } from "./db.js";
import { getSessionIdFromCookies } from "./cookies.js";
import { getSession } from "./sessions.js";

export const ISSUER = process.env.JWT_ISSUER || "pq-jwttest";

export const ALLOWED_AUDIENCES = (
  process.env.JWT_AUDIENCES || "http://localhost:5173,http://localhost:3006"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const SESSION_TTL_SEC = Number(process.env.PQ_JWT_COOKIE_MAX_AGE_SEC || 86400);

export function getJwtConfig() {
  return { issuer: ISSUER, allowedAudiences: ALLOWED_AUDIENCES };
}

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

/** Issue PQ-JWT or Hybrid JWT with jti; jti is stored in pq_session cookie. */
export function issueTokenForUser(user, keys, audience, options = {}) {
  const userId = user.id ?? user._id?.toString();
  const username = user.username;
  const jti = randomUUID();
  const alg = options.algorithm || (keys && keys.algorithm) || "ML-DSA-65";
  
  const token = sign(
    { userId, username },
    keys,
    { 
      expiresIn: `${SESSION_TTL_SEC}s`, 
      issuer: ISSUER, 
      subject: userId, 
      audience, 
      jwtId: jti,
      algorithm: alg
    },
  );
  return {
    token,
    jti,
    user: { id: userId, username },
    audience,
  };
}

export async function loginUser(username, password, keys, audience, algorithm) {
  const user = await findUserByUsername(username?.trim());
  if (!user) throw new Error("Invalid username or password");
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new Error("Invalid username or password");

  return issueTokenForUser(
    { id: user._id.toString(), username: user.username },
    keys,
    audience,
    { algorithm },
  );
}

export function verifyToken(token, keys) {
  try {
    const { payload } = verify(token, keys, { issuer: ISSUER });

    const aud = payload.aud;
    if (!aud || !ALLOWED_AUDIENCES.includes(aud)) {
      throw new InvalidTokenError("audience mismatch");
    }

    return {
      userId: payload.userId,
      username: payload.username,
      audience: aud,
      jti: payload.jti,
    };
  } catch (err) {
    if (err instanceof TokenExpiredError) throw new Error("Token expired");
    if (err instanceof SignatureError) throw new Error("Invalid token signature");
    if (err instanceof InvalidTokenError) throw new Error(err.message);
    throw err;
  }
}

export function authMiddleware(keys) {
  return (req, res, next) => {
    const header = req.headers.authorization;
    if (header?.startsWith("Bearer ")) {
      try {
        req.user = verifyToken(header.slice(7), keys);
        req.pqJwt = header.slice(7);
        return next();
      } catch (err) {
        return res.status(401).json({ error: err.message });
      }
    }

    const sessionId = getSessionIdFromCookies(req);
    if (sessionId) {
      const session = getSession(sessionId);
      if (session) {
        req.user = {
          userId: session.userId,
          username: session.username,
          audience: session.audience,
        };
        req.sessionId = sessionId;
        return next();
      }
      return res.status(401).json({ error: "Invalid or expired session" });
    }

    return res.status(401).json({
      error: "Missing auth: Authorization: Bearer <token> or pq_session cookie",
    });
  };
}

export async function getPublicUser(userId) {
  return findUserById(userId);
}
