/**
 * codegraph pi 扩展 —— 让 AI agent 能用 LXCode 自带的代码图谱。
 *
 * 纯后端,无 UI。对齐官方 codegraph_explore MCP 工具:默认只暴露 1 个工具。
 * 官方实测:一个强力 explore 工具比一堆窄工具更好(AI 误选少),
 * explore 内联返回了 callers/callees/impact 的全部信息。
 *
 * 工具 execute 调主进程 codegraph.ts 的 explore(),不 spawn CLI、不起 MCP server。
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { explore, ensureCodegraphIndexed, closeCodegraph, formatExploreResult } from "../../codegraph";

/** 扩展工厂。LXCode 在 DefaultResourceLoader.extensionFactories 挂载。 */
export default function createCodegraphExtension(pi: ExtensionAPI): void {
  // 会话开始:后台确保索引(不阻塞主流程,失败静默)
  pi.on("session_start", async (_event, ctx) => {
    void (async () => {
      try {
        await ensureCodegraphIndexed(ctx.cwd);
      } catch {
        // 静默,不影响对话
      }
    })();
  });

  // 会话结束:关掉该项目的 CodeGraph 实例(释放 watcher + db 句柄)
  pi.on("session_dispose", async (_event, ctx) => {
    try {
      closeCodegraph(ctx.cwd);
    } catch {
      // 忽略
    }
  });

  // 唯一工具:explore(对齐官方默认 1 工具)
  pi.registerTool({
    name: "codegraph_explore",
    label: "代码探索",
    description:
      "探索代码:给一个自然语言问题或符号/文件名,一次返回相关符号的逐行带号源码 + 调用路径 + 影响面。理解代码结构、定位问题时用,不用 grep+read 一堆文件。首次用会自动建索引,之后文件变化自动增量同步。查询里带文件名或符号名可直接读它当前带行号源码。",
    parameters: Type.Object({
      query: Type.String({ description: "问题或要找的符号/文件名(英文或函数名效果最好,如 'getOrCreateSession how session restore')" }),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        await ensureCodegraphIndexed(ctx.cwd);
        const result = await explore(ctx.cwd, String(params.query ?? ""));
        return { content: [{ type: "text", text: formatExploreResult(result) }], details: result };
      } catch (e) {
        return { content: [{ type: "text", text: `codegraph 探索失败: ${e instanceof Error ? e.message : e}` }], details: {} };
      }
    },
  });
}
