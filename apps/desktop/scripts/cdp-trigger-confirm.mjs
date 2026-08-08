// 通过 CDP 触发 LXCode 确认弹窗(模拟 test-flow confirm_plan)
// 用 chrome-devtools 协议直接 eval JS 调前端的 app-store.enqueueExtensionUiRequest
import { spawn } from "node:child_process";

// 找 LXCode 页面 target
const res = await fetch("http://localhost:9223/json").then(r => r.json());
const target = res.find(t => t.title === "LXCode");
if (!target) { console.error("没找到 LXCode 窗口"); process.exit(1); }
console.log("target:", target.webSocketDebuggerUrl);

// 用 CDP Runtime.evaluate 注入 JS
const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 1;
ws.onopen = () => {
  // 构造 confirm(select 类型)请求,模拟 confirm_plan 三选项
  const js = `
    (async () => {
      const store = await import('/src/lib/stores/app-store.ts').then(m => m.useAppStore).catch(() => null);
      if (!store) {
        // 兜底:从 window 找
        return 'no store import';
      }
      const s = store.getState();
      const req = {
        requestId: 'cdp-test-' + Date.now(),
        kind: 'select',
        title: '方案确认',
        message: '是否开始执行?(CDP 触发的测试弹窗)',
        options: [
          { id: '按方案执行', label: '按方案执行' },
          { id: '调整后再执行', label: '调整后再执行' },
          { id: '重新规划', label: '重新规划' },
        ],
        timeoutMs: 120000,
        allowFreeform: true,
      };
      s.enqueueExtensionUiRequest(req);
      return 'ok: 已触发确认弹窗';
    })()
  `;
  ws.send(JSON.stringify({ id: id++, method: "Runtime.evaluate", params: { expression: js, awaitPromise: true, returnByValue: true } }));
};
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data.toString());
  if (msg.id) {
    console.log("结果:", JSON.stringify(msg.result?.result?.value ?? msg.result, null, 2));
    ws.close();
    process.exit(0);
  }
};
ws.onerror = (e) => { console.error("ws error", e.message); process.exit(1); };
setTimeout(() => { console.error("超时"); process.exit(1); }, 10000);
