/**
 * 真实应用 preload:通过 contextBridge 暴露 agent API 给渲染进程。
 * 替换 electron/preload.ts(原占位)。
 */
import { contextBridge, ipcRenderer } from "electron";

/** 事件监听器类型。 */
type AgentEventListener = (event: unknown) => void;

const agentApi = {
  /** 发送 prompt,返回 {ok, error?}。事件流通过 onEvent 推送。 */
  prompt: (cwd: string, text: string) =>
    ipcRenderer.invoke("agent:prompt", { cwd, text }),

  /** 中断当前会话。 */
  abort: (cwd: string) => ipcRenderer.invoke("agent:abort", { cwd }),

  /** 关闭会话。 */
  dispose: (cwd: string) => ipcRenderer.invoke("agent:dispose", { cwd }),

  /** 列出真实 providers + models。 */
  listProviders: () => ipcRenderer.invoke("agent:listProviders"),

  /** 列出某工作目录的已有会话。 */
  listSessions: (cwd: string) => ipcRenderer.invoke("agent:listSessions", { cwd }),

  /** 创建新持久化会话。 */
  createSession: (cwd: string, name?: string) =>
    ipcRenderer.invoke("agent:createSession", { cwd, name }),

  /** 设置某会话的默认模型。 */
  setModel: (cwd: string, providerId: string, modelId: string) =>
    ipcRenderer.invoke("agent:setModel", { cwd, providerId, modelId }),

  /** 订阅 agent 事件流,返回取消订阅函数。 */
  onEvent: (listener: AgentEventListener) => {
    const handler = (_e: unknown, event: unknown) => listener(event);
    ipcRenderer.on("agent:event", handler);
    return () => ipcRenderer.off("agent:event", handler);
  },
};;

contextBridge.exposeInMainWorld("lxcode", {
  version: "0.1.0",
  platform: process.platform,
  agent: agentApi,
});
