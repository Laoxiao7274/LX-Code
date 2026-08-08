import { writeFileSync } from "node:fs";
const res = await fetch("http://localhost:9223/json").then(r=>r.json());
const t = res.find(x=>x.title==="LXCode");
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id=1;
function send(method, params={}) {
  return new Promise((resolve,reject)=>{
    const myId=id++;
    const h=(e)=>{
      const m=JSON.parse(e.data.toString());
      if(m.id===myId){ws.removeEventListener("message",h);m.error?reject(new Error(JSON.stringify(m.error))):resolve(m.result);}
    };
    ws.addEventListener("message",h);
    ws.send(JSON.stringify({id:myId,method,params}));
  });
}
ws.onopen=async()=>{
  // 读完整 DOM 结构(顶层元素 + class)
  const dom = await send("Runtime.evaluate",{expression:`(function(){
    const walk=(el,depth=0)=>{
      if(depth>4) return null;
      const tag=el.tagName?.toLowerCase()||"";
      const cls=el.className&&typeof el.className==="string"?el.className.slice(0,80):"";
      const id=el.id?"#"+el.id:"";
      const txt=(el.textContent||"").trim().slice(0,30);
      const info={tag,cls,id};
      if(txt) info.txt=txt;
      if(el.children?.length) info.children=[...el.children].slice(0,8).map(c=>walk(c,depth+1)).filter(Boolean);
      return info;
    };
    return JSON.stringify(walk(document.body,0));
  })()`,returnByValue:true});
  console.log("DOM 结构:");
  console.log(dom.result?.value);
  // 看有没有 #root
  const rootInfo = await send("Runtime.evaluate",{expression:`({
    root: !!document.getElementById('root'),
    rootChildren: document.getElementById('root')?.children?.length,
    bodyChildren: document.body.children?.length,
    bodyHTML: document.body.innerHTML.slice(0,500),
  })`,returnByValue:true});
  console.log("\nRoot info:", JSON.stringify(rootInfo.result?.value,null,2));
  ws.close();process.exit(0);
};
ws.onerror=(e)=>{console.error(e.message);process.exit(1);};
setTimeout(()=>{console.error("超时");process.exit(1);},15000);
