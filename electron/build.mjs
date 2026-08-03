// 用 esbuild 编译主进程 TS → CJS。
// - electron/main.ts(壳,import desktop/main)→ electron/dist/main.cjs
// - desktop/preload/index.ts → desktop/dist/preload.cjs
import { build, context } from "esbuild";

const watch = process.argv.includes("--watch");

/** 主进程:壳 + 业务 bundle 到一起。pi-coding-agent 不 bundle,运行时加载。 */
const mainConfig = {
  entryPoints: ["electron/main.ts"],
  outdir: "electron/dist",
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  sourcemap: true,
  external: ["electron", "@earendil-works/*"],
  outExtension: { ".js": ".cjs" },
  define: {
    "process.env.NODE_ENV": JSON.stringify(watch ? "development" : "production"),
  },
};

/** preload:单独 bundle(渲染进程侧,要小且隔离)。 */
const preloadConfig = {
  entryPoints: ["desktop/preload/index.ts"],
  outfile: "desktop/dist/preload.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  sourcemap: true,
  external: ["electron"],
};

if (watch) {
  const mainCtx = await context(mainConfig);
  const preloadCtx = await context(preloadConfig);
  await Promise.all([mainCtx.watch(), preloadCtx.watch()]);
  console.log("[build] watching electron + desktop...");
} else {
  await build(mainConfig);
  await build(preloadConfig);
  console.log("[build] electron + desktop built");
}
