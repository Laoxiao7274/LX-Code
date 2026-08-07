const targets = await (await fetch("http://127.0.0.1:9222/json")).json();
const page = targets.find(t => t.type === "page" && t.url.includes("1420") && !t.url.includes("devtools"));
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id=0; const p=new Map();
const once=(m,p2)=>new Promise((r,rej)=>{const my=++id;p.set(my,{r,rej});ws.send(JSON.stringify({id:my,method:m,params:p2}));});
ws.addEventListener("message",e=>{const r=e?.data;if(typeof r!=="string")return;const m=JSON.parse(r);if(m.id&&p.has(m.id)){const o=p.get(m.id);p.delete(m.id);m.error?o.rej(new Error(m.error.message)):o.r(m.result);}});
await new Promise((r,rej)=>{ws.addEventListener("open",r);ws.addEventListener("error",rej);});
await once("Runtime.enable");
// 读 store 的 session.model 完整(rehydrate 里的)。从 React fiber 找不到,改 hook host 事件。
// 直接触发一次 model.setThinkingLevel(off) 看返回 snap.model.reasoning
await once("Runtime.evaluate",{expression:`(()=>{window.__cap=null;const o=window.__TAURI_INTERNALS__.invoke;window.__TAURI_INTERNALS__.invoke=async function(c,a){if(c==='pi_host_send'&&a?.line){const r=o.apply(this,arguments);r.then(x=>{if(/session.snapshot|model.changed/.test(a.line))window.__cap=x}).catch(()=>{});return r}return o.apply(this,arguments)}})()`,returnByValue:true});
ws.close();process.exit(0);
