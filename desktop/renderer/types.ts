/** 渲染进程通过 contextBridge 暴露的 LXCode API。 */
export interface LxcodeAPI {
  version: string;
  platform: string;
  agent: {
    prompt: (cwd: string, text: string) => Promise<{ ok: boolean; error?: string }>;
    abort: (cwd: string) => Promise<{ ok: boolean }>;
    dispose: (cwd: string) => Promise<{ ok: boolean }>;
    onEvent: (listener: AgentEventListener) => () => void;
  };
}

export type AgentEventListener = (event: unknown) => void;

declare global {
  interface Window {
    lxcode: LxcodeAPI;
  }
}
