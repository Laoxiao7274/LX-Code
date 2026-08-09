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
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import {
  explore,
  ensureCodegraphIndexed,
  closeCodegraph,
  formatExploreResult,
} from "./codegraph.js";

/**
 * 追加到 system prompt 的 codegraph 使用指令。只在项目有 .codegraph 索引时注入。
 * 改写自官方 SERVER_INSTRUCTIONS(适配 LXCode 进程内单工具模式):
 * 用祈使句 + 反模式警告,把 agent 从 grep+read 惯性拽到 codegraph_explore。
 */
const CODEGRAPH_SYSTEM_INSTRUCTIONS = `
# Codegraph — 已索引的代码知识图谱

Codegraph 是本工作区的 SQLite 代码图谱(每个符号、调用边、文件都已在 .codegraph/ 预解析)。
这是缓存好的结构,你不必再靠读文件重新推导。读取是亚毫秒级;文件写入后约 1 秒同步到索引。
**在理解代码或改代码之前、之中都要优先用它**——不只用于提问:一次调用返回相关符号的
逐行带号源码,外加谁调用它(blast radius)、它调用谁(call paths),让你带着影响面改代码。
比你自己读文件更准,且 token 和往返次数少得多。

## 只有一个工具:codegraph_explore — 用它代替读文件

只有一个工具 \`codegraph_explore\`,它等价于 Read。给它一个自然语言问题,或一组符号/文件名,
返回按文件分组的**逐行带号源码**(和 Read 一样的 \`<n>\\t<line>\` 格式,可直接 Edit)
**加上**它们之间的调用链(含 grep 跟不上的动态分派跳转:回调、React 重渲染、JSX children)
**加上**谁依赖它们的影响面摘要。

无论你是回答"X 怎么工作"还是改代码(修 bug、加功能),在 Read 之前先调 \`codegraph_explore\`。
一次调用通常就能回答整个问题。Codegraph 本身就是预建好的搜索索引——所以你自己跑
grep+read 循环,或把查找委托给单独的读文件子任务,都是在重复 codegraph 已做的工作,
且花更多代价得到同一个答案。一次 codegraph 答案通常一到几次调用;一次 grep/read 探索要几十次。

## 怎么查

- **几乎任何问题** —— "X 怎么工作"、架构、一个 bug、"X 是什么/在哪"、摸一片区域 →
  \`codegraph_explore\` 配自然语言问题或相关名字。一次有上限的调用返回按文件分组的源码;多半是唯一需要的调用。
- **"X 怎么到达 Y?/ 从 X 到 Y 的流程/路径"** → \`codegraph_explore\`,点名跨流程的符号
  (如 \`mutateElement renderScene\`)——它浮现它们之间的调用路径(含动态分派跳转)并返回源码。
- **读或改一个你叫得出名字的文件/符号** → 把名字或文件路径放进 \`codegraph_explore\` 查询——
  它返回该符号当前带行号源码(可直接 Edit)并附带调用路径和影响面,不必单独 Read。重载名一次返回每个匹配定义的函数体。
- **需要更多?** 用更具体的名字再调一次 \`codegraph_explore\`——把它返回的源码当作已 Read 过的。

## 反模式

- **信任 codegraph 的结果——别用 grep 复验。** 它们来自完整 AST 解析;用 grep 再查一遍更慢、
  更不准、浪费 context。
- **别先 grep 或 Read 去找/理解已索引的代码** —— 一次 \`codegraph_explore\` 在一次往返里返回
  相关符号的源码。只有确认 codegraph 没覆盖的具体细节,或 codegraph 不索引的东西(配置、文档)
  才用裸 Read/Grep。
- **别手工重建调用流程** —— 在一次 \`codegraph_explore\` 里点名两端点,它浮现它们之间的路径,
  含动态分派跳转。
- **编辑后看 staleness banner。** 当工具响应以 "⚠️ Some files referenced below were edited
  since the last index sync…" 开头时,列出的文件待重新索引——Read 那些具体文件拿准确内容。
  不在该 banner 里的每个文件都是新鲜的,仍可信任 codegraph。
`.trim();

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

  // 在每轮 agent 开始前:有 .codegraph 索引时,把使用指令追加到 system prompt。
  // 用 before_agent_start 的 systemPrompt result 替换该轮 prompt(此处=原 prompt + 追加段)。
  // 无索引的项目不注入,agent 用内置工具,不误导。
  pi.on("before_agent_start", (event, ctx) => {
    if (!existsSync(join(ctx.cwd, ".codegraph"))) return;
    return { systemPrompt: `${event.systemPrompt}\n\n${CODEGRAPH_SYSTEM_INSTRUCTIONS}` };
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
