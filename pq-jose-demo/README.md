# @pq-jose/jose Demo

Interactive demo for [**@pq-jose/jose**](https://www.npmjs.com/package/@pq-jose/jose) — post-quantum JOSE with a jose-compatible API (`SignJWT`, `jwtVerify`, `EncryptJWT`, `jwtDecrypt`).

Runs on **http://localhost:3009** (separate from the main app on `:3006` and `@pq-jwt/express` on `:3008`).

## Quick start

```bash
# From repo root (uses parent .env PQ keys)
npm run jose:start

# Or from this folder
npm install
npm start
```

Open **http://localhost:3009**, sign in, then test:

| UI card | API | Library call |
|---------|-----|----------------|
| JWS Profile | `GET /api/user/profile` | `jwtVerify()` |
| JWS Admin | `GET /api/admin/dashboard` | `jwtVerify()` + `role === 'admin'` |
| JWE | `POST /api/jwe/encrypt`, `/api/jwe/decrypt` | `EncryptJWT` / `jwtDecrypt` (ML-KEM-768) |

## Tests

```bash
npm run jose:test
# or: cd pq-jose-demo && npm test
```

## Requirements

- Node.js **≥ 20**
- Parent `.env` with `PQ_PUBLIC_KEY` and `PQ_PRIVATE_KEY` (or ephemeral keys generated on startup)
