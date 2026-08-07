/**
 * codegraph 集成 —— LXCode 内置 colbymchenry/codegraph 代码图谱(进程内 SDK 模式)。
 *
 * 不起 MCP server / 不 spawn CLI,直接 import codegraph 的 npm-sdk 在 host 进程内用:
 *  - CodeGraph.init/open 建索引、watch() 起 FileWatcher 自动增量同步
 *  - searchNodes/getCallers/getCallees/getImpactRadius 等查询方法拼 explore 输出
 *
 * 比官方 MCP(proxy+daemon)更轻:无进程间通信,直接进程内调。
 * 每个项目一个 CodeGraph 实例(缓存),切项目时关旧开新,host 退出时全关。
 *
 * 移植自旧 LXCode desktop/main/codegraph.ts,去掉 electron 依赖,适配 pi-host 进程。
 */
import { createRequire } from "node:module";

// codegraph npm-sdk 是 CommonJS,且其入口 npm-sdk.js 是
// `module.exports = require(resolveLibrary())` 这种动态转发壳。
// ESM `import * as` 时 cjs-module-lexer 无法静态分析其命名导出,
// 导致 namespace 只剩 `default`、CodeGraph/isInitialized 全为 undefined,
// 工具调用时 `cgIsInitialized(cwd)` 抛 "cgIsInitialized is not a function"。
// 改用 createRequire 直接 require,拿到真实 module.exports(含全部命名导出);
// 类型用 `as typeof import(...)` 断言成 d.ts 的 namespace shape,保持类型等价。
const require = createRequire(import.meta.url);
const CodegraphSDK = require("@colbymchenry/codegraph") as typeof import("@colbymchenry/codegraph");
const CodeGraph = CodegraphSDK.CodeGraph;
const cgIsInitialized = CodegraphSDK.isInitialized;
type CgNode = import("@colbymchenry/codegraph").Node;
// CodeGraph 实例类型(构造器私有,用 open 返回推断)
type CodeGraphInstance = Awaited<ReturnType<typeof CodeGraph.open>>;

/** CodeGraph 实例缓存:cwd → 实例。切项目时关旧开新。 */
const instances = new Map<string, CodeGraphInstance>();

/** 正在初始化的锁:避免同一项目并发 init/open。 */
const initializing = new Map<string, Promise<CodeGraphInstance>>();

/** 获取/创建某项目的 CodeGraph 实例(已索引则 open,未索引则 init)。 */
async function getInstance(cwd: string): Promise<CodeGraphInstance> {
  const cached = instances.get(cwd);
  if (cached) return cached;
  const inFlight = initializing.get(cwd);
  if (inFlight) return inFlight;

  const p = (async () => {
    let cg: CodeGraphInstance;
    if (cgIsInitialized(cwd)) {
      cg = await CodeGraph.open(cwd);
    } else {
      cg = await CodeGraph.init(cwd);
    }
    // 起 FileWatcher 自动增量同步(文件变化自动 reindex)
    try {
      cg.watch();
    } catch {
      // watch 失败不致命,索引仍可查,只是不自动同步
    }
    instances.set(cwd, cg);
    initializing.delete(cwd);
    return cg;
  })();
  initializing.set(cwd, p);
  return p;
}

/** 关闭某项目的实例(切项目 / host 退出时调)。 */
export function closeCodegraph(cwd: string): void {
  const cg = instances.get(cwd);
  if (cg) {
    try {
      cg.unwatch();
      cg.close();
    } catch {
      // 忽略关闭错误
    }
    instances.delete(cwd);
  }
}

/** 关闭全部实例(host 退出时调)。 */
export function closeAllCodegraph(): void {
  for (const cwd of [...instances.keys()]) closeCodegraph(cwd);
}

/** 项目是否已索引。 */
export function isCodegraphIndexed(cwd: string): boolean {
  return cgIsInitialized(cwd);
}

/** 索引状态摘要。 */
export interface CodegraphStatus {
  initialized: boolean;
  state: "indexing" | "complete" | "partial" | "failed" | null;
  nodeCount: number;
  edgeCount: number;
  fileCount: number;
  lastIndexedAt: number | null;
}

/** 查某项目的索引状态(不建索引,只读)。未索引返回 initialized:false。 */
export async function getCodegraphStatus(cwd: string): Promise<CodegraphStatus> {
  if (!cgIsInitialized(cwd)) {
    return { initialized: false, state: null, nodeCount: 0, edgeCount: 0, fileCount: 0, lastIndexedAt: null };
  }
  try {
    const cg = await getInstance(cwd);
    const stats = cg.getStats();
    return {
      initialized: true,
      state: cg.getIndexState(),
      nodeCount: stats.nodeCount,
      edgeCount: stats.edgeCount,
      fileCount: stats.fileCount,
      lastIndexedAt: cg.getLastIndexedAt(),
    };
  } catch {
    return { initialized: false, state: "failed", nodeCount: 0, edgeCount: 0, fileCount: 0, lastIndexedAt: null };
  }
}

/**
 * 常见第三方/生成目录,默认不索引。
 */
const DEFAULT_EXCLUDE = [
  "**/node_modules/**",
  "**/.venv/**",
  "**/venv/**",
  "**/site-packages/**",
  "**/__pycache__/**",
  "**/dist/**",
  "**/build/**",
  "**/.git/**",
  "**/.next/**",
  "**/.cache/**",
];

/**
 * 首次索引前自动生成 codegraph.json 排除常见第三方目录。
 * 已存在且有效的 codegraph.json 不覆盖(尊重用户自定义);空/无效的会被覆盖。
 */
async function ensureCodegraphConfig(cwd: string): Promise<boolean> {
  const fs = await import("node:fs/promises");
  const configPath = `${cwd}/codegraph.json`;
  try {
    const txt = await fs.readFile(configPath, "utf8");
    try { JSON.parse(txt); return false; } catch { /* 无效,继续覆盖 */ }
  } catch {
    // 不存在,继续写
  }
  try {
    await fs.writeFile(configPath, JSON.stringify({ exclude: DEFAULT_EXCLUDE }, null, 2) + "\n", "utf8");
    return true;
  } catch {
    return false;
  }
}

/** 索引项目(首次 init / 重建 index)。返回状态摘要。 */
export async function indexProjectCodegraph(cwd: string): Promise<{ ok: boolean; message: string }> {
  try {
    await ensureCodegraphConfig(cwd);
    // 强制重建:关旧实例,删 .codegraph,重新 init(index:true 真扫文件)
    closeCodegraph(cwd);
    const fs = await import("node:fs/promises");
    try { await fs.rm(`${cwd}/.codegraph`, { recursive: true, force: true }); } catch { /* 可能不存在 */ }
    const cg = await CodeGraph.init(cwd, { index: true });
    try { cg.watch(); } catch { /* watch 失败不致命 */ }
    instances.set(cwd, cg);
    return { ok: true, message: "索引完成" };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

/** 确保某项目已索引(后台,会话开始时调)。返回状态摘要。 */
export async function ensureCodegraphIndexed(cwd: string): Promise<{ ok: boolean; message: string }> {
  try {
    await getInstance(cwd);
    return { ok: true, message: cgIsInitialized(cwd) ? "已打开索引" : "首次索引完成" };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

function numberLines(src: string, startLine: number): string {
  const lines = src.split(/\r?\n/);
  const width = String(startLine + lines.length).length;
  return lines
    .map((l, i) => `${String(startLine + i).padStart(width, " ")}\t${l}`)
    .join("\n");
}

/** 从文件读指定行号区间的源码(带行号)。读失败返回空。 */
async function readSourceLines(filePath: string, startLine: number, endLine: number): Promise<string | null> {
  try {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile(filePath, "utf8");
    const lines = content.split(/\r?\n/);
    const slice = lines.slice(startLine - 1, endLine).join("\n");
    return numberLines(slice, startLine);
  } catch {
    return null;
  }
}

/** explore 输出的一节:某文件的源码。 */
interface SourceSection {
  file: string;
  symbols: string[];
  source: string;
}

/** explore 的结果。 */
export interface ExploreResult {
  query: string;
  found: number;
  files: number;
  /** 影响面:哪些符号依赖这些(改前必看)。 */
  blastRadius: string[];
  /** 相关文件源码(带行号,按文件分组)。 */
  sections: SourceSection[];
}

/**
 * explore:一次查询返回相关符号的源码 + 调用链 + 影响面。
 * 增强版:用 getImpactRadius(比手工 getCallers 更准) + getCallees。
 *
 * 逻辑:searchNodes/getNodesByName 找候选 → 按文件分组读源码(带行号)
 *      → getImpactRadius 拼影响面 → getCallees 拼调用链。
 */
export async function explore(cwd: string, query: string, maxFiles = 6, registry?: import("@earendil-works/pi-coding-agent").ModelRegistry): Promise<ExploreResult> {
  const cg = await getInstance(cwd);

  // 1. 搜符号(FTS 全文 + 名字匹配)
  const results = cg.searchNodes(query, { limit: 20 });
  // 也按名字精确找(query 可能就是函数名)
  const byName = cg.getNodesByName(query);
  const seen = new Set<string>();
  const candidates: CgNode[] = [];
  for (const r of [...byName.map((n: CgNode) => ({ node: n })), ...results]) {
    const n = r.node;
    if (!seen.has(n.id)) {
      seen.add(n.id);
      candidates.push(n);
    }
  }
  if (candidates.length === 0) {
    return { query, found: 0, files: 0, blastRadius: [], sections: [] };
  }

  // 1.5 语义重排:配了嵌入模型(useCases.embed)就用向量对候选重排,让最语义相关的排前面
  let rankedCandidates = candidates;
  if (registry && candidates.length > 1) {
    try {
      const { semanticSearch } = await import("./semantic-index.js");
      const ranked = await semanticSearch(
        query,
        candidates.map((n) => ({ id: n.id, name: n.name, filePath: n.filePath, startLine: n.startLine, endLine: n.endLine })),
        registry,
        candidates.length,
      );
      if (ranked.ok && ranked.results.length > 0) {
        // 按语义相似度顺序重建 candidates
        const rankMap = new Map(ranked.results.map((r, i) => [r.name + "|" + r.filePath + "|" + r.startLine, i]));
        rankedCandidates = [...candidates].sort((a, b) => {
          const ka = a.name + "|" + a.filePath + "|" + a.startLine;
          const kb = b.name + "|" + b.filePath + "|" + b.startLine;
          return (rankMap.get(ka) ?? 999) - (rankMap.get(kb) ?? 999);
        });
      }
    } catch {
      // 嵌入失败/未配置,用原顺序(降级)
    }
  }

  // 2. 按文件分组符号(限制文件数) — 用语义重排后的候选
  const fileToSymbols = new Map<string, CgNode[]>();
  for (const n of rankedCandidates) {
    if (fileToSymbols.size >= maxFiles && !fileToSymbols.has(n.filePath)) continue;
    const arr = fileToSymbols.get(n.filePath) ?? [];
    arr.push(n);
    fileToSymbols.set(n.filePath, arr);
  }

  // 3. 每个文件读源码(主符号函数体带行号)+ 影响面 + 调用链
  const sections: SourceSection[] = [];
  const blastRadiusSet = new Set<string>();
  for (const [file, nodes] of fileToSymbols) {
    const symbolNames = nodes.map((n) => n.name);
    const main = nodes[0]!;
    const absPath = file.startsWith(cwd) ? file : `${cwd}/${file}`.replace(/\/+/g, "/");
    const source = await readSourceLines(absPath, main.startLine, main.endLine);
    if (source) {
      sections.push({ file, symbols: symbolNames, source });
    }
    // 影响面:用 getImpactRadius(比手工 getCallers 更准,含传递依赖)
    for (const n of nodes) {
      try {
        const impact = cg.getImpactRadius(n.id, 2);
        for (const node of impact.nodes.values()) {
          if (node.id !== n.id) {
            blastRadiusSet.add(`${node.name} (${node.filePath}:${node.startLine})`);
          }
        }
      } catch {
        // 忽略单个符号查询失败
      }
    }
  }

  return {
    query,
    found: candidates.length,
    files: sections.length,
    blastRadius: [...blastRadiusSet].slice(0, 15),
    sections,
  };
}

/** 把 ExploreResult 格式化成给 AI 看的文本。 */
export function formatExploreResult(r: ExploreResult): string {
  if (r.found === 0) return `No relevant code found for "${r.query}"`;
  const lines: string[] = [];
  lines.push(`**Exploration: ${r.query}**`);
  lines.push("");
  lines.push(`Found ${r.found} symbols across ${r.files} files.`);
  lines.push("");
  if (r.blastRadius.length > 0) {
    lines.push("**Blast radius — what depends on these (update/verify before editing)**");
    lines.push("");
    for (const b of r.blastRadius) lines.push(`- ${b}`);
    lines.push("");
  }
  lines.push("**Source Code**");
  lines.push("");
  for (const s of r.sections) {
    lines.push(`**${s.file}** — ${s.symbols.join(", ")}`);
    lines.push("");
    lines.push("```typescript");
    lines.push(s.source);
    lines.push("```");
    lines.push("");
  }
  return lines.join("\n");
}

/** 查某符号的调用者(谁调用了它)。 */
export async function getCallers(cwd: string, symbol: string, maxDepth = 1): Promise<string[]> {
  const cg = await getInstance(cwd);
  const nodes = cg.getNodesByName(symbol);
  if (nodes.length === 0) return [];
  const out: string[] = [];
  for (const n of nodes) {
    try {
      const callers = cg.getCallers(n.id, maxDepth);
      for (const c of callers) {
        out.push(`${c.node.name} (${c.node.filePath}:${c.node.startLine})`);
      }
    } catch { /* 忽略 */ }
  }
  return out;
}

/** 查某符号调用了谁(它调用了什么)。 */
export async function getCallees(cwd: string, symbol: string, maxDepth = 1): Promise<string[]> {
  const cg = await getInstance(cwd);
  const nodes = cg.getNodesByName(symbol);
  if (nodes.length === 0) return [];
  const out: string[] = [];
  for (const n of nodes) {
    try {
      const callees = cg.getCallees(n.id, maxDepth);
      for (const c of callees) {
        out.push(`${c.node.name} (${c.node.filePath}:${c.node.startLine})`);
      }
    } catch { /* 忽略 */ }
  }
  return out;
}

/** 搜符号候选(searchNodes 全文 + getNodesByName 名字精确),去重,供语义搜索重排。 */
export async function getSearchCandidates(
  cwd: string,
  query: string,
  limit = 20,
): Promise<Array<{ id: string; name: string; filePath: string; startLine: number; endLine: number }>> {
  const cg = await getInstance(cwd);
  const results = cg.searchNodes(query, { limit });
  const byName = cg.getNodesByName(query);
  const seen = new Set<string>();
  const out: Array<{ id: string; name: string; filePath: string; startLine: number; endLine: number }> = [];
  for (const r of [...byName.map((n: CgNode) => ({ node: n })), ...results]) {
    const n = r.node;
    if (!seen.has(n.id)) {
      seen.add(n.id);
      out.push({ id: n.id, name: n.name, filePath: n.filePath, startLine: n.startLine, endLine: n.endLine });
    }
  }
  return out;
}
