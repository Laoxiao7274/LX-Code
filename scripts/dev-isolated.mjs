/**
 * 隔离 dev 启动器 —— 避免 dev 实例和已安装实例冲突。
 *
 * 三个隔离维度:
 *  1. PIDECK_CONFIG_DIR  → settings(desktop-settings.json)独立,不影响已装实例的配置
 *  2. agentDir           → host 数据(sessions/models/auth)独立,不和 ~/.lxcode 抢
 *  3. WebView2 调试端口  → 9223 开 CDP,供自动化测试脚本连入操控真实 Tauri WebView
 *
 * 用法: node scripts/dev-isolated.mjs
 * 停止: Ctrl+C(会 cleanup 子进程树)
 */
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = "D:/桌面/LX-Code";
const configDir = "D:/tmp/lxcode-dev-config";
const agentDir = "D:/tmp/lxcode-dev-agent";
const cdpPort = "9223";

// 1) 预置独立 settings:设 agentDir,否则 resolved_agent_dir() 回退 ~/.lxcode 仍冲突
mkdirSync(configDir, { recursive: true });
mkdirSync(agentDir, { recursive: true });
const settingsPath = join(configDir, "desktop-settings.json");
if (!existsSync(settingsPath)) {
  writeFileSync(settingsPath, JSON.stringify({
    schemaVersion: 1,
    settings: {
      theme: "dark",
      restoreLastSession: false,           // 不恢复上次会话,避免拉起已装实例的 session
      autoRestartHostOnce: true,
      agentDir,                             // ← 关键:独立 host 数据目录
      extensionDecisionPresentation: "auto",
      terminalProfile: "windows-powershell",
      conversationContentWidth: 668,
      knownWorkspaces: [],
      useCases: {},
    },
  }, null, 2));
  console.log(`[dev-iso] 预置 settings: ${settingsPath} (agentDir=${agentDir})`);
}

// 2) 环境变量:隔离 config + WebView2 开 CDP 调试端口 + cargo 可用
// Windows PATH 要用反斜杠/分号格式,不能用 MSYS 的 /c/.../:...
const cargoBin = process.env.USERPROFILE
  ? `${process.env.USERPROFILE}/.cargo/bin`
  : "C:/Users/xiaoziyi/.cargo/bin";
const env = {
  ...process.env,
  PIDECK_CONFIG_DIR: configDir,
  WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${cdpPort}`,
  PATH: `${cargoBin};${process.env.PATH ?? ""}`,
};

console.log(`[dev-iso] 启动 tauri:dev (CDP 端口 ${cdpPort}, config=${configDir}, agent=${agentDir})`);

// 3) 起 tauri:dev(stdio 继承,日志直接可见)
// 不用 shell:true(env 会经 cmd 链路丢失),直接用 node 调 corepack 的 pnpm.js,
// 子进程直接继承父进程 env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS 能直达 WebView2。
const pnpmJs = "D:/LXCode/resources/node/node_modules/corepack/dist/pnpm.js";
const child = spawn(process.execPath, [pnpmJs, "--filter", "@lxcode/desktop", "run", "tauri:dev"], {
  cwd: root,
  stdio: "inherit",
  env,
  windowsHide: false,
});

let stopping = false;
function cleanup() {
  if (stopping) return; stopping = true;
  spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
}
process.once("SIGINT", () => { cleanup(); process.exit(130); });
process.once("SIGTERM", () => { cleanup(); process.exit(143); });
child.once("exit", (code) => { process.exitCode = code ?? 0; });
