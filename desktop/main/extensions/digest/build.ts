/**
 * digest 构建 —— 把 AST 骨架聚类成 DigestFile。
 *
 * 阶段1:纯结构化,不调 LLM。白话字段(what/how/pitfalls)留空字符串占位。
 * 模块按目录聚类,函数按文件分组,调用关系在本文件内解析。
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { isParseable, parseFile, type FileSkeleton } from "./ast";
import type { DigestFile, FunctionSummary, ModuleSummary } from "./schema";

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
      if (SKIP_DIRS.has(e.name)) continue;
      await listFiles(cwd, full, out);
    } else if (e.isFile() && isParseable(e.name)) {
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
function toSummaries(file: string, sk: FileSkeleton, allFnNames: Set<string>): FunctionSummary[] {
  return sk.functions.map((f) => {
    // 本文件内被调用的函数(过滤掉全局/内置调用)
    const calls = f.calls.filter((c) => allFnNames.has(c));
    // calledBy:本文件其他函数调用了我
    const calledBy = sk.functions
      .filter((other) => other.fn !== f.fn && other.calls.includes(f.fn))
      .map((other) => other.fn);
    const callCount = calledBy.length;
    return {
      file,
      fn: f.fn,
      startLine: f.startLine,
      endLine: f.endLine,
      level: levelOf(f, callCount),
      what: "", // 阶段1 留空,下次迭代 LLM 填白话
      how: [],
      calls: { calls, calledBy, source: "ast" },
      entry: f.exported,
    } satisfies FunctionSummary;
  });
}

/** 按目录聚类成模块(取第一层目录名作为模块名)。 */
function clusterModules(files: string[], functionsByFile: Record<string, FunctionSummary[]>): ModuleSummary[] {
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
    what: "", // 阶段1 留空
    files,
    related: [],
  }));
}

/** 全量构建 digest。返回 DigestFile 结构(白话字段留空)。 */
export async function buildDigest(cwd: string): Promise<DigestFile> {
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

  const functions: Record<string, FunctionSummary[]> = {};
  for (const sk of skeletons) {
    functions[sk.file] = toSummaries(sk.file, sk, allFnNames);
  }

  const modules = clusterModules(files, functions);

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    trigger: "onboarding",
    cwd,
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
