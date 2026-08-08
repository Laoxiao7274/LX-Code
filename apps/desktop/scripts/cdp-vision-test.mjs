// 在 LXCode 里发一条带图片的消息,触发 vision_analyze,抓真实错误
import { writeFileSync, mkdirSync } from "node:fs";
const SHOT_DIR = "apps/desktop/scripts/tmp/cdp-test";
mkdirSync(SHOT_DIR, { recursive: true });
const res = await fetch("http://localhost:9223/json").then(r=>r.json());
const t = res.find(x=>x.title==="LXCode");
if(!t){console.error("没找到 LXCode");process.exit(1);}
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id=1;
function send(method, params={}) {
  return new Promise((resolve,reject)=>{
    const myId=id++;
    const h=(e)=>{const m=JSON.parse(e.data.toString());if(m.id===myId){ws.removeEventListener("message",h);m.error?reject(new Error(JSON.stringify(m.error))):resolve(m.result);}};
    ws.addEventListener("message",h);
    ws.send(JSON.stringify({id:myId,method,params}));
  });
}
async function evalJS(js){const r=await send("Runtime.evaluate",{expression:js,awaitPromise:true,returnByValue:true});return r.result?.value;}
async function shot(name){const r=await send("Page.captureScreenshot",{format:"png"});writeFileSync(`${SHOT_DIR}/${name}.png`,Buffer.from(r.data,"base64"));}

ws.onopen=async()=>{
  try {
    // 启用 console + exception 捕获
    await send("Runtime.enable");
    await send("Log.enable");
    console.log("已连接 LXCode");

    // 通过 host client 发消息(走真实链路)
    // 找 hostClient 实例 + 发带图消息触发 vision_analyze
    const r = await send("Runtime.evaluate", { expression: `(async () => {
      try {
        // 找 hostClient(挂在 window 或通过 store)
        const mod = await import('/src/lib/stores/app-store.ts');
        const store = mod.useAppStore;
        const s = store.getState();
        // 找发送消息的方法
        const sendFn = s.send || s.sendMessage || s.prompt;
        if (!sendFn) {
          // 列出所有方法找发送相关的
          const methods = Object.keys(s).filter(k => typeof s[k] === 'function' && /send|prompt|message|chat/i.test(k));
          return '没直接发送方法,候选: ' + methods.join(', ');
        }
        return '找到发送方法: ' + sendFn.name;
      } catch (e) { return 'err: ' + e.message; }
    })()`, awaitPromise: true, returnByValue: true });
    console.log("发送方法探测:", r.result?.value);

    // 直接看 host 日志里的 vision 调用 — 先发一条纯文本消息让 AI 尝试识图
    // 用 textarea 输入 + 模拟提交
    const typed = await evalJS(`(() => {
      const ta = document.querySelector('textarea');
      if(!ta) return 'no textarea';
      ta.focus();
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set;
      setter.call(ta, '请识别这张图片: 用 vision_analyze 工具分析一张红色测试图');
      ta.dispatchEvent(new Event('input',{bubbles:true}));
      return 'typed';
    })()`);
    console.log("输入:", typed);
    await shot("13-before-send");

    // 按 Ctrl+Enter 或 Enter 发送
    await send("Input.dispatchKeyEvent",{type:"keyDown",key:"Enter",code:"Enter",windowsVirtualKeyCode:13});
    await send("Input.dispatchKeyEvent",{type:"keyUp",key:"Enter",code:"Enter",windowsVirtualKeyCode:13});
    console.log("已按 Enter 发送");

    // 等 AI 响应(可能调 vision_analyze)
    console.log("等待 AI 响应(15s)...");
    await new Promise(r=>setTimeout(r,15000));
    await shot("14-after-send");

    // 读最后一条消息内容(看 AI 说了什么 / 报错)
    const lastMsg = await evalJS(`(() => {
      const msgs = document.querySelectorAll('[class*="message"], [class*="Message"], [data-message]');
      if(!msgs.length) {
        // 兜底读 body 文本
        return document.body.innerText.slice(-500);
      }
      return msgs[msgs.length-1].innerText.slice(0,400);
    })()`);
    console.log("最后消息:", lastMsg?.slice(0,400));

    ws.close(); process.exit(0);
  } catch(e) {
    console.error("异常:", e.message);
    process.exit(1);
  }
};
ws.onerror=(e)=>{console.error(e.message);process.exit(1);};
setTimeout(()=>{console.error("超时");process.exit(1);},60000);
