/**
 * 读取内置扩展开关配置。
 *
 * 配置文件在 agentDir/builtin-extensions.json,{ [extensionId]: boolean }(false=禁用)。
 * 前端切换开关时写此文件并触发 host reload extensions 生效。
 * 文件不存在或读取失败 = 全部启用(默认)。
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

let cached: Record<string, boolean> | null | undefined;

/** 读取内置扩展开关(带内存缓存,改动后调 invalidateBuiltinExtensionsCache 失效)。 */
export function readBuiltinExtensionsConfig(agentDir: string): Record<string, boolean> | null {
  if (cached !== undefined) return cached;
  try {
    const raw = readFileSync(join(agentDir, "builtin-extensions.json"), "utf8");
    const parsed = JSON.parse(raw);
    cached = isRecord(parsed) ? (parsed as Record<string, boolean>) : null;
  } catch {
    cached = null;
  }
  return cached;
}

/** 缓存失效(前端 IPC 写配置后调,下次读取重新读盘)。 */
export function invalidateBuiltinExtensionsCache(): void {
  cached = undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
