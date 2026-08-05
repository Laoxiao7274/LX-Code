/**
 * digest 构建 —— 把 AST 骨架聚类成 DigestFile。
 *
 * 阶段1:纯结构化,不调 LLM。白话字段(what/how/pitfalls)留空字符串占位。
 * 模块按目录聚类,函数按文件分组,调用关系在本文件内解析。
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { isParseable, parseFile, type FileSkeleton } from "./ast";
import { summarizeFile, nameClusters, type LLMRuntime } from "./summarize";
import { clusterByFiles, type FileNode, type FileEdge } from "./cluster";
import type { DigestFile, FeatureCluster, FunctionSummary, ModuleSummary } from "./schema";

/** 构建时跳过的目录。 */
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".pi",
  ".lxcode",
  "dist",
  "build",
  "release",
  "out",
  "reference", // LXCode 参考项目,只读不算
]);

/** 递归列出可解析的源文件(相对 cwd)。 */
async function listFiles(cwd: string, dir: string, out: string[]): Promise<void> {
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name) || e.name.startsWith(".")) continue;
      await listFiles(cwd, full, out);
    } else if (e.isFile() && isParseable(e.name) && !e.name.startsWith(".")) {
      out.push(path.relative(cwd, full).replace(/\\/g, "/"));
    }
  }
}

/** 启发式判断函数级别。 */
function levelOf(fn: { exported: boolean; hasJsx: boolean; calls: string[] }, callCount: number): FunctionSummary["level"] {
  if (fn.hasJsx) return "ui";
  if (fn.exported && callCount > 0) return "core";
  if (fn.exported) return "util";
  return "glue";
}

/** 把单个文件的骨架转成 FunctionSummary[](补 calls/calledBy/level,白话留空)。 */
/** 把单个文件的骨架转成 FunctionSummary[]。白话字段由 LLM 结果填充(无 LLM 则留空)。 */
function toSummaries(file: string, sk: FileSkeleton, allFnNames: Set<string>, llm?: { what: string; functions: Record<string, { what: string; how: string[]; logic?: string[] }> }): FunctionSummary[] {
  return sk.functions.map((f) => {
    // 本文件内被调用的函数(过滤掉全局/内置调用)
    const calls = f.calls.filter((c) => allFnNames.has(c));
    // calledBy:本文件其他函数调用了我
    const calledBy = sk.functions
      .filter((other) => other.fn !== f.fn && other.calls.includes(f.fn))
      .map((other) => other.fn);
    const callCount = calledBy.length;
    const llmFn = llm?.functions[f.fn];
    return {
      file,
      fn: f.fn,
      startLine: f.startLine,
      endLine: f.endLine,
      level: levelOf(f, callCount),
      what: llmFn?.what ?? "",
      how: llmFn?.how ?? [],
      ...(llmFn?.logic?.length ? { logic: llmFn.logic } : {}),
      calls: { calls, calledBy, source: "ast" },
      entry: f.exported,
    } satisfies FunctionSummary;
  });
}

/** 按目录聚类成模块(取第一层目录名作为模块名)。moduleWhat 传 LLM 生成的模块白话。 */
function clusterModules(files: string[], functionsByFile: Record<string, FunctionSummary[]>, moduleWhat: Record<string, string>): ModuleSummary[] {
  const byDir = new Map<string, string[]>();
  for (const file of files) {
    const dir = path.dirname(file);
    const top = dir === "." ? "(root)" : dir.split("/")[0];
    if (!byDir.has(top)) byDir.set(top, []);
    byDir.get(top)!.push(file);
  }
  return [...byDir.entries()].map(([name, files]) => ({
    name,
    path: files[0] ?? name,
    what: moduleWhat[name] ?? "",
    files,
    related: [],
  }));
}

/** 全量构建 digest。有 LLM+model 则对含导出函数的文件调 LLM 填白话(限量,防烧 token)。 */
export async function buildDigest(cwd: string, llm?: LLMRuntime, model?: unknown): Promise<DigestFile> {
  const files: string[] = [];
  await listFiles(cwd, cwd, files);

  const skeletons: FileSkeleton[] = [];
  for (const rel of files) {
    const full = path.join(cwd, rel);
    try {
      const source = await fs.readFile(full, "utf-8");
      skeletons.push(parseFile(rel, source));
    } catch {
      // 读失败跳过
    }
  }

  // 收集所有函数名(用于过滤调用关系)
  const allFnNames = new Set<string>();
  for (const sk of skeletons) for (const f of sk.functions) allFnNames.add(f.fn);

  // LLM 摘要:只摘要有导出函数的文件,且限量(最多 40 个文件,防大项目烧 token)
  const MAX_LLM_FILES = 20;
  const filesToSummarize = skeletons
    .filter((sk) => sk.functions.some((f) => f.exported))
    .slice(0, MAX_LLM_FILES);
  const llmResults = new Map<string, { what: string; functions: Record<string, { what: string; how: string[]; logic?: string[] }> }>();
  if (llm && model) {
    // 并发调用 LLM(5 路),避免串行几十个文件太慢
    const CONCURRENCY = 5;
    let done = 0;
    const total = filesToSummarize.length;
    const queue = [...filesToSummarize];
    const worker = async () => {
      while (queue.length) {
        const sk = queue.shift()!;
        const full = path.join(cwd, sk.file);
        try {
          const source = await fs.readFile(full, "utf-8");
          const skText = sk.functions.map((f) => `${f.fn}(L${f.startLine}-${f.endLine} ${f.exported ? "exported" : ""} calls:[${f.calls.join(",")}])`).join("\n");
          const summary = await summarizeFile(llm, model, sk.file, skText, source);
          done++;
          if (done === 1 || done % 5 === 0) console.log(`[digest] 摘要进度 ${done}/${total}`);
          if (summary) llmResults.set(sk.file, summary);
        } catch {
          // 单文件摘要失败不阻断
          done++;
        }
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
    console.log(`[digest] 摘要完成 ${llmResults.size}/${total}`);
  }

  const functions: Record<string, FunctionSummary[]> = {};
  for (const sk of skeletons) {
    functions[sk.file] = toSummaries(sk.file, sk, allFnNames, llmResults.get(sk.file));
  }

  // 模块白话:用该模块下文件 LLM what 拼接(简单聚合)
  const moduleWhat: Record<string, string> = {};
  for (const [file, s] of llmResults) {
    const top = path.dirname(file) === "." ? "(root)" : path.dirname(file).split("/")[0];
    if (s.what && !moduleWhat[top]) moduleWhat[top] = s.what;
  }
  const modules = clusterModules(files, functions, moduleWhat);

  // 功能聚类:文件级标签传播(对齐 Glue 做法),节点=文件,边=文件间依赖
  // 比 之前函数级聚类稳定(函数级聚出178碎簇,文件级聚成20-40个)
  const fileNodes: FileNode[] = [];
  for (const sk of skeletons) fileNodes.push({ file: sk.file, inDegree: 0 });
  // 重算 inDegree:某文件被多少其他文件的函数调用
  const fileInDeg = new Map<string, number>();
  for (const f of fileNodes) fileInDeg.set(f.file, 0);
  const fnsByFile: Record<string, string[]> = {};
  for (const [file, fns] of Object.entries(functions)) fnsByFile[file] = fns.map((f) => f.fn);
  // fn名 → 所在文件(同名取首个)
  const fnToFile = new Map<string, string>();
  for (const [file, fns] of Object.entries(functions)) {
    for (const f of fns) if (!fnToFile.has(f.fn)) fnToFile.set(f.fn, file);
  }
  // 文件边:A 的函数调用 B 的函数 → A 依赖 B(权重0.8);import → 权重1.0
  const fileEdges: FileEdge[] = [];
  const edgeMap = new Map<string, number>();
  const addEdge = (from: string, to: string, w: number) => {
    if (from === to) return;
    const k = `${from}->${to}`;
    edgeMap.set(k, Math.max(edgeMap.get(k) ?? 0, w));
    if (from !== to) fileInDeg.set(to, (fileInDeg.get(to) ?? 0) + 1);
  };
  for (const [file, fns] of Object.entries(functions)) {
    for (const f of fns) {
      for (const calleeName of f.calls?.calls ?? []) {
        const targetFile = fnToFile.get(calleeName);
        if (targetFile && targetFile !== file) addEdge(file, targetFile, 0.8);
      }
    }
  }
  // import 边:相对路径 import → 解析成项目文件(权重1.0,比函数调用强)
  const allFileSet = new Set(skeletons.map((s) => s.file));
  /** 把 import 模块名(./xxx)解析成项目文件路径,返回 null 表示外部包 */
  const resolveImport = (fromFile: string, mod: string): string | null => {
    if (!mod.startsWith(".")) return null; // 跳过 npm 包
    const dir = fromFile.includes("/") ? fromFile.slice(0, fromFile.lastIndexOf("/")) : ".";
    let rel = mod;
    if (rel.startsWith("./")) rel = rel.slice(2);
    else if (rel.startsWith("../")) {
      // 简化:逐级回退目录
      const parts = dir.split("/");
      let up = 0;
      while (rel.startsWith("../")) { rel = rel.slice(3); up++; }
      parts.splice(parts.length - up, up);
      rel = parts.filter(Boolean).join("/") + "/" + rel;
    } else {
      rel = dir + "/" + rel;
    }
    // 试补扩展名
    for (const ext of [".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx", "/index.js"]) {
      const cand = rel + ext;
      if (allFileSet.has(cand)) return cand;
    }
    return null;
  };
  for (const sk of skeletons) {
    for (const mod of sk.imports) {
      const target = resolveImport(sk.file, mod);
      if (target) addEdge(sk.file, target, 1.0);
    }
  }
  for (const n of fileNodes) n.inDegree = fileInDeg.get(n.file) ?? 0;
  for (const [k, w] of edgeMap) {
    const [from, to] = k.split("->");
    fileEdges.push({ from, to, weight: w });
  }
  const features: FeatureCluster[] = clusterByFiles(fileNodes, fileEdges, fnsByFile);
  // LLM 只给前 10 个大簇命名(一次调用),其余用启发式名(入口文件名)。降成本
  if (llm && model && features.length > 0) {
    const bigClusters = features.filter((f) => f.id !== "__other__").slice(0, 10);
    if (bigClusters.length > 0) {
      const inputs = bigClusters.map((f) => ({ id: f.id, members: f.members }));
      console.log(`[digest] LLM 命名 ${inputs.length} 个大簇(一次调用)...`);
      const names = await nameClusters(llm, model, inputs);
      console.log(`[digest] LLM 命名完成:`, names ? `${names.filter(n=>n.name).length}成功` : 'null(失败,用启发式名)');
      if (names) {
        bigClusters.forEach((f, i) => {
          if (names[i]?.name) f.name = names[i]!.name;
          if (names[i]?.what) f.what = names[i]!.what;
        });
      }
    }
  }

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    trigger: "onboarding",
    cwd,
    features,
    modules,
    functions,
    provider: { name: "builtin", version: "ast-1" },
    callGraph: [],
    entryPoints: [],
  };
}

/** 读 digest.json,不存在返回 null。 */
export async function readDigest(cwd: string): Promise<DigestFile | null> {
  try {
    const p = path.join(cwd, ".lxcode", "digest.json");
    const raw = await fs.readFile(p, "utf-8");
    return JSON.parse(raw) as DigestFile;
  } catch {
    return null;
  }
}

/** 原子写 digest.json(临时文件 + rename,避免半写损坏)。 */
export async function writeDigest(cwd: string, digest: DigestFile): Promise<void> {
  const dir = path.join(cwd, ".lxcode");
  await fs.mkdir(dir, { recursive: true });
  const final = path.join(dir, "digest.json");
  const tmp = final + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(digest, null, 2), "utf-8");
  await fs.rename(tmp, final);
}
