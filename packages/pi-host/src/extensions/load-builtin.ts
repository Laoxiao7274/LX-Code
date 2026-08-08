/**
 * 加载内置扩展(共享)。
 *
 * 核心工具(CORE_TOOLS:视觉识别/网页搜索)始终加载;
 * 可选扩展(BUILTIN_EXTENSIONS,inline 工厂)按用户开关加载;
 * path 型内置扩展(BUILTIN_PATH_EXTENSIONS,第三方 pi 包经 jiti 加载)按开关加载。
 *
 * session-lifecycle 的 create/open 和 workspace-lifecycle 的 buildServices 都用,
 * 确保切工作区、建/恢复 session 都挂载内置工具。
 */
import { readBuiltinExtensionsConfig } from "./builtin-config.js";
import {
  BUILTIN_EXTENSIONS,
  BUILTIN_PATH_EXTENSIONS,
  CORE_TOOLS,
  enabledBuiltinExtensions,
  enabledBuiltinPathExtensions,
  type BuiltinExtensionEntry,
  type BuiltinPathExtensionEntry,
} from "./index.js";

/** 读开关 + 动态 import 工厂(核心工具 + 启用的可选 inline 扩展),返回 InlineExtension[]。 */
export async function loadBuiltinExtensionFactories(agentDir: string): Promise<
  { name: string; factory: (pi: unknown) => void | Promise<void> }[]
> {
  const config = readBuiltinExtensionsConfig(agentDir);
  const enabled = enabledBuiltinExtensions(config);
  const all = [...CORE_TOOLS, ...enabled];
  return Promise.all(
    all.map(async (ext: BuiltinExtensionEntry) => {
      const mod = await ext.factory();
      return { name: ext.id, factory: mod.default } as never;
    }),
  );
}

/**
 * 读开关 + 定位启用的 path 型内置扩展,返回 DefaultResourceLoader.additionalExtensionPaths。
 * 包不可用(resolvePath 返回 null)的条目被跳过(不报错),仅当用户开关启用且包可定位时才加入。
 */
export async function loadBuiltinExtensionPaths(agentDir: string): Promise<string[]> {
  const config = readBuiltinExtensionsConfig(agentDir);
  const enabled = enabledBuiltinPathExtensions(config);
  return enabled
    .map((ext: BuiltinPathExtensionEntry) => ext.resolvePath())
    .filter((p): p is string => typeof p === "string" && p.length > 0);
}

export {
  BUILTIN_EXTENSIONS,
  BUILTIN_PATH_EXTENSIONS,
  CORE_TOOLS,
  enabledBuiltinExtensions,
  enabledBuiltinPathExtensions,
};
