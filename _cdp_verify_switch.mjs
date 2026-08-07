// 精确找加载条:带 animate-spin svg + 文案,且是窄条(height 小)
const targets = await (await fetch("http://127.0.0.1:9222/json")).json();
const page = targets.find(t => t.type === "page" && (t.url.includes("1420") || t.url.includes("tauri.localhost")) && !t.url.includes("devtools"));
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pending = new Map();
const once = (m, p = {}) => new Promise((res, rej) => { const my = ++id; pending.set(my, { res, rej }); ws.send(JSON.stringify({ id: my, method: m, params: p })); });
ws.addEventListener("message", (e) => { if (typeof e.data !== "string") return; const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const o = pending.get(m.id); pending.delete(m.id); m.error ? o.rej(new Error(m.error.message)) : o.res(m.result); } });
await new Promise((r, rej) => { ws.addEventListener("open", r); ws.addEventListener("error", rej); });
await once("Runtime.enable");

// 用 MutationObserver 监听加载条出现,点击切换后捕获
await once("Runtime.evaluate", {
  expression: `(()=>{
    window.__barCapture = null;
    window.__barObserver = new MutationObserver(()=>{
      // 找直接含切换文案且带 svg.spin 的 div(窄条)
      const bars = [...document.querySelectorAll('div')].filter(d => {
        const t = d.textContent || '';
        const r = d.getBoundingClientRect();
        return (t.includes('正在切换会话') || t.includes('Switching session')) && r.height < 60 && r.width > 100 && d.querySelector('svg.animate-spin, svg[class*="animate-spin"]');
      });
      if (bars.length) {
        const b = bars[0];
        const rect = b.getBoundingClientRect();
        window.__barCapture = {
          text: b.textContent.trim(),
          className: b.className,
          rect: {top: Math.round(rect.top), height: Math.round(rect.height), width: Math.round(rect.width)},
          bg: getComputedStyle(b).backgroundColor,
          borderBottom: getComputedStyle(b).borderBottomColor,
        };
      }
    });
    window.__barObserver.observe(document.body, {childList:true, subtree:true, attributes:true});
    // 点第二个会话触发
    const items = [...document.querySelectorAll('li button')].filter(b => {
      const t = b.textContent || ''; return t.length > 0 && t.length < 80 && !t.includes('对话') && !b.closest('form');
    });
    if (items[1]) items[1].click();
    return true;
  })()`,
  returnByValue: true,
});
// 等加载条出现(切换 ~500ms)
await new Promise((r) => setTimeout(r, 150));
const r2 = await once("Runtime.evaluate", {
  expression: `JSON.stringify(window.__barCapture)`,
  returnByValue: true,
});
console.log("捕获加载条:", JSON.parse(r2.result.value));
window.__barObserver && await once("Runtime.evaluate", { expression: `window.__barObserver.disconnect()`, returnByValue: true });
ws.close(); process.exit(0);
