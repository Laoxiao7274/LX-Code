import { setTimeout as sleep } from "node:timers/promises";
const targets = await (await fetch("http://127.0.0.1:9222/json")).json();
const page = targets.find(t => t.type === "page" && t.url.includes("1420") && !t.url.includes("devtools"));
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id=0; const p=new Map();
const once=(m,p2)=>new Promise((r,rej)=>{const my=++id;p.set(my,{r,rej});ws.send(JSON.stringify({id:my,method:m,params:p2}));});
ws.addEventListener("message",e=>{const r=e?.data;if(typeof r!=="string")return;const m=JSON.parse(r);if(m.id&&p.has(m.id)){const o=p.get(m.id);p.delete(m.id);m.error?o.rej(new Error(m.error.message)):o.r(m.result);}});
await new Promise((r,rej)=>{ws.addEventListener("open",r);ws.addEventListener("error",rej);});
await once("Runtime.enable");
// hook invoke 捕获 setThinkingLevel 请求+响应
await once("Runtime.evaluate",{expression:`(()=>{window.__cap={sends:[],resp:null};const o=window.__TAURI_INTERNALS__.invoke;window.__TAURI_INTERNALS__.invoke=async function(c,a){if(c==='pi_host_send'&&a?.line&&/setThinkingLevel/.test(a.line)){window.__cap.sends.push(a.line);const r=o.apply(this,arguments);r.then(x=>window.__cap.resp=x).catch(e=>window.__cap.resp='ERR:'+e.message);return r}return o.apply(this,arguments)}})()`,returnByValue:true});
// 点思考展开
let btn=await once("Runtime.evaluate",{expression:`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/思考/i.test(x.textContent.trim())&&x.offsetParent!==null);if(!b)return null;const r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`,returnByValue:true});
btn=btn.result.value;
await once("Input.dispatchMouseEvent",{type:"mousePressed",x:btn.x,y:btn.y,button:"left",clickCount:1});
await once("Input.dispatchMouseEvent",{type:"mouseReleased",x:btn.x,y:btn.y,button:"left",clickCount:1});
await sleep(700);
// 用 dispatchMouseEvent 点高(真事件,触发 React onClick)
let hi=await once("Runtime.evaluate",{expression:`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='高'&&x.offsetParent!==null);if(!b)return null;const r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`,returnByValue:true});
hi=hi.result.value;
console.log("高档位位置:",hi);
if(hi){await once("Input.dispatchMouseEvent",{type:"mousePressed",x:hi.x,y:hi.y,button:"left",clickCount:1});await once("Input.dispatchMouseEvent",{type:"mouseReleased",x:hi.x,y:hi.y,button:"left",clickCount:1});}
await sleep(1800);
const cap=await once("Runtime.evaluate",{expression:`JSON.stringify({sends:window.__cap.sends,resp:window.__cap.resp})`,returnByValue:true});
console.log("IPC:",cap.result.value);
const n=await once("Runtime.evaluate",{expression:`(()=>({hasClamp:document.body.innerText.includes('不支持'),btnNow:[...document.querySelectorAll('button')].find(x=>/思考/i.test(x.textContent.trim()))?.textContent.trim()}))()`,returnByValue:true});
console.log("UI:",JSON.stringify(n.result.value));
ws.close();process.exit(0);
