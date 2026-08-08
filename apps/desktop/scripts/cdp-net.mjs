const res = await fetch("http://localhost:9223/json").then(r=>r.json());
const t = res.find(x=>x.title==="LXCode");
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id=1;
const logs=[];
ws.onopen=()=>{
  ws.send(JSON.stringify({id:id++,method:"Runtime.enable"}));
  ws.send(JSON.stringify({id:id++,method:"Network.enable"}));
  ws.send(JSON.stringify({id:id++,method:"Log.enable"}));
  setTimeout(()=>{
    ws.send(JSON.stringify({id:id++,method:"Runtime.evaluate",params:{
      expression:`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/reload/i.test(x.textContent||''));if(b)b.click();return 'clicked';})()`,returnByValue:true}}));
  },800);
};
ws.onmessage=(e)=>{
  const m=JSON.parse(e.data.toString());
  if(m.method==="Runtime.consoleAPICalled"){
    logs.push({type:m.params.type,args:m.params.args?.map(a=>a.value||a.description||a.unserializableValue).slice(0,200)});
  }
  if(m.method==="Log.entryAdded"){
    const en=m.params.entry;
    if(en.level==="error"||en.level==="warning") console.log(`[${en.level}]`,en.text?.slice(0,250),en.url||"");
  }
  if(m.method==="Network.loadingFailed"){
    console.log("404/FAIL:",m.params.requestId,m.params.errorText);
  }
  if(m.method==="Network.responseReceived"&&m.params.response?.status>=400){
    console.log("HTTP",m.params.response?.status,m.params.response?.url?.slice(-60));
  }
};
setTimeout(()=>{console.log("\nconsole logs:",logs.length);logs.slice(-10).forEach(l=>console.log(l.type,JSON.stringify(l.args).slice(0,200)));process.exit(0);},6000);
