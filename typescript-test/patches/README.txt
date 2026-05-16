@pq-jwt/core v1.0.0 needs "types" in package.json exports for TypeScript NodeNext:

  "exports": {
    ".": {
      "types": "./src/index.d.ts",
      "import": "./src/index.mjs",
      "default": "./src/index.mjs"
    }
  }

Publish this fix in the next npm release so consumers get types without patching.
