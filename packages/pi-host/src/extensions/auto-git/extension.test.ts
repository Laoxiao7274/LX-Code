/**
 * auto-git 扩展 —— session 切换安全性测试。
 *
 * 回归用例:AI 一轮结束触发 agent_settled → auto-git 启动 git commit 异步任务
 * (最长 15s)。用户在此期间点击历史记录切换 session,旧 ctx 被 SDK invalidate,
 * 此时回调若再访问 ctx.cwd 会抛 "extension ctx is stale";尤其 finally 块的抛错
 * 逃出 try/catch 成为 unhandled rejection,会让 host 进程崩溃退出。
 *
 * 修复:每个事件回调在入口把 ctx.cwd 取为局部变量,后续(含 async 任务、finally)
 * 只用局部变量,不再触碰 ctx。本测试模拟 "await 期间 invalidate ctx" 的时序,
 * 断言不产生 unhandled rejection。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const git = vi.hoisted(() => ({
  ensureGitRepo: vi.fn(),
  ensureAutoBranch: vi.fn(),
  autoCommit: vi.fn(),
}));

vi.mock("./auto-git.js", () => ({
  ensureGitRepo: git.ensureGitRepo,
  ensureAutoBranch: git.ensureAutoBranch,
  autoCommit: git.autoCommit,
}));

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import createAutoGitExtension from "./extension.js";

type Handler = (event: unknown, ctx: StaleCtx) => void;

interface StaleCtx {
  readonly cwd: string;
  invalidate(): void;
}

function createPiStub() {
  const handlers = new Map<string, Handler[]>();
  return {
    on(event: string, handler: Handler) {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
    },
    emit(event: string, ev: unknown, ctx: StaleCtx) {
      handlers.get(event)?.forEach((h) => void h(ev, ctx));
    },
  };
}

/** 模拟 SDK 的 ctx:cwd getter 在 invalidate() 后抛 stale 错(与 runner.js 行为一致)。 */
function createStaleCtx(cwd: string): StaleCtx {
  let stale = false;
  return {
    get cwd() {
      if (stale) {
        throw new Error(
          "This extension ctx is stale after session replacement or reload. Do not reuse it.",
        );
      }
      return cwd;
    },
    invalidate() {
      stale = true;
    },
  };
}

async function flush(): Promise<void> {
  // 排空多层 await 链 + 一个宏任务,确保 iife 全部跑完
  for (let i = 0; i < 20; i++) await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("auto-git extension — session-switch safety", () => {
  let unhandled: unknown[];
  let onUnhandled: (reason: unknown) => void;

  beforeEach(() => {
    git.ensureGitRepo.mockReset();
    git.ensureAutoBranch.mockReset();
    git.autoCommit.mockReset();
    git.ensureGitRepo.mockResolvedValue(true);
    git.ensureAutoBranch.mockResolvedValue(true);
    git.autoCommit.mockResolvedValue(null);
    unhandled = [];
    onUnhandled = (reason) => unhandled.push(reason);
    process.on("unhandledRejection", onUnhandled);
  });

  afterEach(() => {
    process.off("unhandledRejection", onUnhandled);
  });

  it("agent_settled 不会因 await 期间 ctx 失效而抛 unhandled rejection", async () => {
    const pi = createPiStub();
    createAutoGitExtension(pi as unknown as ExtensionAPI);

    // 让 session_start 的 repoReady 挂起,模拟 git 操作进行中
    let resolveRepo!: () => void;
    git.ensureGitRepo.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          resolveRepo = () => resolve(true);
        }),
    );

    pi.emit("session_start", {}, createStaleCtx("/proj-a"));

    // agent_settled 触发,async iife 开始 await repoReady
    const settledCtx = createStaleCtx("/proj-a");
    pi.emit("agent_settled", {}, settledCtx);

    // 用户在此期间点击历史记录切换 session → 旧 ctx invalidate
    settledCtx.invalidate();

    // 释放 repoReady → iife 从 await 返回,继续执行(只用局部 cwd,不再碰 ctx)
    resolveRepo();

    await flush();

    expect(unhandled).toEqual([]);
    expect(git.autoCommit).toHaveBeenCalledWith("/proj-a", []);
  });

  it("session_shutdown 不会因 await 期间 ctx 失效而抛 unhandled rejection", async () => {
    const pi = createPiStub();
    createAutoGitExtension(pi as unknown as ExtensionAPI);

    let resolveRepo!: () => void;
    git.ensureGitRepo.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          resolveRepo = () => resolve(true);
        }),
    );

    pi.emit("session_start", {}, createStaleCtx("/proj-b"));

    const shutdownCtx = createStaleCtx("/proj-b");
    pi.emit("session_shutdown", {}, shutdownCtx);
    shutdownCtx.invalidate();

    resolveRepo();

    await flush();

    expect(unhandled).toEqual([]);
  });

  it("正常路径:agent_settled 在仓库就绪后提交收集到的改动文件", async () => {
    const pi = createPiStub();
    createAutoGitExtension(pi as unknown as ExtensionAPI);

    const ctx = createStaleCtx("/proj-c");
    pi.emit("session_start", {}, ctx);
    pi.emit("tool_call", { toolName: "edit", input: { path: "src/a.ts" } }, ctx);
    pi.emit("agent_settled", {}, ctx);

    await flush();

    expect(git.autoCommit).toHaveBeenCalledWith("/proj-c", ["src/a.ts"]);
    expect(unhandled).toEqual([]);
  });
});
