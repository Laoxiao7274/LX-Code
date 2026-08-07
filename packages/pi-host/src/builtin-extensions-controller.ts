/**
 * 内置扩展的 host handlers:
 *  - builtinExtensions.list: 返回所有内置扩展 + 启用状态
 *  - builtinExtensions.setEnabled: 写开关到 agentDir/builtin-extensions.json,失效缓存
 *
 * 开关变化后,下次创建会话(createSessionResourceLoader)才生效——旧会话需 reload 或重开。
 */
import { writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { BuiltinExtensionInfo, HostMethod } from "@lxcode/protocol";
import { createHostError } from "@lxcode/protocol";
import { BUILTIN_EXTENSIONS } from "./extensions/index.js";
import { readBuiltinExtensionsConfig, invalidateBuiltinExtensionsCache } from "./extensions/builtin-config.js";
import type { WorkspaceGraphFactory } from "./workspace-graph-factory.js";
import type { MethodHandler } from "./server.js";

export function createBuiltinExtensionsHandlers(factory: WorkspaceGraphFactory): Partial<Record<HostMethod, MethodHandler>> {
  return {
    "builtinExtensions.list": async (_ctx) => {
      const config = readBuiltinExtensionsConfig(factory.deps.agentDir);
      const extensions: BuiltinExtensionInfo[] = BUILTIN_EXTENSIONS.map((ext) => ({
        id: ext.id,
        name: ext.name,
        enabled: config ? config[ext.id] !== false : true,
      }));
      return { result: { extensions } };
    },
    "builtinExtensions.setEnabled": async (ctx) => {
      const { extensionId, enabled } = ctx.params as { extensionId: string; enabled: boolean };
      const exists = BUILTIN_EXTENSIONS.some((ext) => ext.id === extensionId);
      if (!exists) {
        return { error: createHostError("INVALID_REQUEST", `Unknown builtin extension: ${extensionId}`) };
      }
      const path = join(factory.deps.agentDir, "builtin-extensions.json");
      let current: Record<string, boolean> = {};
      try {
        current = JSON.parse(readFileSync(path, "utf8")) as Record<string, boolean>;
      } catch {
        // 不存在,用空
      }
      current[extensionId] = enabled;
      try {
        writeFileSync(path, JSON.stringify(current, null, 2), "utf8");
      } catch (e) {
        return {
          error: createHostError(
            "INVALID_REQUEST",
            `Failed to write builtin extensions config: ${e instanceof Error ? e.message : e}`,
          ),
        };
      }
      invalidateBuiltinExtensionsCache();
      return { result: { extensionId, enabled } };
    },
  };
}
