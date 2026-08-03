/** 渲染进程通过 contextBridge 暴露的 LXCode API。 */
export interface LxcodeAPI {
  version: string;
  platform: string;
  agent: {
    prompt: (cwd: string, text: string) => Promise<{ ok: boolean; error?: string }>;
    abort: (cwd: string) => Promise<{ ok: boolean }>;
    dispose: (cwd: string) => Promise<{ ok: boolean }>;
    /** 列出真实 providers + models。 */
    listProviders: () => Promise<{
      ok: boolean;
      error?: string;
      providers: { id: string; name: string; models: { id: string; name: string; provider: string; reasoning: boolean }[] }[];
    }>;
    /** 列出某工作目录的已有会话。 */
    listSessions: (cwd: string) => Promise<{
      ok: boolean;
      error?: string;
      sessions: { path: string; id: string; cwd: string; name?: string }[];
    }>;
    /** 创建新持久化会话。 */
    createSession: (cwd: string, name?: string) => Promise<{ ok: boolean; error?: string; id?: string; name?: string; cwd?: string }>;
    /** 设置某会话的默认模型。 */
    setModel: (cwd: string, providerId: string, modelId: string) => Promise<{ ok: boolean; error?: string }>;
    onEvent: (listener: AgentEventListener) => () => void;
  };
}

export type AgentEventListener = (event: unknown) => void;

declare global {
  interface Window {
    lxcode: LxcodeAPI;
  }
}
