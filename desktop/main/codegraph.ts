/**
 * codegraph 集成 —— 让 LXCode 自带 colbymchenry/codegraph 代码图谱。
 *
 * codegraph 是个 CLI(npm 包,@colbymchenry/codegraph),自带 runtime,零依赖。
 * LXCode 把它装进 dependencies 随应用分发,用户无需自己装。
 *
 * 它做的事:tree-sitter 解析代码 → SQLite 存符号/边 → MCP/CLI 查询。
 * 让 agent 不用 grep+read 一堆文件,一次 explore 就拿到相关源码+调用链+影响面。
 *
 * 这里负责:解析 codegraph bin、项目打开时自动索引、(后续)起 MCP server 给 pi 用。
 * 纯后端,无前端。
 */
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs/promises";
import { app } from "electron";

/** codegraph bin 脚本(npm-shim.js),从 LXCode 依赖解析。 */
let codegraphBin: string | null = null;

/** 解析 codegraph bin 路径(从 LXCode node_modules 解析,自带 runtime)。 */
async function resolveCodegraphBin(): Promise<string | null> {
  if (codegraphBin) return codegraphBin;
  try {
    const pkgPath = require.resolve("@colbymchenry/codegraph/package.json");
    const pkg = require(pkgPath) as { bin: { codegraph: string } };
    codegraphBin = path.join(path.dirname(pkgPath), pkg.bin.codegraph);
    return codegraphBin;
  } catch {
    return null;
  }
}

/** 跑一个 codegraph 命令(非交互),返回 stdout。失败返回 null + 错误。 */
async function runCodegraph(args: string[], cwd: string, timeoutMs = 120_000): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  const bin = await resolveCodegraphBin();
  if (!bin) return { ok: false, stdout: "", stderr: "codegraph 未安装" };
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [bin, ...args], { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.stdout?.on("data", (d) => (stdout += d));
    child.stderr?.on("data", (d) => (stderr += d));
    child.on("error", () => { clearTimeout(timer); resolve({ ok: false, stdout, stderr }); });
    child.on("close", (code) => { clearTimeout(timer); resolve({ ok: code === 0, stdout, stderr }); });
  });
}

/** 项目是否已索引(.codegraph/codegraph.db 存在)。 */
export async function isCodegraphIndexed(cwd: string): Promise<boolean> {
  try {
    const db = path.join(cwd, ".codegraph", "codegraph.db");
    await fs.access(db);
    return true;
  } catch {
    return false;
  }
}

/**
 * 索引项目(首次 init,后续 sync 增量)。
 * LXCode 打开项目时调,让 agent 能查代码。返回状态摘要。
 */
export async function indexProjectCodegraph(cwd: string): Promise<{ ok: boolean; indexed: boolean; message: string }> {
  const binOk = await resolveCodegraphBin();
  if (!binOk) return { ok: false, indexed: false, message: "codegraph 未安装" };
  const indexed = await isCodegraphIndexed(cwd);
  // 已索引: sync 增量; 未索引: init 全量
  const cmd = indexed ? ["sync", "."] : ["init", "."];
  const res = await runCodegraph(cmd, cwd, 180_000);
  if (!res.ok) return { ok: false, indexed, message: res.stderr || "索引失败" };
  return { ok: true, indexed, message: indexed ? "增量同步完成" : "首次索引完成" };
}

/** 查询项目索引状态(节点/边/文件数)。 */
export async function codegraphStatus(cwd: string): Promise<{ ok: boolean; status?: string; message?: string }> {
  const res = await runCodegraph(["status", "."], cwd, 30_000);
  if (!res.ok) return { ok: false, message: res.stderr || "状态查询失败" };
  return { ok: true, status: res.stdout };
}

/** 获取 codegraph bin 路径(给 MCP server 启动用)。 */
export async function getCodegraphBin(): Promise<string | null> {
  return resolveCodegraphBin();
}
