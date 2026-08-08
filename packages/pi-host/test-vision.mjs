// 直接测视觉模型调用(模拟 vision_analyze 工具的逻辑)
import { complete } from "@earendil-works/pi-ai/compat";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// 读配置
const configDir = process.env.LXCODE_CONFIG_DIR || "C:/Users/xzy/AppData/Roaming/com.lxcode.app";
const modelsPath = join(process.env.HOME || "C:/Users/xzy", ".lxcode", "models.json");
const settingsPath = join(configDir, "desktop-settings.json");

const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
const visionKey = settings.settings?.useCases?.vision;
console.log("vision key:", visionKey);
if (!visionKey) { console.error("没配视觉模型"); process.exit(1); }

const [providerId, modelId] = visionKey.split("/");
const models = JSON.parse(readFileSync(modelsPath, "utf-8"));
const provider = models.providers[providerId];
console.log("provider:", providerId, provider?.baseUrl, provider?.api);
const model = provider?.models?.find(m => m.id === modelId);
console.log("model:", model?.id, model?.input);

// 构造一个 1x1 红点 png 的 base64 测试图
const testPngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

const messages = [
  {
    role: "user",
    content: [
      { type: "text", text: "这张图片里是什么颜色?只回答颜色名。" },
      { type: "image", source: { type: "base64", media_type: "image/png", data: testPngBase64 } },
    ],
    timestamp: Date.now(),
  },
];

const fullModel = { ...model, api: provider.api, baseUrl: provider.baseUrl, providerId };
console.log("\n调用视觉模型...");
try {
  const response = await complete(fullModel, { messages }, {
    apiKey: provider.apiKey,
    headers: provider.headers || {},
    env: process.env,
    cacheRetention: "none",
    sessionId: "test-vision-" + Date.now(),
  });
  const text = response.content.filter(c => c.type === "text").map(c => c.text).join("\n");
  console.log("✅ 视觉模型返回 text:", text);
  console.log("完整 response content:", JSON.stringify(response.content, null, 2));
  console.log("response keys:", Object.keys(response));
  console.log("usage:", response.usage);
  console.log("errorMessage:", response.errorMessage);
  console.log("stopReason:", response.stopReason);
  console.log("model:", response.model);
} catch (e) {
  console.error("❌ 视觉模型调用失败:", e.message);
  if (e.cause) console.error("cause:", e.cause.message || e.cause);
}
