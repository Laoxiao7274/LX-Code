// 查当前会话注册了哪些工具(看 vision_analyze 在不在)
const res = await fetch("http://localhost:9223/json").then(r=>r.json());
const t = res.find(x=>x.title==="LXCode");
const ws = new WebSocket(t.webSocketDebuggerUrl);
ws.onopen=async()=>{
  ws.send(JSON.stringify({id:1,method:"Runtime.evaluate",params:{expression:`(async()=>{
    const storeMod=await import('/src/lib/stores/app-store.ts');
    const s=storeMod.useAppStore.getState();
    const tools=s.tools||[];
    return JSON.stringify({count:tools.length,names:tools.map(t=>t.name||t.id).filter(Boolean).slice(0,30),hasVision:tools.some(t=>/vision/i.test(t.name||t.id||''))});
  })()`,awaitPromise:true,returnByValue:true}}));
};
ws.onmessage=(e)=>{
  const m=JSON.parse(e.data.toString());
  if(m.id===1){console.log(m.result?.result?.value);ws.close();process.exit(0);}
};
setTimeout(()=>{console.error("超时");process.exit(1);},10000);
