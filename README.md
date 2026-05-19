[![npm version](https://img.shields.io/npm/v/@pq-jwt/core)](https://www.npmjs.com/package/@pq-jwt/core)
[![npm downloads](https://img.shields.io/npm/dm/@pq-jwt/core)](https://www.npmjs.com/package/@pq-jwt/core)
[![Website](https://img.shields.io/badge/website-pq--jwt.github.io-00d4aa)](https://pq-jwt.github.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Website:** [pq-jwt.github.io](https://pq-jwt.github.io) · **Demo:** [github.com/pq-jwt/PQ-JWT-Demo](https://github.com/pq-jwt/PQ-JWT-Demo) · **Library:** [github.com/pq-jwt/PQ-JWT](https://github.com/pq-jwt/PQ-JWT) · **npm:** [@pq-jwt/core](https://www.npmjs.com/package/@pq-jwt/core)

# PQ-JWT Demo — Developer Guide

Reference app and test suite for [**@pq-jwt/core**](https://www.npmjs.com/package/@pq-jwt/core) (**JavaScript + TypeScript**, Node.js ESM): post-quantum JSON Web Tokens signed with NIST algorithms (default **ML-DSA-65**). Includes an Express API, MongoDB-backed auth, a small web UI, and a **TypeScript** validation package.

Use this repo as a **hands-on assistant** when integrating PQ-JWT in JavaScript or TypeScript backends.

---

## Table of contents

1. [What you get](#what-you-get)
2. [Prerequisites](#prerequisites)
3. [Quick start](#quick-start)
4. [Project layout](#project-layout)
5. [PQ key setup](#pq-key-setup)
6. [Using @pq-jwt/core (JavaScript)](#using-pq-jwtcore-javascript)
7. [Using @pq-jwt/core (TypeScript)](#using-pq-jwtcore-typescript)
8. [Running the demo app](#running-the-demo-app)
9. [HTTP API reference](#http-api-reference)
10. [Auth: issuer, audience, Bearer tokens](#auth-issuer-audience-bearer-tokens)
11. [npm scripts & tests](#npm-scripts--tests)
12. [Security notes](#security-notes)
13. [Troubleshooting](#troubleshooting)

---

## What you get

| Piece | Description |
|--------|-------------|
| **`@pq-jwt/core`** | Sign, verify, decode, refresh PQ-JWTs; generate ML-DSA / SLH-DSA key pairs |
| **`src/`** | Express server, auth middleware, key loading from `.env` or `.keys.json` |
| **`public/`** | Vanilla JS UI (register, login, notes CRUD) |
| **`typescript-test/`** | Strict TypeScript compile + runtime demo of every library export |
| **`scripts/`** | Key generation, sign/verify examples, API smoke tests |

PQ-JWT tokens are larger than classic HS256 JWTs (~4–5 KB for ML-DSA-65). Header uses `typ: "PQ-JWT"` and `ver: "1"`.

---

## Prerequisites

- **Node.js** **≥ 20.19** (`@pq-jwt/core` engine requirement; 22+ recommended; `node --env-file=.env` supported)
- **MongoDB** running locally (default `mongodb://127.0.0.1:27017/pq_jwttest`)
- **npm**

---

## Quick start

```bash
# From repo root (not typescript-test/)
cd pq-jwttest
npm install

# 1. Generate PQ keys and copy output into .env
npm run keys:generate
cp .env.example .env   # then paste PQ_* lines from keys:generate

# 2. Start MongoDB, then dev stack (API :3006 + UI :5173)
npm run dev

# 3. Open the UI
# http://localhost:5173
```

**Single-server mode** (API + static UI on one port):

```bash
npm start
# http://localhost:3006
```

---

## Project layout

```
pq-jwttest/
├── src/
│   ├── server.js      # Express routes
│   ├── auth.js        # login, verify middleware, iss/aud
│   ├── keys.js        # load keys from .env → .keys.json → generate
│   ├── pqjwt.js       # re-exports @pq-jwt/core
│   └── db.js          # MongoDB users + items
├── public/            # SPA (app.js stores token in localStorage)
├── scripts/
│   ├── one-time-setup.mjs           # print PQ_* for .env
│   ├── sign-verify-env-example.mjs  # minimal sign + verify
│   ├── test-all-apis.mjs
│   ├── test-user-apis.mjs           # test with your Bearer token
│   └── ...
├── typescript-test/   # TypeScript guide + tests
│   ├── src/demo.ts
│   ├── src/assert-types.ts
│   └── tsconfig.json
├── pq-jwt-express-demo/  # @pq-jwt/express middleware UI (:3008)
├── pq-jose-demo/         # @pq-jose/jose SignJWT/jwtVerify/JWE UI (:3009)
├── .env.example
└── README.md          # this file
```

### Ecosystem sub-demos

| Command | URL | Package |
|---------|-----|---------|
| `npm run express:start` | http://localhost:3008 | [@pq-jwt/express](https://www.npmjs.com/package/@pq-jwt/express) |
| `npm run jose:start` | http://localhost:3009 | [@pq-jose/jose](https://www.npmjs.com/package/@pq-jose/jose) |

---

## PQ key setup

### One-time key generation

Run from **repository root**:

```bash
npm run keys:generate
```

Example output (paste into `.env`):

```env
PQ_ALGORITHM=ML-DSA-65
PQ_PUBLIC_KEY=<~3904 hex chars>
PQ_PRIVATE_KEY=<~8064 hex chars>

JWT_ISSUER=pq-jwttest
JWT_AUDIENCES=http://localhost:5173,http://localhost:3006
```

### How keys are loaded at runtime

`src/keys.js` resolves in this order:

1. **`PQ_PRIVATE_KEY` + `PQ_PUBLIC_KEY`** from environment (or `.env` file read on startup)
2. **`.keys.json`** (auto-created on first run if env keys are missing)
3. **Generate new pair** and write `.keys.json`

| Variable | Role |
|----------|------|
| `PQ_PRIVATE_KEY` | **Secret** — sign tokens (server only) |
| `PQ_PUBLIC_KEY` | Verify tokens (not secret, but must match private key) |
| `PQ_ALGORITHM` | Optional; default `ML-DSA-65` |

`exportKey()` → hex string for storage. `importKey(hex)` → `Uint8Array` for `sign` / `verify`.

### Verify keys work (no server)

```bash
npm run keys:example
# or: node --env-file=.env scripts/sign-verify-env-example.mjs
```

---

## Using @pq-jwt/core (JavaScript)

Install in your own project:

```bash
npm install @pq-jwt/core
# or pin latest: npm install @pq-jwt/core@1.0.4
```

**Library source:** [github.com/pq-jwt/PQ-JWT](https://github.com/pq-jwt/PQ-JWT) · **Homepage:** [PQ-JWT README](https://github.com/pq-jwt/PQ-JWT#readme)

### Minimal sign / verify

```javascript
import {
  generateKeyPair,
  exportKey,
  importKey,
  sign,
  verify,
} from "@pq-jwt/core";

// One-time: generate and save hex to env/secrets manager
const { publicKey, secretKey } = generateKeyPair(); // default ML-DSA-65

const secret = importKey(process.env.PQ_PRIVATE_KEY);
const public_ = importKey(process.env.PQ_PUBLIC_KEY);

const token = sign(
  { userId: "user-1", role: "admin" },
  secret,
  {
    expiresIn: "24h",
    issuer: "my-app",
    subject: "user-1",
    audience: "https://app.example.com",
  },
);

const { header, payload } = verify(token, public_, {
  issuer: "my-app",
  audience: "https://app.example.com",
});

console.log(header.typ); // "PQ-JWT"
console.log(payload.userId);
```

### All main exports

| Export | Purpose |
|--------|---------|
| `generateKeyPair(algorithm?)` | Create `{ publicKey, secretKey, algorithm }` as `Uint8Array` |
| `exportKey` / `importKey` | Hex ↔ bytes |
| `sign(payload, secretKey, options?)` | Issue token string |
| `verify(token, publicKey, options?)` | Verify signature + claims → `{ header, payload }` |
| `decode(token)` | Parse only — **no signature check** (debug) |
| `refresh(token, publicKey, secretKey, options?)` | New token, same claims |
| `SUPPORTED_ALGORITHMS` | `ML-DSA-44`, `ML-DSA-65`, `ML-DSA-87`, `SLH-DSA-SHA2-128s` |
| `algorithmInfo(alg)` | Key/signature sizes, NIST standard |
| `TokenExpiredError`, `InvalidTokenError`, `SignatureError` | Typed errors |

### Sign options (common)

```javascript
sign(payload, secretKey, {
  algorithm: "ML-DSA-65",   // optional if key implies algorithm
  expiresIn: "1h",          // or seconds number
  issuer: "my-issuer",      // → iss
  subject: "user-id",       // → sub
  audience: "https://client", // → aud
  jwtId: "unique-id",       // → jti
});
```

### Verify options

```javascript
verify(token, publicKey, {
  issuer: "my-issuer",
  audience: "https://client",
  subject: "user-id",
  algorithms: "ML-DSA-65",   // or array
  ignoreExpiry: false,
});
```

### Example scripts in this repo

| Script | Command |
|--------|---------|
| Generate env keys | `npm run keys:generate` |
| Sign + verify from `.env` | `npm run keys:example` |
| Core library smoke test | `npm run test:core` |

---

## Using @pq-jwt/core (TypeScript)

The **`typescript-test/`** package shows typed usage with **strict** `tsc` settings (`NodeNext` modules).

### Run TypeScript checks

```bash
cd typescript-test
npm install
npm test          # typecheck → build → run dist/demo.js
```

Or from root:

```bash
npm run test:ts
```

### Recommended `tsconfig.json` (summary)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "skipLibCheck": false
  }
}
```

### Typed imports

```typescript
import {
  generateKeyPair,
  exportKey,
  importKey,
  sign,
  verify,
  decode,
  refresh,
  type Algorithm,
  type KeyPair,
  type SignOptions,
  type VerifyOptions,
  type DecodedToken,
  TokenExpiredError,
  InvalidTokenError,
  SignatureError,
} from "@pq-jwt/core";

const alg: Algorithm = "ML-DSA-65";
const kp: KeyPair = generateKeyPair(alg);

const signOptions: SignOptions = {
  expiresIn: "1h",
  issuer: "pq-jwttest",
  audience: "http://localhost:5173",
  subject: "user-123",
};

const token = sign({ userId: "user-123" }, kp.secretKey, signOptions);

const { header, payload } = verify(token, kp.publicKey, {
  issuer: signOptions.issuer,
  audience: signOptions.audience,
});
```

See full walkthrough: [`typescript-test/src/demo.ts`](typescript-test/src/demo.ts) and compile-time checks: [`typescript-test/src/assert-types.ts`](typescript-test/src/assert-types.ts).

### TypeScript note (package exports)

**v1.0.4+** ships `"types"` in `package.json` `exports` — `import` from `@pq-jwt/core` works with `module: "NodeNext"` out of the box. Older versions may need the `typescript-test/scripts/ensure-types-export.mjs` postinstall patch (kept as a safety check).

---

## Running the demo app

### Development (recommended)

```bash
npm run dev
```

| Service | URL |
|---------|-----|
| Frontend (proxies `/api` → API) | http://localhost:5173 |
| API | http://localhost:3006 |

### Production-style (single port)

```bash
npm start
# UI + API at http://localhost:3006
```

### UI flow

1. Open the frontend URL (5173 in dev, or 3006 with `npm start`).
2. **Register** → **Log in**.
3. Token is stored in `localStorage` as `pq_jwt_token`.
4. All API calls send `Authorization: Bearer <token>`.
5. Use notes CRUD to exercise protected routes.

### Environment for local dev

Copy [`.env.example`](.env.example) → `.env` and set:

```env
JWT_ISSUER=pq-jwttest
JWT_AUDIENCES=http://localhost:5173,http://localhost:3006
PQ_ALGORITHM=ML-DSA-65
PQ_PUBLIC_KEY=...
PQ_PRIVATE_KEY=...
```

`JWT_AUDIENCES` must include the **exact origin** you use in the browser (e.g. `http://localhost:5173`), or login will fail with an audience error.

Optional:

```env
PORT=3006
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=pq_jwttest
```

Restart the server after changing `.env`.

---

## HTTP API reference

Base URL: `http://localhost:3006` (or your `PORT`).

### Public

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Status, algorithm, JWT config |
| `GET` | `/api/jwt/info` | Supported algorithms + sizes |
| `POST` | `/api/jwt/decode` | Body `{ "token": "..." }` — parse only, no verify |
| `POST` | `/api/auth/register` | Body `{ "username", "password" }` |
| `POST` | `/api/auth/login` | Body `{ "username", "password", "clientOrigin"? }` → `{ token, user, audience }` |

### Protected (`Authorization: Bearer <PQ-JWT>`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/auth/me` | Current user profile |
| `POST` | `/api/jwt/refresh` | New token ( **header only**, not body ) |
| `GET` | `/api/items` | List notes |
| `POST` | `/api/items` | Create `{ "title", "body" }` |
| `GET` | `/api/items/:id` | Get one note |
| `PUT` | `/api/items/:id` | Update note |
| `DELETE` | `/api/items/:id` | Delete note |

### Example: login + call protected route

```bash
# Login (dev UI origin)
curl -s -X POST http://localhost:3006/api/auth/login \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:5173" \
  -d '{"username":"myuser","password":"secret123","clientOrigin":"http://localhost:5173"}' \
  | jq .

# Use token
export TOKEN="<paste token>"
curl -s http://localhost:3006/api/auth/me \
  -H "Authorization: Bearer $TOKEN" | jq .

# Refresh (must be Authorization header)
curl -s -X POST http://localhost:3006/api/jwt/refresh \
  -H "Authorization: Bearer $TOKEN" | jq .
```

---

## Auth: Bearer header, httpOnly session cookie, or both

PQ-JWT tokens are **~4.7 KB**; browsers drop cookies over **4 KB**. This app stores:

| Storage | Contents |
|---------|----------|
| `Authorization: Bearer` | Full PQ-JWT (no size limit) |
| httpOnly cookie `pq_session` | **UUID only** (~36 bytes) → server `sessions` Map |
| PQ-JWT payload `jti` | Same UUID, links token to session |

Login accepts `authMode` in the JSON body:

| `authMode` | Behavior |
|------------|----------|
| `bearer` | Token in JSON → `Authorization: Bearer` |
| `cookie` | `pq_session` cookie only (token omitted from JSON) |
| `both` (default) | Bearer token + `pq_session` cookie |

Protected routes accept **Bearer** or valid **`pq_session`** (looked up in `src/sessions.js`).

```bash
# Cookie-only login
curl -s -X POST http://localhost:3006/api/auth/login \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:5173" \
  -d '{"username":"myuser","password":"secret123","clientOrigin":"http://localhost:5173","authMode":"cookie"}' \
  -c cookies.txt

curl -s http://localhost:3006/api/auth/me -b cookies.txt

curl -s -X POST http://localhost:3006/api/auth/logout -b cookies.txt
```

**Frontend:** open http://localhost:5173, pick **Auth mode** on login, use **Log out** to clear the cookie. All `fetch` calls use `credentials: "include"`.

```bash
npm run test:cookies   # automated cookie + bearer tests (API must be running)
```

Cookie env vars (see `.env.example`): `PQ_SESSION_COOKIE_NAME`, `COOKIE_SECURE`, `COOKIE_SAME_SITE`.

---

## Auth: issuer, audience, Bearer tokens

### Issuer (`iss`)

Set via `JWT_ISSUER` (default `pq-jwttest`). Verified on every `verify()` in `src/auth.js`.

### Audience (`aud`)

- Set at **login** from `Origin` header or `clientOrigin` in JSON body.
- Must be listed in `JWT_AUDIENCES` (comma-separated).
- Binds the token to a client origin (e.g. your SPA URL).

```javascript
// Browser (public/app.js) sends on login:
{ username, password, clientOrigin: window.location.origin }
```

### Bearer token

- HTTP header: `Authorization: Bearer <token>`
- **Not** the same as `localStorage` key name `pq_jwt_token` (that is only where the UI stores the value).

### Splitting sign vs verify (microservices)

| Service | Env |
|---------|-----|
| Auth / login (signs) | `PQ_PRIVATE_KEY` (+ optionally `PQ_PUBLIC_KEY`) |
| API replicas (verify only) | `PQ_PUBLIC_KEY` only |

---

## npm scripts & tests

Run from **repository root** unless noted.

| Script | Command | Description |
|--------|---------|-------------|
| Dev stack | `npm run dev` | API watch + frontend :5173 |
| API only | `npm run dev:api` | Port 3006 |
| Single server | `npm start` | API + static UI :3006 |
| Generate keys | `npm run keys:generate` | Print `.env` lines |
| Sign/verify demo | `npm run keys:example` | Uses `.env` |
| All tests | `npm test` | Core + API + TypeScript |
| Core library | `npm run test:core` | |
| HTTP APIs | `npm run test:api` | Auto-login test user |
| JWT routes | `npm run test:jwt-api` | decode / refresh |
| Cookie auth | `npm run test:cookies` | Bearer vs httpOnly cookie |
| Your token | `npm run test:user` | Uses `scripts/.test-token` |
| Custom token | `TOKEN='...' node scripts/test-user-apis.mjs` | |
| TypeScript | `npm run test:ts` | `cd typescript-test && npm test` |

Test a saved token file:

```bash
node scripts/test-user-apis.mjs path/to/token.txt
```

---

## Security notes

- **Never commit** `PQ_PRIVATE_KEY`, `.env`, or `.keys.json` (see [`.gitignore`](.gitignore)).
- Rotating PQ keys **invalidates** all existing tokens — users must log in again.
- `POST /api/jwt/decode` does **not** verify signatures — use for debugging only.
- Use HTTPS and a secrets manager in production.
- `PQ_PUBLIC_KEY` is not secret but must not be swapped with another pair’s key.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Missing script: keys:generate` | Run from **repo root**, not `typescript-test/` |
| Login: invalid audience | Add your browser origin to `JWT_AUDIENCES`; restart server |
| CORS blocked | Origin must be in `JWT_AUDIENCES` |
| `Invalid token signature` | Keys changed — log in again; ensure `.env` pair matches |
| MongoDB connection errors | Start MongoDB; check `MONGODB_URI` |
| Refresh returns 401 | Send `Authorization: Bearer ...`, not token in JSON body |
| TypeScript: cannot find module types | See `typescript-test/scripts/ensure-types-export.mjs` |
| Token works on :3006 but UI on :5173 | Log in on the URL you use; `aud` must match that origin |

---

## Further reading

- Demo server auth: [`src/auth.js`](src/auth.js)
- Key loading: [`src/keys.js`](src/keys.js)
- JS sign/verify sample: [`scripts/sign-verify-env-example.mjs`](scripts/sign-verify-env-example.mjs)
- TypeScript demo: [`typescript-test/src/demo.ts`](typescript-test/src/demo.ts)

---

## License

ISC (see [package.json](package.json)).
