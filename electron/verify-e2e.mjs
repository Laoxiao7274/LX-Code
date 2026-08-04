// 完整端到端:模拟前端 send → agent.prompt → serializeEvent → 看输出
import { createAgentSession, ModelRuntime, SessionManager } from "@earendil-works/pi-coding-agent";
import path from "node:path";
import os from "node:os";

const lxcodeDir = path.join(os.homedir(), ".lxcode");
const modelsPath = path.join(lxcodeDir, "models.json");

console.log("=== 1. ModelRuntime.create(读 LXCode models.json) ===");
const rt = await ModelRuntime.create({
  authPath: path.join(lxcodeDir, "auth.json"),
  modelsPath,
});

console.log("=== 2. 找 mytai/MYT ===");
const myModel = rt.getModels("mytai").find((m) => m.id === "MYT");
console.log("   模型:", { id: myModel?.id, provider: myModel?.provider });

console.log("=== 3. createAgentSession + setModel ===");
const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),
  modelRuntime: rt,
  cwd: process.cwd(),
});
await session.setModel(myModel);
console.log("   当前模型:", session.model?.id, "provider:", session.model?.provider);

console.log("=== 4. 模拟 serializeEvent(和 agent-service 一样) ===");
function serializeEvent(event) {
  switch (event.type) {
    case "message_start":
    case "message_end":
      return { type: event.type };
    case "message_update": {
      const ae = event.assistantMessageEvent;
      return {
        type: "message_update",
        assistantMessageEvent: {
          type: ae.type,
          delta: "delta" in ae ? ae.delta : undefined,
        },
      };
    }
    default:
      return { type: event.type };
  }
}

console.log("=== 5. prompt 发消息 ===");
let textOut = "";
let thinkOut = "";
let eventTypes = [];
const unsub = session.subscribe((e) => {
  const se = serializeEvent(e);
  eventTypes.push(se.type + (se.assistantMessageEvent ? ":" + se.assistantMessageEvent.type : ""));
  if (se.type === "message_update") {
    const ae = se.assistantMessageEvent;
    if (ae.type === "text_delta" && ae.delta) textOut += ae.delta;
    if (ae.type === "thinking_delta" && ae.delta) thinkOut += ae.delta;
  }
});

try {
  await session.prompt("说一个字:好");
  console.log("   事件类型:", eventTypes.slice(0, 15).join(" "), "...共", eventTypes.length, "个");
  console.log("   思考:", thinkOut.slice(0, 100));
  console.log("   回复:", textOut);
} catch (e) {
  console.log("   ❌ 抛错:", String(e).slice(0, 300));
}
unsub();
