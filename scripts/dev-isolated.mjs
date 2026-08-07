/**
 * 隔离 dev 启动器(基于 dev-fast)+ WebView2 CDP 调试端口。
 *
 * dev-fast 直接 spawn 已编译的 lxcode.exe(不经 pnpm/cargo),env 直接继承,
 * 所以 WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS 能直达 WebView2 → 开 CDP 端口 9222。
 * (之前经 pnpm tauri:dev 链路 env 会丢失,改走 dev-fast 直 spawn exe。)
 *
 * 隔离维度:
 *  1. PIDECK_CONFIG_DIR → settings 独立,不影响已装实例
 *  2. agentDir          → host 数据独立,不和 ~/.lxcode 抢
 *  3. CDP 端口 9222     → 供自动化测试脚本连入操控真实 Tauri WebView
 *
 * 用法: node scripts/dev-isolated.mjs
 * 停止: Ctrl+C
 */
import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = "D:/桌面/LX-Code";
const tauriDir = join(root, "apps", "desktop", "src-tauri");
const desktopExe = join(tauriDir, "target", "debug", "lxcode.exe");
const devUrl = "http://localhost:1420/";
const hostDist = join(root, "packages", "pi-host", "dist");
const protocolDist = join(root, "packages", "protocol", "dist");
const protocolPackage = join(root, "packages", "protocol", "package.json");
const tauriHostResources = join(tauriDir, "resources", "pi-host");
const debugHostResources = join(tauriDir, "target", "debug", "resources", "pi-host");

const configDir = "D:/tmp/lxcode-dev-config";
const agentDir = "D:/tmp/lxcode-dev-agent";
const cdpPort = "9222";

// 1) 预置独立 settings(设 agentDir,否则回退 ~/.lxcode 仍冲突)
mkdirSync(configDir, { recursive: true });
mkdirSync(agentDir, { recursive: true });
const settingsPath = join(configDir, "desktop-settings.json");
if (!existsSync(settingsPath)) {
  const { writeFileSync } = await import("node:fs");
  writeFileSync(settingsPath, JSON.stringify({
    schemaVersion: 1,
    settings: {
      theme: "dark", restoreLastSession: false, autoRestartHostOnce: true,
      agentDir, extensionDecisionPresentation: "auto",
      terminalProfile: "windows-powershell", conversationContentWidth: 668,
      knownWorkspaces: [], useCases: {},
    },
  }, null, 2));
  console.log(`[dev-iso] 预置 settings: agentDir=${agentDir}`);
}

// 2) 同步 pi-host/protocol 资源到 exe 目录(dev-fast 的 syncHostResources 逻辑)
function copyDir(src, dst) { mkdirSync(dst, { recursive: true }); for (const n of readdirSync(src)) cpSync(join(src,n), join(dst,n), { recursive:true, force:true }); }
function syncHost(dst) {
  if (!existsSync(dst)) return;
  for (const e of readdirSync(hostDist, { withFileTypes: true })) {
    const n = e.name;
    if (n.includes(".test.") || n.endsWith(".d.ts") || n.endsWith(".d.ts.map")) continue;
    if (e.isDirectory() && (n === "spike" || n === "test-helpers")) continue;
    if (!e.isDirectory() && !n.endsWith(".js") && !n.endsWith(".js.map")) continue;
    cpSync(join(hostDist, n), join(dst, n === "main.js" ? "host-main.js" : n), { recursive: e.isDirectory(), force: true });
  }
  for (const r of [join(dst, "vendor", "protocol"), join(dst, "node_modules", "@lxcode", "protocol")]) {
    copyDir(protocolDist, join(r, "dist"));
    cpSync(protocolPackage, join(r, "package.json"), { force: true });
  }
}
syncHost(tauriHostResources);
syncHost(debugHostResources);
console.log("[dev-iso] host resources synced");

// 3) 环境:隔离 config + WebView2 CDP
// 不改 PATH(exe 已编译不需 cargo;改 PATH 格式可能让 spawn 丢弃整个 env)
const env = {
  ...process.env,
  PIDECK_CONFIG_DIR: configDir,
  WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${cdpPort}`,
};

// 4) 起 Vite(devUrl),复用已运行的
async function viteReady() { try { return (await fetch(devUrl)).ok; } catch { return false; } }
let vite = null;
if (await viteReady()) {
  console.log(`[dev-iso] 复用 Vite @ ${devUrl}`);
} else {
  console.log("[dev-iso] 启动 Vite ...");
  const pnpmJs = "D:/LXCode/resources/node/node_modules/corepack/dist/pnpm.js";
  vite = spawn(process.execPath, [pnpmJs, "--filter", "@lxcode/desktop", "run", "dev"], { cwd: root, stdio: "inherit", env, windowsHide: true });
  for (let i = 0; i < 60; i++) { if (await viteReady()) break; await new Promise(r => setTimeout(r, 500)); }
  console.log(`[dev-iso] Vite ready @ ${devUrl}`);
}

// 5) 直 spawn exe(env 直接继承 → WebView2 读到 CDP 环境变量)
console.log(`[dev-iso] 启动 ${desktopExe} (CDP 端口 ${cdpPort})`);
console.log(`[dev-iso] env check: WEBVIEW2=${env.WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS} PIDECK=${env.PIDECK_CONFIG_DIR}`);
const desktop = spawn(desktopExe, [], { cwd: tauriDir, stdio: "inherit", windowsHide: false, env });

let stopping = false;
function cleanup() { if (stopping) return; stopping = true; if (desktop.pid) spawnSync("taskkill", ["/PID", String(desktop.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true }); if (vite?.pid) spawnSync("taskkill", ["/PID", String(vite.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true }); }
process.once("SIGINT", () => { cleanup(); process.exit(130); });
process.once("SIGTERM", () => { cleanup(); process.exit(143); });
desktop.once("exit", (code) => { process.exitCode = code ?? 0; cleanup(); });
