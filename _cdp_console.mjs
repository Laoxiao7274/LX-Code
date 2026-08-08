import WebSocket from "ws";
const cdpHttp = "http://127.0.0.1:9222";
async function main() {
  let page;
  for (let i = 0; i < 10 && !page; i++) {
    const res = await fetch(`${cdpHttp}/json`);
    const targets = (await res.json()) ?? [];
    page = targets.find((t) => t.type === "page" && t.url.includes("tauri.localhost"));
    if (!page) await new Promise((r) => setTimeout(r, 500));
  }
  if (!page) { console.error("no page"); process.exit(1); }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pending = new Map();
  const send = (m, p = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  await new Promise((r, e) => { ws.on("open", r); ws.on("error", e); });
  ws.on("message", (d) => { const m = JSON.parse(d.toString()); if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(Error(m.error.message)) : res(m.result); } });
  try {
    await send("Runtime.enable");
    await send("Log.enable");
    // 读取已缓存的 console 日志
    const r = await send("Runtime.evaluate", {
      expression: `(function(){
        // 尝试从 console 缓存读取(无直接 API,改用 PerformanceTimeline / stored)
        return "console-check";
      })()`,
      returnByValue: true,
    });
    console.log("eval:", r?.result?.value);
    // 收集后续 Log.entry,但历史日志只能通过 Log.enable 后的 entryAdded 事件
    // 这里先看是否有全局错误存储
  } finally { ws.close(); }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
