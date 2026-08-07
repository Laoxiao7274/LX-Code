/**
 * 加载内置扩展工厂(共享)。
 *
 * 核心工具(CORE_TOOLS:视觉识别/网页搜索)始终加载;
 * 可选扩展(BUILTIN_EXTENSIONS:CodeGraph)按用户开关加载。
 *
 * session-lifecycle 的 create/open 和 workspace-lifecycle 的 buildServices 都用,
 * 确保切工作区、建/恢复 session 都挂载内置工具。
 */
import { readBuiltinExtensionsConfig } from "./builtin-config.js";
import {
  BUILTIN_EXTENSIONS,
  CORE_TOOLS,
  enabledBuiltinExtensions,
  type BuiltinExtensionEntry,
} from "./index.js";

/** 读开关 + 动态 import 工厂(核心工具 + 启用的可选扩展),返回 InlineExtension[]。 */
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

export { BUILTIN_EXTENSIONS, CORE_TOOLS, enabledBuiltinExtensions };
