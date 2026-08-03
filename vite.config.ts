import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  // 生产打包用相对路径,让 Electron 能直接 loadFile
  base: "./",
  resolve: {
    alias: {
      // 设计原型入口
      "@": path.resolve(__dirname, "./src"),
      // 真实应用入口(桌面 renderer)
      "@app": path.resolve(__dirname, "./desktop/renderer"),
    },
  },
  server: {
    port: 1420,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    // 多入口:设计原型(index.html) + 真实应用(desktop/renderer/index.html)
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        app: path.resolve(__dirname, "desktop/renderer/index.html"),
      },
    },
  },
});
