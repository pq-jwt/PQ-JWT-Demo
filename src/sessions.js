/**
 * Server-side sessions keyed by jti (UUID).
 * Cookie stores only pq_session=<uuid> (~36 bytes); PQ-JWT stays in Bearer or server memory.
 */

const TTL_MS = Number(process.env.SESSION_TTL_MS || 86400_000); // 24h

/** @type {Map<string, { userId: string, username: string, audience: string, expiresAt: number }>} */
const sessions = new Map();

export function createSession(jti, { userId, username, audience }) {
  const expiresAt = Date.now() + TTL_MS;
  sessions.set(jti, { userId, username, audience, expiresAt });
  return expiresAt;
}

export function getSession(jti) {
  if (!jti) return null;
  const session = sessions.get(jti);
  if (!session) return null;
  if (Date.now() >= session.expiresAt) {
    sessions.delete(jti);
    return null;
  }
  return session;
}

export function deleteSession(jti) {
  if (jti) sessions.delete(jti);
}

export function sessionCount() {
  return sessions.size;
}
