/**
 * auto-git pi 扩展 —— 每个项目保证有本地仓库,AI 每次改动自动 commit,随时可回滚。
 *
 * - session_start:确保 git 仓库 + 切到隔离分支 lxcode/auto(auto commit 与远程/用户历史隔离)
 * - tool_call(edit/write):记录 AI 改动的文件,用于生成规范 commit message
 * - agent_settled:自动提交(隔离分支上 add -A,conventional message,无变更跳过)
 *
 * 纯后端,无 UI。挂载同其他内置扩展(extensionFactories)。
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { ensureGitRepo, ensureAutoBranch, autoCommit } from "./auto-git.js";

/** pi-host logger 接管 console.log,console.error 进 stderr 日志。 */
function logError(scope: string, message: string): void {
  try { console.error(`[auto-git:${scope}] ${message}`); } catch { /* 静默 */ }
}

// 每个 cwd 会话期间 AI 改动的文件(edit/write 工具)
const sessionFilesByCwd = new Map<string, Set<string>>();
// 每个 cwd 的仓库准备 Promise(切隔离分支),auto commit 前必须等它完成
const repoReadyByCwd = new Map<string, Promise<void>>();

/** 从 edit/write 工具调用参数里提取文件路径。 */
function extractFilePath(input: unknown): string | null {
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  const path = record.path ?? record.filePath;
  if (typeof path === "string" && path.trim()) return path.trim();
  return null;
}

export default function createAutoGitExtension(pi: ExtensionAPI): void {
  // 会话开始:确保 git 仓库 + 切隔离分支(不阻塞对话,但 auto commit 会等它完成)
  pi.on("session_start", (_event, ctx) => {
    sessionFilesByCwd.set(ctx.cwd, new Set());
    const ready = (async () => {
      try {
        await ensureGitRepo(ctx.cwd);
        await ensureAutoBranch(ctx.cwd);
      } catch (e) {
        logError("session_start", e instanceof Error ? e.message : String(e));
      }
    })();
    repoReadyByCwd.set(ctx.cwd, ready);
  });

  // 记录 AI 改动的文件(edit/write)
  pi.on("tool_call", (event, ctx) => {
    const files = sessionFilesByCwd.get(ctx.cwd);
    if (!files) return;
    if (event.toolName !== "edit" && event.toolName !== "write") return;
    const path = extractFilePath((event as { input?: unknown }).input);
    if (path) files.add(path);
  });

  // 会话结束:等仓库准备好再 commit(保证 commit 落在隔离分支)
  pi.on("agent_settled", (_event, ctx) => {
    void (async () => {
      try {
        await repoReadyByCwd.get(ctx.cwd);
        const sessionFiles = [...(sessionFilesByCwd.get(ctx.cwd) ?? [])];
        await autoCommit(ctx.cwd, sessionFiles);
      } catch {
        // 静默
      } finally {
        sessionFilesByCwd.delete(ctx.cwd);
        repoReadyByCwd.delete(ctx.cwd);
      }
    })();
  });

  // 会话关闭:等仓库准备好 + 兑底 commit + 清理
  pi.on("session_shutdown", (_event, ctx) => {
    void (async () => {
      try {
        await repoReadyByCwd.get(ctx.cwd);
        const sessionFiles = [...(sessionFilesByCwd.get(ctx.cwd) ?? [])];
        if (sessionFiles.length > 0) await autoCommit(ctx.cwd, sessionFiles);
      } catch {
        // 静默
      } finally {
        sessionFilesByCwd.delete(ctx.cwd);
        repoReadyByCwd.delete(ctx.cwd);
      }
    })();
  });
}
