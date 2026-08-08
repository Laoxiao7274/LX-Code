// 直接通过 hostClient 发 agent.prompt,触发 vision_analyze,抓真实错误
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
    await send("Runtime.enable");
    console.log("=== 直接调 agent.prompt 触发 vision_analyze ===");

    const r = await send("Runtime.evaluate", { expression: `(async () => {
      try {
        const storeMod = await import('/src/lib/stores/app-store.ts');
        const ctxMod = await import('/src/lib/bridge/host-context.ts');
        const clientMod = await import('/src/lib/bridge/host-client.ts');
        const store = storeMod.useAppStore;
        const s = store.getState();
        const host = s.host, workspace = s.workspace, session = s.session;
        if (!host || !workspace || !session) return 'state not ready: host=' + !!host + ' ws=' + !!workspace + ' se=' + !!session;
        const context = ctxMod.activeSessionContext(host, workspace, session);
        const hostClient = clientMod.hostClient;
        // 发一条让 AI 调 vision_analyze 的消息
        const res = await hostClient.request('agent.prompt', context, {
          text: '请用 vision_analyze 工具识别这张图片(一个红色像素点): data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
        }, null);
        return 'prompt 发送结果: ok=' + res.ok + (res.ok ? '' : ' error=' + JSON.stringify(res.error).slice(0,300));
      } catch (e) { return 'err: ' + e.message + ' | ' + (e.stack||'').slice(0,200); }
    })()`, awaitPromise: true, returnByValue: true });
    console.log(r.result?.value);

    // 等 AI 响应 + 可能调 vision_analyze
    console.log("等待 AI 响应(20s)...");
    for (let i = 0; i < 4; i++) {
      await new Promise(r=>setTimeout(r,5000));
      const status = await evalJS(`(document.body.innerText.match(/vision|视觉|识别|color|颜色|error|错误|缺少|API key|失败/i)?.[0]) || 'thinking...'`);
      console.log(`  ${(i+1)*5}s:`, status);
    }
    await shot("15-vision-response");

    // 读完整最后消息
    const lastMsg = await evalJS(`document.body.innerText.slice(-600)`);
    console.log("\n=== 最后界面文本 ===");
    console.log(lastMsg);

    ws.close(); process.exit(0);
  } catch(e) {
    console.error("异常:", e.message);
    process.exit(1);
  }
};
ws.onerror=(e)=>{console.error(e.message);process.exit(1);};
setTimeout(()=>{console.error("超时");process.exit(1);},60000);
