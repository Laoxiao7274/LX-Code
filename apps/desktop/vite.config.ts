import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const tauriDevHost = process.env.TAURI_DEV_HOST;
const host = tauriDevHost || "127.0.0.1";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // 显式空 PostCSS 配置:阻止 Vite 向上目录树搜索 postcss.config.js
  // (本仓库嵌在 LXCode 仓库内,vite 会误命中 LXCode 根的 postcss 配置)
  css: { postcss: { plugins: [] } },
  // The protocol package is rebuilt during desktop development. Serving it directly
  // prevents Vite's dependency cache from keeping stale response validators alive.
  optimizeDeps: {
    exclude: ["@lxcode/protocol"],
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host,
    hmr: tauriDevHost
      ? {
          protocol: "ws",
          host: tauriDevHost,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari13",
    minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
