/**
 * CDP 操控脚本 —— 连 dev Tauri WebView(9222),截图 + 查 DOM + 交互。
 * 这是真实 Tauri 环境(带 __TAURI__ IPC),能进主界面,不卡启动屏。
 */
import { writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const CDP = "http://127.0.0.1:9222";
const SHOT = "D:/桌面/LX-Code/_dev_ui.png";

// 找 LXCode 页面 target(非 DevTools)
const targets = await (await fetch(`${CDP}/json`)).json();
const page = targets.find(t => t.type === "page" && t.url.includes("127.0.0.1:1420") && !t.url.includes("devtools"));
if (!page) { console.error("❌ 没找到 LXCode page target"); console.log("所有 target:", targets.map(t => `${t.type} ${t.title} ${t.url}`).join("\n")); process.exit(1); }
console.log("[cdp] 连接 target:", page.title, page.url);

const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pending = new Map();
const once = (m, p) => new Promise((res, rej) => { const my = ++id; pending.set(my, { res, rej }); ws.send(JSON.stringify({ id: my, method: m, params: p })); });
const evt = (n) => new Promise((res) => { const h = (ev) => { const r = ev?.data; if (typeof r !== "string") return; const m = JSON.parse(r); if (m.method === n) { ws.removeEventListener("message", h); res(m.params); } }; ws.addEventListener("message", h); });
ws.addEventListener("message", (ev) => { const r = ev?.data; if (typeof r !== "string") return; const m = JSON.parse(r); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } });
await new Promise((r, rej) => { ws.addEventListener("open", r); ws.addEventListener("error", rej); });

await once("Page.enable");
await once("Runtime.enable");

// 等 React 渲染(轮询直到有 button 或超时)
const probe = `(() => ({
  title: document.title,
  isTauri: typeof window.__TAURI_INTERNALS__ !== 'undefined',
  rootChars: document.getElementById('root')?.innerHTML?.length ?? -1,
  buttons: document.querySelectorAll('button, [role=button]').length,
  textarea: document.querySelectorAll('textarea').length,
  bodyText: document.body.innerText.replace(/\\s+/g,' ').slice(0,150),
}))()`;

let result;
for (let i = 1; i <= 6; i++) {
  await sleep(i === 1 ? 2000 : 1200);
  const r = await once("Runtime.evaluate", { expression: probe, returnByValue: true });
  result = r.result.value;
  console.log(`[cdp] 第${i}次:`, JSON.stringify(result));
  if (result.buttons > 0 || result.textarea > 0) { console.log("[cdp] ✅ UI 渲染了"); break; }
}

// 截图
const shot = await once("Page.captureScreenshot", { format: "png" });
writeFileSync(SHOT, Buffer.from(shot.data, "base64"));
console.log("[cdp] ✅ 截图:", SHOT);

ws.close();
console.log("[cdp] 完成");
process.exit(0);
