import { writeFileSync } from "node:fs";
const res = await fetch("http://localhost:9223/json").then(r=>r.json());
const t = res.find(x=>x.title==="LXCode");
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id=1;
ws.onopen=()=>{
  ws.send(JSON.stringify({id:id++,method:"Page.captureScreenshot",params:{format:"png"}}));
};
ws.onmessage=(e)=>{
  const m=JSON.parse(e.data.toString());
  if(m.id){
    writeFileSync("apps/desktop/scripts/tmp/cdp-confirm-modal.png",Buffer.from(m.result.data,"base64"));
    console.log("截图已存 apps/desktop/scripts/tmp/cdp-confirm-modal.png");
    ws.close();process.exit(0);
  }
};
setTimeout(()=>{console.error("超时");process.exit(1);},10000);
