/**
 * 嵌入模型配置读取:从 LXCode 的 desktop-settings.json 读 useCases.embed。
 *
 * 结构:{ settings: { useCases: { embed: "providerId/modelId" } } }
 * pi-host 启动时 Tauri 注入 LXCODE_CONFIG_DIR env。
 * 带 10s 缓存。返回 null=未配置。
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

let cached: string | null | undefined;
let cachedAt = 0;
const CACHE_TTL_MS = 10_000;

function resolveConfigDir(): string | undefined {
  const env = process.env.LXCODE_CONFIG_DIR;
  if (env && env.trim()) return env.trim();
  return undefined;
}

/** 读 useCases.embed 配置的嵌入模型 key(providerId/modelId)。null=未配置。 */
export function getEmbedModelKey(): string | null {
  const now = Date.now();
  if (cached !== undefined && now - cachedAt < CACHE_TTL_MS) return cached;
  cachedAt = now;
  const dir = resolveConfigDir();
  if (!dir) { cached = null; return null; }
  try {
    const raw = readFileSync(join(dir, "desktop-settings.json"), "utf-8");
    const parsed = JSON.parse(raw) as { settings?: { useCases?: { embed?: string } } };
    const v = parsed.settings?.useCases?.embed;
    cached = typeof v === "string" && v.includes("/") ? v : null;
    return cached;
  } catch {
    cached = null;
    return null;
  }
}

export function invalidateEmbedModelCache(): void {
  cached = undefined;
}
