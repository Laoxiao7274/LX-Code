const res = await fetch("http://localhost:9223/json").then(r=>r.json());
const t = res.find(x=>x.title==="LXCode");
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id=1;
const errs=[];
ws.onopen=()=>{
  ws.send(JSON.stringify({id:id++,method:"Runtime.enable"}));
  ws.send(JSON.stringify({id:id++,method:"Log.enable"}));
  // 等 1 秒让监听就绪,然后点 Reload UI 触发重新渲染崩溃
  setTimeout(()=>{
    ws.send(JSON.stringify({id:id++,method:"Runtime.evaluate",params:{
      expression:`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/reload/i.test(x.textContent||''));if(b){b.click();return 'clicked';}return 'no btn';})()`,
      returnByValue:true
    }}));
  },1000);
};
ws.onmessage=(e)=>{
  const m=JSON.parse(e.data.toString());
  if(m.method==="Runtime.exceptionThrown"){
    const d=m.params.exceptionDetails;
    errs.push({text:d.text,desc:d.exception?.description,line:d.lineNumber,col:d.columnNumber,scriptId:d.scriptId});
  }
  if(m.method==="Log.entryAdded"&&m.params.entry.level==="error"){
    console.log("LOGERR:",m.params.entry.text?.slice(0,300));
  }
  if(m.id&&m.result?.result?.value){console.log("click:",m.result.result.value);}
};
ws.onerror=(e)=>console.error(e.message);
setTimeout(()=>{
  console.log("抓到错误数:",errs.length);
  errs.forEach((x,i)=>{
    console.log(`\n[${i}]`,x.text);
    console.log(x.desc?.slice(0,800));
  });
  // 拿 scriptId 对应的 url
  if(errs.length){
    const ids=[...new Set(errs.map(x=>x.scriptId))];
    console.log("\nscriptIds:",ids);
  }
  process.exit(0);
},6000);
