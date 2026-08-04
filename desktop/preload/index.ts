/**
 * 真实应用 preload:通过 contextBridge 暴露 agent API 给渲染进程。
 * 替换 electron/preload.ts(原占位)。
 */
import { contextBridge, ipcRenderer } from "electron";

/** 事件监听器类型。 */
type AgentEventListener = (event: unknown) => void;

const dataApi = {
  listProjects: () => ipcRenderer.invoke("data:listProjects"),
  saveProjects: (projects: unknown[]) => ipcRenderer.invoke("data:saveProjects", { projects }),
  openProject: () => ipcRenderer.invoke("data:openProject"),
  selectFiles: () => ipcRenderer.invoke("data:selectFiles"),
  readModels: () => ipcRenderer.invoke("data:readModels"),
  writeModels: (config: unknown) => ipcRenderer.invoke("data:writeModels", { config }),
  readSettings: () => ipcRenderer.invoke("data:readSettings"),
  writeSettings: (settings: unknown) => ipcRenderer.invoke("data:writeSettings", { settings }),
  readUseCases: () => ipcRenderer.invoke("data:readUseCases"),
  writeUseCases: (cases: unknown[]) => ipcRenderer.invoke("data:writeUseCases", { cases }),
  readArchived: () => ipcRenderer.invoke("data:readArchived"),
  writeArchived: (ids: string[]) => ipcRenderer.invoke("data:writeArchived", { ids }),
  fetchModels: (baseUrl: string, apiKey: string, api: string) =>
    ipcRenderer.invoke("data:fetchModels", { baseUrl, apiKey, api }),
};

const agentApi = {
  /** 发送 prompt,返回 {ok, error?}。事件流通过 onEvent 推送。 */
  prompt: (sessionId: string, cwd: string, text: string, images?: { path: string }[]) =>
    ipcRenderer.invoke("agent:prompt", { sessionId, cwd, text, images }),

  /** 中断某会话。 */
  abort: (sessionId: string) => ipcRenderer.invoke("agent:abort", { sessionId }),

  /** 关闭会话。 */
  dispose: (sessionId: string) => ipcRenderer.invoke("agent:dispose", { sessionId }),

  /** 列出真实 providers + models。 */
  listProviders: () => ipcRenderer.invoke("agent:listProviders"),

  /** 列出某工作目录的已有会话。 */
  listSessions: (cwd: string) => ipcRenderer.invoke("agent:listSessions", { cwd }),

  /** 读取会话历史消息。 */
  getMessages: (sessionPath: string) => ipcRenderer.invoke("agent:getMessages", { sessionPath }),

  /** 创建新持久化会话。 */
  createSession: (cwd: string, name?: string) =>
    ipcRenderer.invoke("agent:createSession", { cwd, name }),

  /** 设置某会话的模型。 */
  setModel: (sessionId: string, providerId: string, modelId: string) =>
    ipcRenderer.invoke("agent:setModel", { sessionId, providerId, modelId }),

  /** 设置某会话的思考等级。 */
  setThinkingLevel: (sessionId: string, level: string) =>
    ipcRenderer.invoke("agent:setThinkingLevel", { sessionId, level }),

  /** 订阅某会话的事件流(按 sessionId 隔离),返回取消订阅函数。 */
  onEvent: (sessionId: string, listener: AgentEventListener) => {
    const channel = `agent:event:${sessionId}`;
    const handler = (_e: unknown, event: unknown) => listener(event);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.off(channel, handler);
  },
};;

const winApi = {
  minimize: () => ipcRenderer.invoke("win:minimize"),
  maximize: () => ipcRenderer.invoke("win:maximize"),
  close: () => ipcRenderer.invoke("win:close"),
  isMaximized: () => ipcRenderer.invoke("win:isMaximized"),
  onMaximizedChange: (cb: (maximized: boolean) => void) => {
    const listener = (_e: unknown, m: boolean) => cb(m);
    ipcRenderer.on("win:maximized", listener);
    return () => ipcRenderer.off("win:maximized", listener);
  },
};

contextBridge.exposeInMainWorld("lxcode", {
  version: "0.1.0",
  platform: process.platform,
  agent: agentApi,
  data: dataApi,
  win: winApi,
});
