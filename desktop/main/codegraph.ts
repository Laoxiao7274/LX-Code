/**
 * codegraph 集成 —— LXCode 自带 colbymchenry/codegraph 代码图谱(进程内 SDK 模式)。
 *
 * 不起 MCP server / 不 spawn CLI,直接 import codegraph 的 npm-sdk 在主进程内用:
 *  - CodeGraph.init/open 建索引、watch() 起 FileWatcher 自动增量同步
 *  - searchNodes/getCallers/getCallees/getImpactRadius 等查询方法拼 explore 输出
 *
 * 比官方 MCP(proxy+daemon)还轻:无进程间通信,直接进程内调。
 * 每个项目一个 CodeGraph 实例(缓存),切项目时关旧开新,LXCode 退出时全关。
 *
 * 纯后端,无前端。让 agent 理解代码不用 grep+read 一堆文件。
 */
import { app } from "electron";

// codegraph 的 per-platform bundle 必须装好(@colbymchenry/codegraph-<plat>-<arch>)。
// import 走 npm-sdk,它内部 require.resolve 当前平台的 bundle。
import { CodeGraph, isInitialized as cgIsInitialized, type Node as CgNode } from "@colbymchenry/codegraph";

/** CodeGraph 实例缓存:cwd → 实例。切项目时关旧开新。 */
const instances = new Map<string, CodeGraph>();

/** 正在初始化的锁:避免同一项目并发 init/open。 */
const initializing = new Map<string, Promise<CodeGraph>>();

/** 获取/创建某项目的 CodeGraph 实例(已索引则 open,未索引则 init)。 */
async function getInstance(cwd: string): Promise<CodeGraph> {
  const cached = instances.get(cwd);
  if (cached) return cached;
  const inFlight = initializing.get(cwd);
  if (inFlight) return inFlight;

  const p = (async () => {
    let cg: CodeGraph;
    if (cgIsInitialized(cwd)) {
      cg = await CodeGraph.open(cwd);
    } else {
      cg = await CodeGraph.init(cwd);
    }
    // 起 FileWatcher 自动增量同步(文件变化自动 reindex,官方 daemon 的核心能力)
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

/** 关闭某项目的实例(切项目 / LXCode 退出时调)。 */
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

/** 关闭全部实例(LXCode 退出时调)。 */
export function closeAllCodegraph(): void {
  for (const cwd of [...instances.keys()]) closeCodegraph(cwd);
}

/** 项目是否已索引。 */
export function isCodegraphIndexed(cwd: string): boolean {
  return cgIsInitialized(cwd);
}

/** 索引状态摘要(给前端/IPC 看)。 */
export interface CodegraphStatus {
  /** 是否已建索引。 */
  initialized: boolean;
  /** 索引完整度: complete=完整, indexing=建中/被中断, partial=部分, failed=失败, null=无。 */
  state: "indexing" | "complete" | "partial" | "failed" | null;
  /** 节点数。 */
  nodeCount: number;
  /** 边数。 */
  edgeCount: number;
  /** 已索引文件数。 */
  fileCount: number;
  /** 上次索引时间(ms),null=无。 */
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
  } catch (e) {
    return { initialized: false, state: "failed", nodeCount: 0, edgeCount: 0, fileCount: 0, lastIndexedAt: null };
  }
}

/**
 * 常见第三方/生成目录,默认不索引(治本 litellm 这类第三方库偏移)。
 * gitignore 风格,匹配项目根相对路径。
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
 * 首次索引前自动生成 codegraph.json 排除常见第三方目录(治本第三方库偏移)。
 * 已存在且有效的 codegraph.json 不覆盖(尊重用户自定义);空/无效的会被覆盖。
 * 返回是否写了新文件。
 */
export async function ensureCodegraphConfig(cwd: string): Promise<boolean> {
  const fs = await import("node:fs/promises");
  const configPath = `${cwd}/codegraph.json`;
  try {
    const txt = await fs.readFile(configPath, "utf8");
    // 已存在且是有效 JSON:不覆盖
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

/** 索引项目(首次 init / 重建 index)。加项目时调。返回状态摘要。 */
export async function indexProjectCodegraph(cwd: string): Promise<{ ok: boolean; message: string }> {
  try {
    // 首次索引前确保排除配置(治本第三方库偏移)
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
    const cg = await getInstance(cwd);
    return { ok: true, message: cgIsInitialized(cwd) ? "已打开索引" : "首次索引完成" };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

/** 把源码行加上行号(1-indexed),和 Read 工具输出一致。 */
function numberLines(src: string, startLine: number): string {
  const lines = src.split(/\r?\n/);
  // 行号宽度对齐
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
    // startLine/endLine 是 1-indexed,数组是 0-indexed
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
 * 对齐官方 codegraph_explore MCP 工具的输出。
 *
 * 逻辑:searchNodes 找候选 → 收集涉及的文件 → 每个文件读相关符号源码(带行号)
 *      → getCallers/getCallees 拼调用路径 → getImpactRadius 拼影响面。
 */
export async function explore(cwd: string, query: string, maxFiles = 6): Promise<ExploreResult> {
  const cg = await getInstance(cwd);

  // 1. 搜符号(FTS 全文 + 名字匹配)
  const results = cg.searchNodes(query, { limit: 20 });
  // 也按名字精确找(query 可能就是函数名)
  const byName = cg.getNodesByName(query);
  const seen = new Set<string>();
  const candidates: CgNode[] = [];
  for (const r of [...byName.map((n) => ({ node: n })), ...results]) {
    const n = r.node;
    if (!seen.has(n.id)) {
      seen.add(n.id);
      candidates.push(n);
    }
  }
  if (candidates.length === 0) {
    return { query, found: 0, files: 0, blastRadius: [], sections: [] };
  }

  // 2. 按文件分组符号(限制文件数,对齐官方自适应预算)
  const fileToSymbols = new Map<string, CgNode[]>();
  for (const n of candidates) {
    if (fileToSymbols.size >= maxFiles && !fileToSymbols.has(n.filePath)) continue;
    const arr = fileToSymbols.get(n.filePath) ?? [];
    arr.push(n);
    fileToSymbols.set(n.filePath, arr);
  }

  // 3. 每个文件读源码(符号的函数体带行号)+ 调用链
  const sections: SourceSection[] = [];
  const blastRadiusSet = new Set<string>();
  for (const [file, nodes] of fileToSymbols) {
    // 合并该文件所有符号的行区间,读最小覆盖(简单起见取第一个符号源码 + 列出所有符号名)
    // 官方格式:文件头列出该文件的所有相关符号名,再给源码
    const symbolNames = nodes.map((n) => n.name);
    // 读第一个符号的源码(主符号),其余列出
    const main = nodes[0];
    const absPath = file.startsWith(cwd) ? file : `${cwd}/${file}`.replace(/\/+/g, "/");
    const source = await readSourceLines(absPath, main.startLine, main.endLine);
    if (source) {
      sections.push({ file, symbols: symbolNames, source });
    }
    // 调用链 + 影响面
    for (const n of nodes) {
      try {
        const callers = cg.getCallers(n.id, 1);
        for (const c of callers) {
          blastRadiusSet.add(`${c.node.name} (${c.node.filePath}:${c.node.startLine})`);
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
    blastRadius: [...blastRadiusSet].slice(0, 10),
    sections,
  };
}

/** 把 ExploreResult 格式化成给 AI 看的文本(对齐官方 CLI explore 输出)。 */
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
