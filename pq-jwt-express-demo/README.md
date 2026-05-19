# 🛡️ @pq-jwt/express Middleware Demo

Welcome to the official developer guide and demonstration module for **`@pq-jwt/express`** — the high-performance post-quantum JSON Web Token (PQ-JWT) authentication middleware for Express.js applications.

This module turns 15+ lines of complex cryptographic key import, token extraction, and signature verification boilerplate into a single, robust `pqAuth()` middleware call.

---

## 🚀 Key Features

*   **⚡ Boilerplate-Free Integration:** Secure any Express.js endpoint with a single `pqAuth({ publicKey })` configuration.
*   **🔒 Built-in Guards:** Easily restrict access based on roles or custom payload claims with `requireRole(...roles)` and `requireClaim(claim, value)`.
*   **🔌 Flexible Extractors:** Extract post-quantum tokens automatically from Bearer Headers, cookies, custom headers, or multiple fallback sources.
*   **🛠️ Robust Error Mapping:** Automatically translates core cryptographic errors (like expired signatures or invalid keys) into structured HTTP responses.

---

## 📂 Project Structure

This demo module resides in a clean, self-contained directory:

```text
pq-jwt-express-demo/
├── public/                 # Glassmorphic Frontend Demo UI
│   ├── index.html          # HTML view with real-time middleware guard testing
│   ├── app.js              # Client logic to fetch protected profile & admin routes
│   └── styles.css          # Harmonious modern glassmorphism styling
├── package.json            # Sub-module scripts and dependencies
├── server.js               # Express application showcasing route & role guards
├── test.mjs                # Programmatic integration test suite
└── README.md               # This documentation
```

---

## 🛠️ Getting Started & Run Locally

### 1. Run the Express Demo Server
Launch the server in the background (it automatically loads your standard post-quantum keys from the parent `.env` file):

```bash
# From the parent directory:
npm run dev

# Or run the express demo server directly:
cd pq-jwt-express-demo
npm start
```
The server will start listening at: **`http://localhost:3008`**

Open this address in your web browser to play with the interactive, glassmorphic auth dashboard! Try logging in as a **Member** vs an **Admin** to see how the role guards dynamically filter and secure HTTP routes.

### 2. Run the Programmatic Integration Test Suite
To automatically spin up the server, execute the programmatic tests (verifying healthcheck, login, profile access, unauthorized error codes, and role restrictions):

```bash
cd pq-jwt-express-demo
npm test
```
All integration assertions should execute and report a fully green exit code!

---

## 📖 Middleware Code Blueprint

Here is the exact code architecture demonstrating how `@pq-jwt/express` is utilized inside [server.js](server.js):

```javascript
import express from 'express';
import { pqAuth, requireRole } from '@pq-jwt/express';

const app = express();

// 1. Initialize the post-quantum auth middleware
const auth = pqAuth({
  publicKey: process.env.PQ_PUBLIC_KEY,
  issuer: 'https://auth.yourdomain.com'
});

// 2. Secure standard authenticated routes (accessible by members and admins)
app.get('/api/profile', auth, (req, res) => {
  res.json({ message: 'Success!', user: req.user });
});

// 3. Secure administrative routes with built-in role-based access control
app.get('/api/admin', auth, requireRole('admin'), (req, res) => {
  res.json({ secret: 'Super secret PQ-secure data' });
});
```

---

## ⚡ Ecosystem Integration
This package is part of the **`@pq-jwt`** developer ecosystem, dedicated to bringing secure, compliant, and production-ready post-quantum cryptography to modern web standards.
