/**
 * 真实应用主进程入口:agent 服务 + IPC 桥接。
 * 由 electron/main.ts 加载,在 app ready 后初始化。
 */
import { ipcMain, BrowserWindow } from "electron";
import { prompt, abort, disposeSession, disposeAll } from "./agent-service";

/** 初始化所有 IPC handler。 */
export function initAgentIpc() {
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
}

/** 应用退出时清理所有会话。 */
export function shutdownAgent() {
  disposeAll();
}
