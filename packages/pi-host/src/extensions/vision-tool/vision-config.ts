/**
 * 视觉工具配置读取:从 LXCode 的 desktop-settings.json 读 useCases.vision。
 *
 * desktop-settings.json 由 Tauri 端管理,存在 app_config_dir(LXCODE_CONFIG_DIR env)。
 * 结构:{ schemaVersion, settings: { ..., useCases: { vision: "providerId/modelId" } } }
 * pi-host 启动时 Tauri 注入 LXCODE_CONFIG_DIR env(见 src-tauri/pi_host.rs)。
 *
 * 带简单缓存,避免每次工具调用都读文件。
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

let cachedVisionModel: string | null | undefined;
let cachedAt = 0;
const CACHE_TTL_MS = 10_000;

function resolveConfigDir(): string | undefined {
  const env = process.env.LXCODE_CONFIG_DIR;
  if (env && env.trim()) return env.trim();
  return undefined;
}

/**
 * 读 useCases.vision 配置的视觉模型 key(providerId/modelId)。
 * 返回 null 表示未配置(用户没在设置里指定视觉模型)。
 * 读不到文件/解析失败也返回 null(静默)。
 */
export function getVisionModelKey(): string | null {
  const now = Date.now();
  if (cachedVisionModel !== undefined && now - cachedAt < CACHE_TTL_MS) {
    return cachedVisionModel;
  }
  cachedAt = now;
  const dir = resolveConfigDir();
  if (!dir) {
    cachedVisionModel = null;
    return null;
  }
  try {
    const raw = readFileSync(join(dir, "desktop-settings.json"), "utf-8");
    const parsed = JSON.parse(raw) as {
      settings?: { useCases?: { vision?: string } };
    };
    const v = parsed.settings?.useCases?.vision;
    cachedVisionModel = typeof v === "string" && v.includes("/") ? v : null;
    return cachedVisionModel;
  } catch {
    cachedVisionModel = null;
    return null;
  }
}

/** 清缓存(设置改后强制重读)。 */
export function invalidateVisionConfigCache(): void {
  cachedVisionModel = undefined;
  cachedAt = 0;
}
