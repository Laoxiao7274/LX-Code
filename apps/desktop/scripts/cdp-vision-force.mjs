// 强制 AI 调 vision_analyze:发明确指令 + 抓 host 日志的 vision 调用错误
import { writeFileSync } from "node:fs";
const res = await fetch("http://localhost:9223/json").then(r=>r.json());
const t = res.find(x=>x.title==="LXCode");
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

ws.onopen=async()=>{
  try {
    console.log("=== 发明确指令让 AI 必须调 vision_analyze ===");
    const r = await send("Runtime.evaluate", { expression: `(async () => {
      try {
        const storeMod = await import('/src/lib/stores/app-store.ts');
        const ctxMod = await import('/src/lib/bridge/host-context.ts');
        const clientMod = await import('/src/lib/bridge/host-client.ts');
        const store = storeMod.useAppStore;
        const s = store.getState();
        const host = s.host, workspace = s.workspace, session = s.session;
        if (!host || !workspace || !session) return 'state not ready';
        const context = ctxMod.activeSessionContext(host, workspace, session);
        const hostClient = clientMod.hostClient;
        // 明确强制 AI 调工具
        const res = await hostClient.request('agent.prompt', context, {
          text: '你必须立即调用 vision_analyze 工具,参数 imagePath 指向 C:/Users/xzy/Desktop/my/lx-code-next/apps/desktop/scripts/tmp/cdp-confirm-modal.png。不要思考其他方案,不要自己写代码,直接调 vision_analyze 工具。'
        }, null);
        return 'prompt ok=' + res.ok + (res.ok ? '' : ' err=' + JSON.stringify(res.error).slice(0,200));
      } catch (e) { return 'err: ' + e.message; }
    })()`, awaitPromise: true, returnByValue: true });
    console.log("发送:", r.result?.value);

    // 等 AI 调 vision_analyze + 看结果
    console.log("等待 AI 调 vision_analyze(25s)...");
    for (let i = 0; i < 5; i++) {
      await new Promise(r=>setTimeout(r,5000));
      const txt = await evalJS(`document.body.innerText.slice(-300)`);
      const hit = txt?.match(/vision_analyze|缺少|API key|失败|颜色|color|识别|red/i)?.[0] || '...';
      console.log(`  ${(i+1)*5}s: ${hit}`);
    }
    const lastMsg = await evalJS(`document.body.innerText.slice(-500)`);
    console.log("\n=== 最后文本 ===");
    console.log(lastMsg);
    ws.close(); process.exit(0);
  } catch(e) {
    console.error("异常:", e.message);
    process.exit(1);
  }
};
ws.onerror=(e)=>{console.error(e.message);process.exit(1);};
setTimeout(()=>{console.error("超时");process.exit(1);},60000);
