/**
 * codegraph pi 扩展 —— 让 AI agent 能用 LXCode 内置的代码图谱。
 *
 * 纯后端,无 UI。进程内 SDK 模式(不走 MCP),session_start 自动建索引+watch,
 * session_shutdown 关实例。只注册 codegraph_explore 一个工具(对齐官方 v0.9.9 单工具
 * 设计):一次调用返回相关符号源码 + 调用链(callees)+ 影响面(callers)。
 *
 * 挂载:pi-host 的 createSessionResourceLoader 给 DefaultResourceLoader 传
 * extensionFactories: [{ name: "codegraph", factory: createCodegraphExtension }]。
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import {
  explore,
  ensureCodegraphIndexed,
  closeCodegraph,
  formatExploreResult,
} from "./codegraph.js";

export default function createCodegraphExtension(pi: ExtensionAPI): void {
  // 会话开始:后台确保索引(不阻塞主流程,失败静默)
  pi.on("session_start", (_event, ctx) => {
    void (async () => {
      try {
        await ensureCodegraphIndexed(ctx.cwd);
      } catch {
        // 静默,不影响对话
      }
    })();
  });

  // 会话关闭:关掉该项目的 CodeGraph 实例(释放 watcher + db 句柄)
  pi.on("session_shutdown", (_event, ctx) => {
    try {
      closeCodegraph(ctx.cwd);
    } catch {
      // 忽略
    }
  });

  // 主工具:explore(一次返回相关符号源码 + 影响面 + 调用链)
  pi.registerTool({
    name: "codegraph_explore",
    label: "代码探索",
    description:
      `探索代码:给一个自然语言问题或符号/文件名,一次返回相关符号的逐行带号源码 + 影响面 + 调用链。理解代码结构、定位问题时用,不用 grep+read 一堆文件。首次用会自动建索引,之后文件变化自动增量同步。查询里带文件名或符号名可直接读它当前带行号源码。配了「嵌入向量化」用途的嵌入模型时,候选符号会自动按语义相似度重排(自然语言查询更准);未配则按符号名/全文匹配顺序。`,
    promptSnippet: "Explore code structure via CodeGraph",
    promptGuidelines: [
      "Use codegraph_explore to understand code structure, locate symbols, or find call relationships",
      "Pass symbol names or file names, or natural-language intent if an embedding model is configured",
      "With an embedding model (Settings -> Model use cases -> Embedding), candidates are re-ranked by semantic similarity",
      "First use auto-builds the index; subsequent file changes sync incrementally",
    ],
    parameters: Type.Object({
      query: Type.String({
        description: "Question or symbol/file name to find (e.g. 'getOrCreateSession how session restore')",
      }),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        await ensureCodegraphIndexed(ctx.cwd);
        const result = await explore(ctx.cwd, String(params.query ?? ""), 6, ctx.modelRegistry);
        return { content: [{ type: "text", text: formatExploreResult(result) }], details: result };
      } catch (e) {
        return {
          content: [{ type: "text", text: `codegraph 探索失败: ${e instanceof Error ? e.message : e}` }],
          details: {},
        };
      }
    },
  });

}
