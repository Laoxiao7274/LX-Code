/**
 * codegraph pi 扩展 —— 把 colbymchenry/codegraph 的 CLI 查询包装成 pi 工具给 AI。
 *
 * LXCode 自带 codegraph(npm 依赖),这个扩展让 AI agent 能直接调用:
 *  - codegraph_explore: 一次拿到相关源码+调用链+影响面(默认主工具)
 *  - codegraph_callers / codegraph_callees / codegraph_impact: 单项查询
 *
 * 纯后端,无 UI。让 agent 理解代码不用 grep+read 一堆文件。
 *
 * 不依赖 pi-mcp-adapter,直接 spawn codegraph CLI(LXCode 自带的 bin),LXCode 完全可控。
 */
import { spawn } from "node:child_process";
import path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { isCodegraphIndexed, indexProjectCodegraph, getCodegraphBin } from "../../codegraph";

/** codegraph bin 路径(缓存)。 */
let binPath: string | null = null;

/** 跑 codegraph CLI 命令,返回 stdout。 */
async function runCodegraph(args: string[], cwd: string, timeoutMs = 60_000): Promise<string> {
  if (!binPath) binPath = await getCodegraphBin();
  if (!binPath) throw new Error("codegraph 未安装");
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [binPath, ...args], { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.stdout?.on("data", (d) => (out += d));
    child.on("error", (e) => { clearTimeout(timer); reject(e); });
    child.on("close", (code) => { clearTimeout(timer); code === 0 ? resolve(out) : reject(new Error(`codegraph 退出码 ${code}`)); });
  });
}

/** 确保项目已索引,没索引就自动 init。 */
async function ensureIndexed(cwd: string): Promise<string> {
  if (await isCodegraphIndexed(cwd)) return "已索引";
  const r = await indexProjectCodegraph(cwd);
  return r.message;
}

/** 扩展工厂。LXCode 在 DefaultResourceLoader.extensionFactories 挂载。 */
export default function createCodegraphExtension(pi: ExtensionAPI): void {
  // 会话开始时后台索引(不阻塞,失败静默)
  pi.on("session_start", async (_event, ctx) => {
    void (async () => {
      try {
        await ensureIndexed(ctx.cwd);
      } catch {
        // 静默,不影响主流程
      }
    })();
  });

  // 主工具:explore(一次拿相关源码+调用链+影响面)
  pi.registerTool({
    name: "codegraph_explore",
    label: "代码探索",
    description:
      "探索代码:给一个自然语言问题或符号/文件名,一次返回相关符号的逐行源码 + 调用路径 + 影响面。理解代码结构、定位问题时用,不用 grep+read 一堆文件。首次用会自动建索引。",
    parameters: Type.Object({
      query: Type.String({ description: "问题或要找的符号/文件名(英文或函数名效果最好,如 'getOrCreateSession how session restore')" }),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        await ensureIndexed(ctx.cwd);
        const out = await runCodegraph(["explore", String(params.query ?? "")], ctx.cwd, 60_000);
        return { content: [{ type: "text", text: out || "无结果" }], details: {} };
      } catch (e) {
        return { content: [{ type: "text", text: `codegraph 查询失败: ${e instanceof Error ? e.message : e}` }], details: {} };
      }
    },
  });

  // 查谁调用了某函数
  pi.registerTool({
    name: "codegraph_callers",
    label: "查调用者",
    description: "查谁调用了某个函数(排查问题、改代码前看影响面用)。给函数名,返回所有调用者。",
    parameters: Type.Object({
      name: Type.String({ description: "函数名(如 getOrCreateSession)" }),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        await ensureIndexed(ctx.cwd);
        const out = await runCodegraph(["callers", String(params.name ?? "")], ctx.cwd, 30_000);
        return { content: [{ type: "text", text: out || "无调用者" }], details: {} };
      } catch (e) {
        return { content: [{ type: "text", text: `查询失败: ${e instanceof Error ? e.message : e}` }], details: {} };
      }
    },
  });

  // 查某函数调用了谁
  pi.registerTool({
    name: "codegraph_callees",
    label: "查被调用者",
    description: "查某个函数调用了哪些函数(理清调用链用)。给函数名,返回它调用的所有函数。",
    parameters: Type.Object({
      name: Type.String({ description: "函数名" }),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        await ensureIndexed(ctx.cwd);
        const out = await runCodegraph(["callees", String(params.name ?? "")], ctx.cwd, 30_000);
        return { content: [{ type: "text", text: out || "无被调用者" }], details: {} };
      } catch (e) {
        return { content: [{ type: "text", text: `查询失败: ${e instanceof Error ? e.message : e}` }], details: {} };
      }
    },
  });

  // 影响面分析
  pi.registerTool({
    name: "codegraph_impact",
    label: "影响面分析",
    description: "分析改某个符号会影响哪些代码(改代码前评估风险用)。给函数/类名,返回所有依赖它的代码。",
    parameters: Type.Object({
      name: Type.String({ description: "符号名(函数/类)" }),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        await ensureIndexed(ctx.cwd);
        const out = await runCodegraph(["impact", String(params.name ?? "")], ctx.cwd, 30_000);
        return { content: [{ type: "text", text: out || "无影响" }], details: {} };
      } catch (e) {
        return { content: [{ type: "text", text: `查询失败: ${e instanceof Error ? e.message : e}` }], details: {} };
      }
    },
  });
}
