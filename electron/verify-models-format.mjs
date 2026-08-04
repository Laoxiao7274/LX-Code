// 验证:写 pi 格式 models.json,用 pi ModelRuntime 读取,确认协议格式正确
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const lxcodeDir = path.join(os.homedir(), ".lxcode");
const modelsPath = path.join(lxcodeDir, "models.json");

// 写一个 pi 格式的 provider(对象 map)
const piFormat = {
  defaultModel: "mytai/mimo-7b",
  thinkingLevel: "medium",
  providers: {
    mytai: {
      name: "MYT AI",
      baseUrl: "https://api.mytai.com/v1",
      apiKey: "sk-test-xxx",
      api: "openai-completions",
      models: [
        { id: "mimo-7b", name: "MiMo 7B", input: ["text"], contextWindow: 128000, maxTokens: 8192 },
      ],
    },
  },
};

fs.mkdirSync(lxcodeDir, { recursive: true });
fs.writeFileSync(modelsPath, JSON.stringify(piFormat, null, 2));
console.log("[test] 写入 pi 格式 models.json:", modelsPath);

// 用 pi ModelRuntime 读
const rt = await ModelRuntime.create({
  authPath: path.join(lxcodeDir, "auth.json"),
  modelsPath,
});

const providers = rt.getProviders();
console.log("[test] providers:", providers.map((p) => ({ id: p.id, name: p.name })));

for (const p of providers) {
  const models = rt.getModels(p.id);
  console.log(`[test] ${p.id} models:`, models.map((m) => ({ id: m.id, name: m.name, provider: m.provider })));
}

const error = rt.getError?.();
if (error) console.log("[test] error:", error);
