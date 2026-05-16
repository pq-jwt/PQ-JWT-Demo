# Package Comparison: `@pq-jwt/core` vs `pqjwt`

Both `@pq-jwt/core` (your package) and `pqjwt` (eduardogiraudi's package) aimed to solve the same problem: bringing post-quantum cryptography to JSON Web Tokens. However, their underlying architecture, security models, and developer experiences are vastly different.

Here is a breakdown of the differences, security analysis, and why developers should choose `@pq-jwt/core`.

---

## 1. Architectural Differences

### Dependent Technologies

- **`@pq-jwt/core`**: Powered by the `@noble/post-quantum` library. This is a **pure-JavaScript** implementation. It doesn't rely on WebAssembly (WASM) or C/C++ bindings.
- **`pqjwt`**: Powered by `@oqs/liboqs-js`. This relies directly on the **C-based Library Open Quantum Safe (`liboqs`)**. To use this in Node.js, it uses WebAssembly bindings or native C wrappers underneath. It also strictly relies on an external package (`asn1.js`) for key encoding.

### File System vs. Stateless Design

- **`@pq-jwt/core`**: Operates entirely in memory (Stateless). Functions like `sign()` and `verify()` take raw keys. This aligns with modern, twelve-factor app principles and serverless environments.
- **`pqjwt`**: The API (`createPublisher('./keys', ...)`) implicitly forces developers to read and write keys to the local disk. This is a severe anti-pattern in modern cloud computing where containers (like Docker) or edge functions (like Vercel/AWS Lambda) are ephemeral or read-only.

### Supported Algorithms

- **`@pq-jwt/core`**: Exclusively focuses on finalized **NIST FIPS 204 (Dilithium)** and **FIPS 205 (SPHINCS+)** standards.
- **`pqjwt`**: Supports Dilithium and SPHINCS+, but also includes legacy or experimental algorithms like Falcon (FN-DSA).

---

## 2. Which is More Secure & Why?

**From a mathematical standpoint, they are equally secure.** Both libraries implement the exact same NIST-standardized algorithms (e.g., ML-DSA-65) that are mathematically proven to be quantum-resistant.

However, **from an application and systems security standpoint, `@pq-jwt/core` is significantly more secure:**

1. **Supply Chain Attack Surface**: `@pq-jwt/core` has extremely minimal dependencies. `pqjwt` relies on an entire C compilation chain (`liboqs`) and complex ASN.1 parsing dependencies, which introduces a much larger surface metadata area for potential supply chain injection or upstream vulnerabilities.
2. **Memory Safety**: Because `@pq-jwt/core` is written in pure, garbage-collected JavaScript, it is completely immune to classic C-level memory vulnerabilities (like buffer overflows, use-after-free, or segfaults) that exist in underlying native bindings.
3. **Key Storage Vulnerabilities**: `pqjwt` aggressively promotes saving keys locally to `./keys`. In production, if an attacker gains path traversal or local file inclusion (LFI) access, those keys are instantly compromised. `@pq-jwt/core` requires developers to handle keys via Environment Variables or secure Secret Managers (like AWS KMS/Hashicorp Vault), safely keeping keys in encrypted memory.

---

## 3. Why Developers Should Choose `@pq-jwt/core`

If you are marketing this to developers, these are the key selling points over the competitor:

1. **"Runs Anywhere" (Edge-Native)**
   Because `pqjwt` relies on C-bindings/WASM from `liboqs`, it will instantly fail if a developer tries to use it in Cloudflare Workers, edge environments, React Native frameworks, or restricted V8 isolates. Your library (`@pq-jwt/core`) is pure JavaScript, meaning it runs **literally anywhere** natively and instantly.
2. **No Build Tooling Nightmares**
   Developers despise installing a package that suddenly fails because `node-gyp` or Python is missing, preventing C++ binaries from compiling. `@pq-jwt/core` installs cleanly in milliseconds without compilation tools.
3. **Familiar JWT Syntax**
   Developers are used to `jsonwebtoken` (`sign`, `verify`, `decode`). Your API perfectly mirrors that familiar workflow. The competitor's `createPublisher/createConsumer` paradigm feels alien and overly complex to traditional Web/Node developers.
4. **Serverless Ready**
   No artificial constraints dictating that keys must be stored in relative local folders (`pem`/`bin`). Developers just pass you the key securely sourced from their cloud environment.
