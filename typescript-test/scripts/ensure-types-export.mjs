/**
 * Ensures @pq-jwt/core package.json exports include "types" for TS NodeNext.
 * Remove this when npm package ships with types in exports.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pkgPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "node_modules",
  "@pq-jwt",
  "core",
  "package.json",
);

const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const exp = pkg.exports?.["."];

if (exp && !exp.types) {
  exp.types = "./src/index.d.ts";
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  console.log("Patched @pq-jwt/core exports.types for TypeScript");
}
