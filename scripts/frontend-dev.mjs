import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = process.env.FRONTEND_PORT || 5173;
const API_URL = process.env.API_URL || "http://localhost:3006";
const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");

const app = express();
app.use(
  "/api",
  createProxyMiddleware({
    target: API_URL,
    changeOrigin: true,
    cookieDomainRewrite: "",
    pathRewrite: (path) => `/api${path}`,
  }),
);
app.use(express.static(publicDir));

app.listen(PORT, () => {
  console.log(`Frontend at http://localhost:${PORT} (API proxy → ${API_URL})`);
});
