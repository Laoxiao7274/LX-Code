// 抓首次渲染崩溃的完整错误栈(hard reload 触发首次渲染)
const res = await fetch("http://localhost:9223/json").then(r=>r.json());
const t = res.find(x=>x.title==="LXCode");
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id=1;
const errs=[];
let pageReloaded=false;
ws.onopen=()=>{
  ws.send(JSON.stringify({id:id++,method:"Runtime.enable"}));
  ws.send(JSON.stringify({id:id++,method:"Log.enable"}));
  // 先 reload 当前(已渲染)页面,模拟首次渲染
  setTimeout(()=>{
    ws.send(JSON.stringify({id:id++,method:"Page.reload",params:{ignoreCache:true}}));
    pageReloaded=true;
    console.log("已发 Page.reload");
  },500);
};
ws.onmessage=(e)=>{
  const m=JSON.parse(e.data.toString());
  if(m.method==="Runtime.exceptionThrown"){
    const d=m.params.exceptionDetails;
    errs.push({text:d.text,desc:d.exception?.description,line:d.lineNumber,col:d.columnNumber,scriptId:d.scriptId,stack:d.exception?.stackTrace});
  }
  if(m.method==="Log.entryAdded"&&m.params.entry.level==="error"){
    const en=m.params.entry;
    if(/TypeError|expectedSession|undefined/.test(en.text||"")){
      console.log("[LOGERR]",en.text?.slice(0,400));
    }
  }
};
ws.onerror=(e)=>console.error(e.message);
setTimeout(async()=>{
  console.log("抓到 exception 数:",errs.length);
  for(const x of errs){
    console.log("\n--- exception ---");
    console.log("text:",x.text);
    console.log("desc:",x.desc?.slice(0,1000));
    if(x.stack?.callFrames){
      console.log("stack:");
      x.stack.callFrames.slice(0,8).forEach(f=>console.log("  ",f.functionName,f.url?.split("/").pop()+":"+f.lineNumber));
    }
  }
  // 拿 scriptId → url 映射
  if(errs.length){
    const ids=[...new Set(errs.map(x=>x.scriptId))];
    for(const sid of ids){
      try{
        const r=await new Promise((resolve,reject)=>{
          const myId=id++;
          const h=(e)=>{const m=JSON.parse(e.data.toString());if(m.id===myId){ws.removeEventListener("message",h);resolve(m.result);}};
          ws.addEventListener("message",h);
          ws.send(JSON.stringify({id:myId,method:"Debugger.getScriptSource",params:{scriptId:sid}}));
        });
        console.log(`\nscript ${sid} source 前 200 字符:`,r.scriptSource?.slice(0,200));
      }catch(e){console.log("script",sid,"取不到源码");}
    }
  }
  ws.close();process.exit(0);
},8000);
