const res = await fetch("http://localhost:9223/json").then(r=>r.json());
const t = res.find(x=>x.title==="LXCode");
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id=1;
ws.onopen=()=>{
  ws.send(JSON.stringify({id:id++,method:"Runtime.enable"}));
  ws.send(JSON.stringify({id:id++,method:"Log.enable"}));
};
const errs=[];
ws.onmessage=(e)=>{
  const m=JSON.parse(e.data.toString());
  if(m.method==="Runtime.exceptionThrown"){
    const d=m.params.exceptionDetails;
    errs.push({text:d.text,desc:d.exception?.description?.slice(0,600),line:d.lineNumber,scriptId:d.scriptId});
  }
  if(m.method==="Log.entryAdded"&&m.params.entry.level==="error"){
    console.log("LOGERR:",m.params.entry.text?.slice(0,200));
  }
};
ws.onerror=(e)=>console.error(e.message);
setTimeout(()=>{console.log("抓到错误数:",errs.length);errs.forEach((x,i)=>console.log(`\n[${i}]`,x.text,x.desc));process.exit(0);},8000);
