import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// dev 时前端跑在 5173,API 代理到 server.mjs(8080)
// build 产物 dist/ 由 server.mjs 静态托管
export default defineConfig({
  plugins: [react(), tailwindcss()],
  css: { postcss: { plugins: [] } },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8080",
      "/latest.json": "http://localhost:8080",
      "/releases": "http://localhost:8080",
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
