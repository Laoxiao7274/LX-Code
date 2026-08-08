// LXCode 全量 CDP 测试 — 逐项截图 + 读结构 + 交互,发现问题记录不修
import { writeFileSync, mkdirSync } from "node:fs";

const SHOT_DIR = "apps/desktop/scripts/tmp/cdp-test";
mkdirSync(SHOT_DIR, { recursive: true });

const res = await fetch("http://localhost:9223/json").then(r => r.json());
const t = res.find(x => x.title === "LXCode");
if (!t) { console.error("没找到 LXCode 窗口"); process.exit(1); }
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 1;
const results = [];

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const myId = id++;
    const handler = (e) => {
      const m = JSON.parse(e.data.toString());
      if (m.id === myId) {
        ws.removeEventListener("message", handler);
        if (m.error) reject(new Error(JSON.stringify(m.error)));
        else resolve(m.result);
      }
    };
    ws.addEventListener("message", handler);
    ws.send(JSON.stringify({ id: myId, method, params }));
  });
}

async function shot(name) {
  const r = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(`${SHOT_DIR}/${name}.png`, Buffer.from(r.data, "base64"));
  console.log(`📷 ${name}`);
}

async function evalJS(js) {
  const r = await send("Runtime.evaluate", { expression: js, awaitPromise: true, returnByValue: true });
  return r.result?.value;
}

async function click(x, y) {
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
}

ws.onopen = async () => {
  try {
    console.log("=== 1. 初始状态(确认弹窗可能还开着) ===");
    await shot("01-initial");

    // 关掉确认弹窗(点取消按钮) - 先读弹窗结构
    const modalInfo = await evalJS(`(document.querySelector('[class*="modal"]') || document.querySelector('[role="dialog"]'))?.outerHTML?.slice(0,200) || 'no modal'`);
    results.push({ step: 1, modal: modalInfo });
    console.log("弹窗结构:", modalInfo?.slice(0, 100));

    console.log("=== 2. 读主界面结构 ===");
    const layout = await evalJS(`({
      hasSidebar: !!document.querySelector('[class*="sidebar"], [class*="Sidebar"]'),
      hasChat: !!document.querySelector('[class*="chat"], [class*="Chat"], [class*="transcript"]'),
      hasComposer: !!document.querySelector('[class*="composer"], [class*="Composer"], textarea'),
      hasToolbar: !!document.querySelector('[class*="toolbar"], [class*="Toolbar"]'),
      title: document.title,
      bodyText: document.body.innerText.slice(0,150),
    })`);
    results.push({ step: 2, layout });
    console.log("布局:", JSON.stringify(layout));

    console.log("=== 3. 点取消关弹窗(如果开着) ===");
    // 找取消按钮点掉
    const cancelled = await evalJS(`(() => {
      const btns = [...document.querySelectorAll('button')];
      const cancel = btns.find(b => /取消|cancel|关闭/i.test(b.textContent || ''));
      if (cancel) { cancel.click(); return 'clicked:' + cancel.textContent; }
      return 'no cancel btn';
    })()`);
    results.push({ step: 3, cancelled });
    console.log("取消:", cancelled);
    await new Promise(r => setTimeout(r, 600));
    await shot("02-after-cancel");

    console.log("=== 4. 测设置页 ===");
    // 找设置按钮(齿轮图标)
    const settingsOpened = await evalJS(`(() => {
      const btns = [...document.querySelectorAll('button, [role="button"]')];
      const set = btns.find(b => /设置|settings/i.test(b.textContent || b.getAttribute('aria-label') || '') || b.querySelector('svg[class*="settings"], svg[class*="Settings"]'));
      if (set) { set.click(); return 'opened:' + (set.textContent || set.getAttribute('aria-label')); }
      return 'no settings btn';
    })()`);
    results.push({ step: 4, settingsOpened });
    console.log("设置:", settingsOpened);
    await new Promise(r => setTimeout(r, 1000));
    await shot("03-settings");

    console.log("=== 5. 读设置页 tab ===");
    const tabs = await evalJS(`(() => {
      const items = [...document.querySelectorAll('[role="tab"], [class*="tab"][role], button[class*="tab"]')];
      return items.map(t => t.textContent?.trim()).filter(Boolean).slice(0,15);
    })()`);
    results.push({ step: 5, tabs });
    console.log("设置 tab:", JSON.stringify(tabs));

    console.log("=== 6. 测包管理页 ===");
    const pkgOpened = await evalJS(`(() => {
      const btns = [...document.querySelectorAll('button, [role="button"], a')];
      const pkg = btns.find(b => /包|package|扩展|extension/i.test(b.textContent || ''));
      if (pkg) { pkg.click(); return 'opened:' + pkg.textContent?.trim()?.slice(0,30); }
      return 'no pkg btn';
    })()`);
    results.push({ step: 6, pkgOpened });
    console.log("包管理:", pkgOpened);
    await new Promise(r => setTimeout(r, 1000));
    await shot("04-packages");

    console.log("=== 7. 测侧边栏工作区切换 ===");
    const sidebar = await evalJS(`(() => {
      const items = [...document.querySelectorAll('[class*="workspace"], [class*="project"], [class*="session"]')];
      return { count: items.length, samples: items.slice(0,3).map(i => i.textContent?.trim()?.slice(0,40)) };
    })()`);
    results.push({ step: 7, sidebar });
    console.log("侧边栏:", JSON.stringify(sidebar));
    await shot("05-sidebar");

    console.log("=== 8. 测输入框 ===");
    const composerTest = await evalJS(`(() => {
      const ta = document.querySelector('textarea');
      if (!ta) return 'no textarea';
      ta.focus();
      return 'found textarea, placeholder: ' + (ta.placeholder || '').slice(0,50);
    })()`);
    results.push({ step: 8, composerTest });
    console.log("输入框:", composerTest);

    console.log("=== 9. 测主题切换(如果有) ===");
    const themeInfo = await evalJS(`(() => {
      const html = document.documentElement;
      return { dark: html.classList.contains('dark'), light: html.classList.contains('light'), classes: html.className };
    })()`);
    results.push({ step: 9, themeInfo });
    console.log("主题:", JSON.stringify(themeInfo));

    console.log("=== 10. 控制台错误 ===");
    const consoleErrs = await evalJS(`(window.__lxTestErrs || [])`);
    results.push({ step: 10, consoleErrors: consoleErrs });
    console.log("控制台错误数:", consoleErrs?.length || 0);

    writeFileSync(`${SHOT_DIR}/test-results.json`, JSON.stringify(results, null, 2));
    console.log("\n=== 测试结果汇总 ===");
    console.log(JSON.stringify(results, null, 2));
    ws.close();
    process.exit(0);
  } catch (e) {
    console.error("测试异常:", e.message);
    writeFileSync(`${SHOT_DIR}/test-results.json`, JSON.stringify({ error: e.message, results }, null, 2));
    process.exit(1);
  }
};
ws.onerror = (e) => { console.error("ws error", e.message); process.exit(1); };
setTimeout(() => { console.error("总超时"); process.exit(1); }, 60000);
