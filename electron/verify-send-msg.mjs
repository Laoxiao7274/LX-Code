// 验证:用 LXCode 配的 mytai 真实发一条消息,看哪种协议能跑通
import { createAgentSession, ModelRuntime, SessionManager } from "@earendil-works/pi-coding-agent";
import path from "node:path";
import os from "node:os";

const lxcodeDir = path.join(os.homedir(), ".lxcode");
const modelsPath = path.join(lxcodeDir, "models.json");

const rt = await ModelRuntime.create({
  authPath: path.join(lxcodeDir, "auth.json"),
  modelsPath,
});

// 检查 pi 是否找到 mytai/MYT
const models = rt.getModels("mytai");
console.log("[test] mytai models:", models.map((m) => ({ id: m.id, provider: m.provider })));
const myModel = models.find((m) => m.id === "MYT");
console.log("[test] 选中模型:", { id: myModel?.id, provider: myModel?.provider });

if (!myModel) {
  console.log("[test] ❌ 找不到模型");
  process.exit(1);
}

// 创建会话 + setModel
const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),
  modelRuntime: rt,
  cwd: process.cwd(),
});
await session.setModel(myModel);
console.log("[test] 当前模型:", session.model?.id, "provider:", session.model?.provider);

// 发消息
console.log("[test] 发送: 你好");
let textCount = 0;
let errEvent = null;
const unsub = session.subscribe((e) => {
  if (e.type === "message_update") {
    const ae = e.assistantMessageEvent;
    if (ae.type === "text_delta") {
      textCount++;
      process.stdout.write(ae.delta);
    } else if (ae.type === "error") {
      errEvent = ae;
      console.log("\n[test] ❌ error event:", ae.message ?? ae);
    }
  } else if (e.type === "prompt_end") {
    console.log("\n[test] prompt_end, text_delta 数:", textCount, "error:", errEvent?.message);
  }
});

try {
  await session.prompt("说一个字:好");
} catch (e) {
  console.log("\n[test] ❌ prompt 抛错:", String(e).slice(0, 200));
}
unsub();
