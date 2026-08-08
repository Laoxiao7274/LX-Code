const res=await fetch("http://localhost:9223/json").then(r=>r.json());
const t=res.find(x=>x.title==="LXCode");
const ws=new WebSocket(t.webSocketDebuggerUrl);
ws.onopen=async()=>{
  ws.send(JSON.stringify({id:1,method:"Runtime.evaluate",params:{expression:`(async()=>{
    const m=await import('/src/lib/stores/app-store.ts');
    const s=m.useAppStore.getState();
    const host=s.host, workspace=s.workspace;
    const ctx={expectedHostInstanceId:host.hostInstanceId,expectedWorkspaceId:workspace.id,expectedWorkspaceRevision:workspace.revision,expectedSessionId:host.sessionId,expectedSessionRevision:host.sessionRevision,expectedPackageRevision:host.packageRevision||0};
    s.enqueueExtensionUiRequest({requestId:'cdp-'+Date.now(),kind:'select',title:'方案确认',message:'CDP 测试(带 context)',options:[{id:'按方案执行',label:'按方案执行'},{id:'调整后再执行',label:'调整后再执行'},{id:'重新规划',label:'重新规划'}],context:ctx,timeoutMs:120000,allowFreeform:true});
    return 'ok host='+host.hostInstanceId.slice(0,8);
  })()`,awaitPromise:true,returnByValue:true}}));
};
ws.onmessage=(e)=>{const m=JSON.parse(e.data.toString());if(m.id===1){console.log('结果:',m.result?.result?.value||JSON.stringify(m.result));ws.close();process.exit(0);}};
ws.onerror=(e)=>{console.error(e.message);process.exit(1);};
setTimeout(()=>{console.error("超时");process.exit(1);},15000);
