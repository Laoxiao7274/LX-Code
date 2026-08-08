import WebSocket from "ws";
import { writeFileSync } from "node:fs";
const cdpHttp = "http://127.0.0.1:9223";
const out = process.argv[2];
const expr = process.argv[3] || "";
async function main() {
  let page;
  for (let i = 0; i < 10 && !page; i++) {
    const res = await fetch(`${cdpHttp}/json`);
    const targets = (await res.json()) ?? [];
    page = targets.find((t) => t.type === "page" && t.url.includes("127.0.0.1:1420"));
    if (!page) await new Promise((r) => setTimeout(r, 500));
  }
  if (!page) { console.error("no 1420 page after retries"); process.exit(1); }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pending = new Map();
  const send = (m, p = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  await new Promise((r, e) => { ws.on("open", r); ws.on("error", e); });
  ws.on("message", (d) => { const m = JSON.parse(d.toString()); if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(Error(m.error.message)) : res(m.result); } });
  try {
    await send("Runtime.enable");
    if (out) {
      await send("Page.enable");
      await new Promise((r) => setTimeout(r, 600));
      const r = await send("Page.captureScreenshot", { format: "png" });
      writeFileSync(out, Buffer.from(r.data, "base64"));
      console.log("screenshot:", out);
    } else {
      const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
      console.log(r?.result?.value ?? r?.result?.description ?? JSON.stringify(r?.result));
      if (r?.exceptionDetails) console.log("EXC:", JSON.stringify(r.exceptionDetails).slice(0, 400));
    }
  } finally { ws.close(); }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
