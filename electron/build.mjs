// 用 esbuild 编译 electron 主进程 TS → JS,输出到 electron/dist/
import { build } from "esbuild";

const watch = process.argv.includes("--watch");

/** 编译配置。 */
const config = {
  entryPoints: ["electron/main.ts", "electron/preload.ts"],
  outdir: "electron/dist",
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  sourcemap: true,
  external: ["electron"],
  outExtension: { ".js": ".cjs" },
  define: {
    "process.env.NODE_ENV": JSON.stringify(watch ? "development" : "production"),
  },
};

if (watch) {
  const ctx = await import("esbuild").then((m) => m.context(config));
  await ctx.watch();
  console.log("[electron] watching...");
} else {
  await build(config);
  console.log("[electron] built");
}
