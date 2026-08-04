/**
 * 真实应用主进程入口:agent 服务 + IPC 桥接。
 * 由 electron/main.ts 加载,在 app ready 后初始化。
 */
import { ipcMain, BrowserWindow } from "electron";
import { prompt, abort, disposeSession, disposeAll, listProviders, listSessions, createSession, setModel } from "./agent-service";
import { initDataIpc } from "./data-ipc";

/** 初始化所有 IPC handler。 */
export function initAgentIpc() {
  initDataIpc();
  // 发送 prompt。事件通过 onEvent 推给调用方的 sender。
  ipcMain.handle(
    "agent:prompt",
    async (evt, args: { cwd: string; text: string }) => {
      const win = BrowserWindow.fromWebContents(evt.sender);
      const onEvent = (e: unknown) => {
        win?.webContents.send("agent:event", e);
      };
      try {
        await prompt(args.cwd, args.text, onEvent);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      }
    },
  );

  // 中断当前会话。
  ipcMain.handle("agent:abort", async (_evt, args: { cwd: string }) => {
    await abort(args.cwd);
    return { ok: true };
  });

  // 关闭某会话。
  ipcMain.handle("agent:dispose", (_evt, args: { cwd: string }) => {
    disposeSession(args.cwd);
    return { ok: true };
  });

  // 列出真实 providers + models。
  ipcMain.handle("agent:listProviders", async () => {
    try {
      return { ok: true, providers: await listProviders() };
    } catch (err) {
      return { ok: false, error: (err as Error).message, providers: [] };
    }
  });

  // 列出某工作目录的已有会话。
  ipcMain.handle("agent:listSessions", async (_evt, args: { cwd: string }) => {
    try {
      return { ok: true, sessions: await listSessions(args.cwd) };
    } catch (err) {
      return { ok: false, error: (err as Error).message, sessions: [] };
    }
  });

  // 创建新持久化会话。
  ipcMain.handle("agent:createSession", async (_evt, args: { cwd: string; name?: string }) => {
    try {
      return { ok: true, ...(await createSession(args.cwd, args.name)) };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  // 设置某会话的默认模型。
  ipcMain.handle("agent:setModel", async (_evt, args: { cwd: string; providerId: string; modelId: string }) => {
    try {
      await setModel(args.cwd, args.providerId, args.modelId);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });
}

/** 应用退出时清理所有会话。 */
export function shutdownAgent() {
  disposeAll();
}
