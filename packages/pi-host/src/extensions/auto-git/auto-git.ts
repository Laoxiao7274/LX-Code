/**
 * 自动 git 能力 —— 确保 workspace 有本地仓库 + AI 每次改动自动 commit,保证随时可回滚。
 *
 * - ensureGitRepo(cwd): 不是 git 仓库则 git init + 设 local user 配置 + 补 node_modules 忽略
 * - ensureAutoBranch(cwd): 切到独立的 lxcode/auto 分支(auto commit 与用户/远程历史隔离)
 * - autoCommit(cwd, files): 智能 add(AI 改的文件 + 已跟踪修改,不纳未跟踪) + 有变更则 commit
 *
 * 隔离策略:AI 的 auto commit 全部落在 lxcode/auto 本地分支,绝不 push,
 * 与用户主分支(master/main)和远程历史完全隔离。用户想合并 AI 改动时手动
 * git merge lxcode/auto。
 */
import { spawn } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const GIT_TIMEOUT_MS = 15_000;

/** pi-host logger 接管了 console.log(不输出),console.error 进 stderr 日志。 */
function logError(scope: string, message: string): void {
  try { console.error(`[auto-git:${scope}] ${message}`); } catch { /* 静默 */ }
}

type GitResult = { code: number | null; stdout: string; stderr: string };

function runGit(cwd: string, args: string[]): Promise<GitResult> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    const child = spawn("git", ["-C", cwd, "--no-pager", ...args], {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      env: {
        ...process.env,
        // 与 host git-service 一致:避免与 ChangesPanel/git-service 抢 index 锁
        GIT_OPTIONAL_LOCKS: "0",
        // 禁止 git 交互提示(避免挂起等输入)
        GIT_TERMINAL_PROMPT: "0",
        // 避免分页器挂起
        GIT_PAGER: "cat",
        PAGER: "cat",
        // 固定 locale,避免中文 locale 解析异常
        LC_ALL: "C",
        LANG: "C",
      },
    });
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      resolve({ code: null, stdout, stderr: "git timed out" });
    }, GIT_TIMEOUT_MS);
    child.stdout.on("data", (d: Buffer) => { stdout += d.toString("utf8"); });
    child.stderr.on("data", (d: Buffer) => { stderr += d.toString("utf8"); });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code: -1, stdout, stderr: err.message });
    });
  });
}

/** 目录是否为 git 仓库(在 cwd 或其父级)。 */
export async function isGitRepository(cwd: string): Promise<boolean> {
  const r = await runGit(cwd, ["rev-parse", "--is-inside-work-tree"]);
  return r.code === 0 && r.stdout.trim() === "true";
}

/** 当前分支名。 */
export async function currentBranch(cwd: string): Promise<string | null> {
  const r = await runGit(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
  return r.code === 0 ? r.stdout.trim() || null : null;
}

/** 自动 init 新仓库时的默认忽略(避免误提交依赖/产物/敏感文件)。 */
const DEFAULT_GITIGNORE = [
  "node_modules/",
  ".env",
  ".env.*",
  "dist/",
  "build/",
  "*.log",
  ".DS_Store",
  ".lxcode-worktree/",
].join("\n") + "\n";

/** 确保 workspace 是 git 仓库;不是则 init + 设 local 配置 + 补忽略。 */
export async function ensureGitRepo(cwd: string): Promise<boolean> {
  try {
    if (await isGitRepository(cwd)) return true;
    const r = await runGit(cwd, ["init", "-q"]);
    if (r.code !== 0) { logError("init", `git init failed: ${r.stderr}`); return false; }
    const name = await runGit(cwd, ["config", "user.name"]);
    if (!name.stdout.trim()) await runGit(cwd, ["config", "user.name", "LXCode Auto"]);
    const email = await runGit(cwd, ["config", "user.email"]);
    if (!email.stdout.trim()) await runGit(cwd, ["config", "user.email", "lxcode@local"]);
    // 仅自动 init 的新仓库写默认 .gitignore;已存在 .gitignore 不动(尊重用户忽略策略)
    const gitignorePath = join(cwd, ".gitignore");
    if (!existsSync(gitignorePath)) {
      writeFileSync(gitignorePath, DEFAULT_GITIGNORE, "utf8");
    }
    return true;
  } catch (e) {
    logError("ensureGitRepo", e instanceof Error ? e.message : String(e));
    return false;
  }
}

const AUTO_BRANCH = "lxcode/auto";

/**
 * 切到隔离分支 lxcode/auto。工作区脏时先 stash 保留改动,切后 pop 恢复:
 * - 已在该分支 → true
 * - 分支不存在 → 从当前 HEAD 创建并切换
 * - 分支存在 → 切换
 * - 切换失败(工作区脏) → stash + switch + stash pop(把用户改动带到隔离分支)
 * - 仍失败 → 返回 false(autoCommit 会因不在隔离分支跳过,绝不污染主分支)
 */
export async function ensureAutoBranch(cwd: string): Promise<boolean> {
  try {
    if (!(await isGitRepository(cwd))) return false;
    const current = await currentBranch(cwd);
    if (current === AUTO_BRANCH) return true;
    const branchExists = await runGit(cwd, ["rev-parse", "--verify", "--quiet", `refs/heads/${AUTO_BRANCH}`]);
    const createOrSwitch = branchExists.code === 0
      ? () => runGit(cwd, ["switch", AUTO_BRANCH])
      : () => runGit(cwd, ["switch", "-c", AUTO_BRANCH]);
    // 直接切
    let sw = await createOrSwitch();
    if (sw.code === 0) return true;
    // 工作区脏导致切失败:stash 保留改动 → 切 → pop 恢复(改动带到隔离分支)
    const stash = await runGit(cwd, ["stash", "push", "-u", "-m", "lxcode-auto-branch-switch"]);
    if (stash.code !== 0) {
      logError("switch", `切到 ${AUTO_BRANCH} 失败且 stash 失败: ${sw.stderr}`);
      return false;
    }
    sw = await createOrSwitch();
    if (sw.code !== 0) {
      // 切不了就恢复 stash 到原分支
      await runGit(cwd, ["stash", "pop"]);
      logError("switch", `stash 后仍切 ${AUTO_BRANCH} 失败: ${sw.stderr}`);
      return false;
    }
    const pop = await runGit(cwd, ["stash", "pop"]);
    if (pop.code !== 0) logError("stash-pop", `恢复 stash 失败(改动在 stash 里): ${pop.stderr}`);
    return true;
  } catch (e) {
    logError("ensureAutoBranch", e instanceof Error ? e.message : String(e));
    return false;
  }
}

/** 根据文件推断 conventional commit type。 */
function inferType(file: string): "docs" | "test" | "chore" {
  const lower = file.toLocaleLowerCase();
  if (/\.(md|mdx|txt|adoc|rst)$/.test(lower) || lower.includes("/docs/")) return "docs";
  if (/\.(test|spec)\.|(^|\/)(test|tests|__tests__)\//.test(lower) || /\.(test|spec)\.[cm]?[jt]sx?$/.test(lower)) return "test";
  return "chore";
}

/**
 * 生成 conventional commit message:
 *   type(lxcode-auto): <subject>
 * subject 基于工具调用收集的文件(优先)或 diff 文件列表。
 */
export function buildCommitMessage(files: string[], sessionFiles?: string[]): string {
  const tracked = (sessionFiles && sessionFiles.length > 0 ? sessionFiles : files).filter(Boolean);
  const type = tracked.length > 0 ? inferType(tracked[0]!) : "chore";
  const count = files.length;
  let subject: string;
  let body: string | null = null;
  if (tracked.length === 1) {
    const name = tracked[0]!;
    subject = `${name.split("/").pop()}`;
    body = `文件: ${name}`;
  } else {
    subject = `update ${count} 个文件`;
    body = tracked.slice(0, 10).map((f) => `- ${f}`).join("\n");
    if (tracked.length > 10) body += `\n- ...等 ${count} 个文件`;
  }
  const head = `${type}(lxcode-auto): ${subject}`;
  return body ? `${head}\n\n${body}` : head;
}

/**
 * 自动提交。在隔离分支 lxcode/auto 上用 git add -A(提交全部变更):
 *  - 隔离分支不污染 master/远程,即使纳入未跟踪文件也安全
 *  - .gitignore 默认忽略 node_modules/.env/dist/产物等,避免误提交
 *  - AI 用 bash 创建的未跟踪文件也能提交,保证回滚完整
 *  - 安全保护:不在 lxcode/auto 分支时绝不提交(避免污染用户主分支)
 * 无变更返回 null。
 */
export async function autoCommit(
  cwd: string,
  sessionFiles?: string[],
): Promise<{ sha: string; files: string[] } | null> {
  try {
    if (!(await isGitRepository(cwd))) return null;
    // 安全保护:必须在隔离分支才提交,绝不污染 master/main
    const branch = await currentBranch(cwd);
    if (branch !== AUTO_BRANCH) {
      logError("autoCommit", `当前分支 ${branch} 非 ${AUTO_BRANCH},跳过提交避免污染主分支`);
      return null;
    }
    const add = await runGit(cwd, ["add", "-A"]);
    if (add.code !== 0) { logError("add", add.stderr); return null; }
    const changed = await runGit(cwd, ["diff", "--cached", "--name-only"]);
    if (changed.code !== 0) { logError("diff", changed.stderr); return null; }
    const files = changed.stdout.split("\n").map((s) => s.trim()).filter(Boolean);
    if (files.length === 0) return null; // 无变更,跳过
    const message = buildCommitMessage(files, sessionFiles);
    const commit = await runGit(cwd, ["commit", "-m", message, "--quiet"]);
    if (commit.code !== 0) { logError("commit", commit.stderr); return null; }
    const sha = await runGit(cwd, ["rev-parse", "--short", "HEAD"]);
    return { sha: sha.stdout.trim() || "unknown", files };
  } catch (e) {
    logError("autoCommit", e instanceof Error ? e.message : String(e));
    return null;
  }
}
