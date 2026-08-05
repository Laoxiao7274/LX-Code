/**
 * 真实应用主进程入口:agent 服务 + IPC 桥接。
 * 由 electron/main.ts 加载,在 app ready 后初始化。
 */
import { ipcMain, BrowserWindow } from "electron";
import { prompt, abort, disposeSession, disposeAll, listProviders, listSessions, createSession, setModel, setThinkingLevel, getMessages } from "./agent-service";
import { initDataIpc } from "./data-ipc";

/** 初始化所有 IPC handler。 */
export function initAgentIpc() {
  initDataIpc();
  // 发送 prompt。事件通过 onEvent 推给调用方的 sender。
  ipcMain.handle(
    "agent:prompt",
    async (evt, args: { sessionId: string; cwd: string; text: string; images?: { path: string }[]; sessionPath?: string }) => {
      const win = BrowserWindow.fromWebContents(evt.sender);
      try {
        await prompt(args.sessionId, args.cwd, args.text, win, args.images, args.sessionPath);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      }
    },
  );

  // 中断某会话。
  ipcMain.handle("agent:abort", async (_evt, args: { sessionId: string }) => {
    await abort(args.sessionId);
    return { ok: true };
  });

  // 关闭某会话。
  ipcMain.handle("agent:dispose", (_evt, args: { sessionId: string }) => {
    disposeSession(args.sessionId);
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

  // 读取会话历史消息(从会话文件)。
  ipcMain.handle("agent:getMessages", async (_evt, args: { sessionPath: string }) => {
    try {
      return { ok: true, messages: await getMessages(args.sessionPath) };
    } catch (err) {
      return { ok: false, error: (err as Error).message, messages: [] };
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
  ipcMain.handle("agent:setModel", async (_evt, args: { sessionId: string; providerId: string; modelId: string }) => {
    try {
      await setModel(args.sessionId, args.providerId, args.modelId);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  // 设置某会话的思考等级。
  ipcMain.handle("agent:setThinkingLevel", async (_evt, args: { sessionId: string; level: string }) => {
    try {
      await setThinkingLevel(args.sessionId, args.level);
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
