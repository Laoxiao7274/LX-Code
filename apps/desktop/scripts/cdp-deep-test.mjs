// 深度交互测试
import { writeFileSync, mkdirSync } from "node:fs";
const SHOT_DIR = "apps/desktop/scripts/tmp/cdp-test";
mkdirSync(SHOT_DIR, { recursive: true });
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
async function shot(name){const r=await send("Page.captureScreenshot",{format:"png"});writeFileSync(`${SHOT_DIR}/${name}.png`,Buffer.from(r.data,"base64"));console.log("📷",name);}
async function evalJS(js){const r=await send("Runtime.evaluate",{expression:js,awaitPromise:true,returnByValue:true});return r.result?.value;}
async function clickAt(x,y){await send("Input.dispatchMouseEvent",{type:"mousePressed",x,y,button:"left",clickCount:1});await send("Input.dispatchMouseEvent",{type:"mouseReleased",x,y,button:"left",clickCount:1});}

ws.onopen=async()=>{
  try {
    console.log("=== 11. 切到模型服务设置 ===");
    // 找设置页导航项
    const navItems = await evalJS(`(() => {
      const items=[...document.querySelectorAll('button, [role="button"], [role="tab"]')];
      const model=items.find(b=>/模型服务|providers|model.*service/i.test(b.textContent||''));
      if(model){model.click();return 'clicked:'+(model.textContent||'').trim().slice(0,20);}
      return 'no model service btn; all: '+items.map(i=>(i.textContent||'').trim()).filter(Boolean).slice(0,20).join('|');
    })()`);
    console.log("模型服务:",navItems?.slice(0,150));
    await new Promise(r=>setTimeout(r,800));
    await shot("06-settings-providers");

    console.log("=== 12. 切到模型用途 ===");
    const useCases = await evalJS(`(() => {
      const items=[...document.querySelectorAll('button, [role="button"], [role="tab"]')];
      const u=items.find(b=>/模型用途|use.?case|用途/i.test(b.textContent||''));
      if(u){u.click();return 'clicked:'+(u.textContent||'').trim().slice(0,20);}
      return 'no usecases btn';
    })()`);
    console.log("模型用途:",useCases);
    await new Promise(r=>setTimeout(r,800));
    await shot("07-settings-usecases");

    console.log("=== 13. 切到网页搜索设置 ===");
    const webSearch = await evalJS(`(() => {
      const items=[...document.querySelectorAll('button, [role="button"], [role="tab"]')];
      const w=items.find(b=>/网页搜索|web.?search/i.test(b.textContent||''));
      if(w){w.click();return 'clicked:'+(w.textContent||'').trim().slice(0,20);}
      return 'no websearch btn';
    })()`);
    console.log("网页搜索:",webSearch);
    await new Promise(r=>setTimeout(r,800));
    await shot("08-settings-websearch");

    console.log("=== 14. 切到自动化测试设置 ===");
    const auto = await evalJS(`(() => {
      const items=[...document.querySelectorAll('button, [role="button"], [role="tab"]')];
      const a=items.find(b=>/自动化测试|automation/i.test(b.textContent||''));
      if(a){a.click();return 'clicked:'+(a.textContent||'').trim().slice(0,20);}
      return 'no automation btn';
    })()`);
    console.log("自动化测试:",auto);
    await new Promise(r=>setTimeout(r,800));
    await shot("09-settings-automation");

    console.log("=== 15. 关设置回主界面 + 输入框打字 ===");
    // 关设置(找关闭按钮或 Esc)
    await evalJS(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/关闭|close|返回/i.test(x.textContent||'')||x.querySelector('svg[class*="close"],svg[class*="Close"]'));if(b){b.click();return 'closed';}return 'no close';})()`);
    await new Promise(r=>setTimeout(r,600));
    // 用 Esc 关(如果还开着)
    await send("Input.dispatchKeyEvent",{type:"keyDown",key:"Escape",code:"Escape",windowsVirtualKeyCode:27});
    await send("Input.dispatchKeyEvent",{type:"keyUp",key:"Escape",code:"Escape",windowsVirtualKeyCode:27});
    await new Promise(r=>setTimeout(r,500));
    await shot("10-back-to-chat");
    // 在输入框打字
    const typed = await evalJS(`(() => {
      const ta=document.querySelector('textarea');
      if(!ta)return 'no textarea';
      ta.focus();
      const setter=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set;
      setter.call(ta,'测试输入:你好LXCode');
      ta.dispatchEvent(new Event('input',{bubbles:true}));
      return 'typed: '+ta.value;
    })()`);
    console.log("打字:",typed);
    await new Promise(r=>setTimeout(r,500));
    await shot("11-typed");

    console.log("=== 16. 触发确认弹窗(reload 后再测) ===");
    const triggered = await evalJS(`(() => {
      // 通过 store 触发
      const stores=document.querySelectorAll('*');
      // 兜底用 window 上的 zustand
      return 'evaluating...';
    })()`);
    // 直接用之前的方式
    const tr = await evalJS(`(async()=>{
      try{
        const mod=await import('/src/lib/stores/app-store.ts');
        const store=mod.useAppStore;
        const s=store.getState();
        s.enqueueExtensionUiRequest({
          requestId:'cdp-test2-'+Date.now(),
          kind:'select',
          title:'方案确认',
          message:'这是 CDP 测试的确认弹窗(reload 后)',
          options:[{id:'按方案执行',label:'按方案执行'},{id:'调整后再执行',label:'调整后再执行'},{id:'重新规划',label:'重新规划'}],
          timeoutMs:60000,allowFreeform:true,
        });
        return 'ok: triggered';
      }catch(e){return 'err: '+e.message;}
    })()`);
    console.log("触发弹窗:",tr);
    await new Promise(r=>setTimeout(r,800));
    await shot("12-confirm-modal-2");

    console.log("\n=== 深度测试完成 ===");
    ws.close();process.exit(0);
  } catch(e) {
    console.error("异常:",e.message);
    process.exit(1);
  }
};
ws.onerror=(e)=>{console.error(e.message);process.exit(1);};
setTimeout(()=>{console.error("超时");process.exit(1);},60000);
