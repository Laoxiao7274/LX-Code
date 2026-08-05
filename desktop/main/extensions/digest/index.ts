/**
 * LXCode digest 扩展 —— 项目功能地图(pi 扩展)。
 *
 * 职责(纯能力,无 UI):
 *  - AST 解析提函数骨架 → 产出 .lxcode/digest.json + PROJECT_DIGEST.md
 *  - before_agent_start 注入 digest 到 systemPrompt(让 AI 不全量读代码就懂结构)
 *  - agent_settled 后增量(阶段1:全量)重建 digest
 *  - 暴露工具给 AI:update_project_digest / query_function_summary / read_file_slice
 *
 * 热插拔:gate 变量 + pi.events 通道,LXCode 设置页 emit 配置变更,扩展运行时切换,
 * 不重启会话、不 /reload。enabled=false 时所有 handler/工具早返回,零开销。
 *
 * 产物契约:.lxcode/digest.json(机器读) + PROJECT_DIGEST.md(人看,阶段1先只写 json)。
 * 两边靠这两个文件解耦,UI 留 LXCode。
 *
 * 通用化:不硬编码 LXCode 依赖,配置走文件 + pi.events,别的 pi 宿主也能用。
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

import { buildDigest, readDigest, writeDigest } from "./build";
import { DEFAULT_DIGEST_CONFIG, DIGEST_CONFIG_EVENT, type DigestConfig, type DigestFile } from "./schema";

/** digest 注册的工具名,用于 gate 控制。 */
const DIGEST_TOOLS = ["update_project_digest", "query_function_summary", "read_file_slice"] as const;

/** 读 digest 运行配置(.lxcode/digest-config.json),不存在用默认。 */
async function readConfig(cwd: string): Promise<DigestConfig> {
  try {
    const raw = await fs.readFile(path.join(cwd, ".lxcode", "digest-config.json"), "utf-8");
    return { ...DEFAULT_DIGEST_CONFIG, ...(JSON.parse(raw) as Partial<DigestConfig>) };
  } catch {
    return { ...DEFAULT_DIGEST_CONFIG };
  }
}

/** 把 DigestFile 压成简短文本,用于注入 systemPrompt(控制长度)。 */
function digestToInjectText(digest: DigestFile): string {
  const lines: string[] = ["# 项目功能地图(digest) —— 结构概览", ""];
  lines.push(`模块: ${digest.modules.map((m) => m.name).join(", ") || "(无)"}`);
  lines.push("");
  lines.push("函数(按文件,格式: name(L起-止,级别)):");
  let count = 0;
  for (const [file, fns] of Object.entries(digest.functions)) {
    if (!fns.length) continue;
    const fnsText = fns.map((f) => `${f.fn}(L${f.startLine}-${f.endLine},${f.level})`).join(", ");
    lines.push(`  ${file}: ${fnsText}`);
    count += fns.length;
    if (count > 200) {
      lines.push("  ...(更多见 .lxcode/digest.json)");
      break;
    }
  }
  lines.push("");
  lines.push("查具体函数摘要用 query_function_summary 工具;按需读代码片段用 read_file_slice(不全量读)。");
  return lines.join("\n");
}

/** 安全执行:任何异常只记日志,绝不拖垮主会话。 */
async function safe(run: () => Promise<void>, label: string): Promise<void> {
  try {
    await run();
  } catch (err) {
    // digest 出问题不影响主流程,静默记日志
    console.error(`[digest] ${label} 失败:`, err instanceof Error ? err.message : err);
  }
}

/** 扩展工厂。LXCode 在 DefaultResourceLoader.extensionFactories 里挂载。 */
export default function createDigestExtension(pi: ExtensionAPI): void {
  // —— 热插拔 gate(闭包变量,运行时可改)——
  let gates: DigestConfig = { ...DEFAULT_DIGEST_CONFIG };
  let currentCwd = "";

  /** 应用配置到 gate + 工具激活状态。 */
  function applyConfig(cfg: DigestConfig): void {
    gates = cfg;
    // enabled=false 时移除 digest 工具(若在激活列表),true 时加回
    try {
      const active = new Set(pi.getActiveTools());
      if (cfg.enabled) {
        for (const tool of DIGEST_TOOLS) active.add(tool);
      } else {
        for (const tool of DIGEST_TOOLS) active.delete(tool);
      }
      pi.setActiveTools([...active]);
    } catch {
      // setActiveTools 在某些时机会抛(如 runtime 未就绪),忽略,gate 仍生效(工具内会再判断)
    }
  }

  // —— 启动时读配置初始化 gate ——
  pi.on("session_start", async (_event, ctx) => {
    currentCwd = ctx.cwd;
    const cfg = await readConfig(ctx.cwd);
    applyConfig(cfg);
  });

  // —— 热插拔通道:LXCode emit 配置变更 → 运行时切换,不重启 ——
  pi.events.on(DIGEST_CONFIG_EVENT, (cfg: unknown) => {
    if (cfg && typeof cfg === "object") {
      applyConfig({ ...DEFAULT_DIGEST_CONFIG, ...(cfg as Partial<DigestConfig>) });
    }
  });

  // —— 注入 digest 到 systemPrompt(AI 不全量读代码就懂结构)——
  pi.on("before_agent_start", async (event, ctx) => {
    if (!gates.enabled || !gates.injectContext) return; // gate 早返回
    const cwd = ctx.cwd;
    const digest = await readDigest(cwd);
    if (!digest) return; // 还没生成,不注入
    const inject = digestToInjectText(digest);
    return { systemPrompt: `${event.systemPrompt}\n\n${inject}` };
  });

  // —— AI 写完后增量更新(阶段1:全量重建,后续改 git diff 增量)——
  pi.on("agent_settled", async (_event, ctx) => {
    if (!gates.enabled || !gates.autoUpdate) return; // gate 早返回
    const cwd = ctx.cwd;
    await safe(async () => {
      const digest = await buildDigest(cwd);
      digest.trigger = "incremental";
      await writeDigest(cwd, digest);
    }, "incremental update");
  });

  // —— 工具:更新项目功能地图 ——
  pi.registerTool({
    name: "update_project_digest",
    label: "更新项目地图",
    description:
      "重新解析项目代码结构,更新项目功能地图(.lxcode/digest.json)。当项目结构有较大变化,或需要刷新函数级摘要时调用。",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      if (!gates.enabled) {
        return { content: [{ type: "text", text: "项目功能地图(digest)未启用" }], details: {} };
      }
      const cwd = ctx.cwd;
      const digest = await buildDigest(cwd);
      digest.trigger = "onboarding";
      await writeDigest(cwd, digest);
      const fnCount = Object.values(digest.functions).reduce((n, fns) => n + fns.length, 0);
      return {
        content: [{ type: "text", text: `已更新项目地图: ${digest.modules.length} 个模块, ${fnCount} 个函数。详见 .lxcode/digest.json` }],
        details: { moduleCount: digest.modules.length, fnCount },
      };
    },
  });

  // —— 工具:查询函数摘要(排查问题时 AI 按名/文件查,不开代码)——
  pi.registerTool({
    name: "query_function_summary",
    label: "查询函数摘要",
    description:
      "查询项目功能地图中某函数的摘要(行号/级别/调用关系)。排查问题时用它定位,不必打开代码。可按文件+函数名查,或只按函数名模糊查。",
    parameters: Type.Object({
      fn: Type.String({ description: "要查询的函数名(精确或部分)" }),
      file: Type.Optional(Type.String({ description: "限定文件(相对项目根),可选" })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (!gates.enabled) {
        return { content: [{ type: "text", text: "项目功能地图(digest)未启用" }], details: {} };
      }
      const digest = await readDigest(ctx.cwd);
      if (!digest) {
        return { content: [{ type: "text", text: "项目地图未生成,先调用 update_project_digest" }], details: {} };
      }
      const want = String(params.fn ?? "");
      const wantFile = params.file ? String(params.file) : undefined;
      const found: string[] = [];
      for (const [file, fns] of Object.entries(digest.functions)) {
        if (wantFile && file !== wantFile) continue;
        for (const f of fns) {
          if (f.fn.includes(want)) {
            found.push(
              `${file} :: ${f.fn} (L${f.startLine}-${f.endLine}, ${f.level})\n  what: ${f.what || "(待生成)"}\n  calls: ${f.calls?.calls.join(", ") || "(无)"}\n  calledBy: ${f.calls?.calledBy.join(", ") || "(无)"}`,
            );
          }
        }
      }
      return {
        content: [{ type: "text", text: found.length ? found.join("\n\n") : `未找到匹配 "${want}" 的函数` }],
        details: { matchCount: found.length },
      };
    },
  });

  // —— 工具:读文件片段(AI 按需读,不全量读)——
  pi.registerTool({
    name: "read_file_slice",
    label: "读代码片段",
    description:
      "读取项目文件的指定行范围(代码片段),不全量读取整个文件。配合 query_function_summary 定位行号后,用它只看相关片段。",
    parameters: Type.Object({
      path: Type.String({ description: "文件路径(相对项目根)" }),
      startLine: Type.Optional(Type.Number({ description: "起始行(1-indexed),默认 1" })),
      endLine: Type.Optional(Type.Number({ description: "结束行(含),默认 startLine+40" })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (!gates.enabled) {
        return { content: [{ type: "text", text: "项目功能地图(digest)未启用" }], details: {} };
      }
      const rel = String(params.path ?? "");
      const full = path.resolve(ctx.cwd, rel);
      // 防止越界读项目外文件
      if (!full.startsWith(path.resolve(ctx.cwd))) {
        return { content: [{ type: "text", text: "路径必须在项目内" }], details: {} };
      }
      const start = Number(params.startLine ?? 1);
      const end = Number(params.endLine ?? start + 40);
      try {
        const raw = await fs.readFile(full, "utf-8");
        const lines = raw.split(/\r?\n/);
        const slice = lines.slice(Math.max(0, start - 1), end).map((l, i) => `${start + i}: ${l}`).join("\n");
        return { content: [{ type: "text", text: slice || "(空)" }], details: { file: rel, start, end } };
      } catch (err) {
        return { content: [{ type: "text", text: `读取失败: ${err instanceof Error ? err.message : err}` }], details: {} };
      }
    },
  });
}
