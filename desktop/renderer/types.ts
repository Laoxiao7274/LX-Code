/** 渲染进程通过 contextBridge 暴露的 LXCode API。 */
export interface LxcodeAPI {
  version: string;
  platform: string;
  agent: {
    prompt: (cwd: string, text: string) => Promise<{ ok: boolean; error?: string }>;
    abort: (cwd: string) => Promise<{ ok: boolean }>;
    dispose: (cwd: string) => Promise<{ ok: boolean }>;
    listProviders: () => Promise<{ ok: boolean; error?: string; providers: unknown[] }>;
    listSessions: (cwd: string) => Promise<{ ok: boolean; error?: string; sessions: unknown[] }>;
    createSession: (cwd: string, name?: string) => Promise<{ ok: boolean; error?: string; id?: string; name?: string; cwd?: string }>;
    setModel: (cwd: string, providerId: string, modelId: string) => Promise<{ ok: boolean; error?: string }>;
    onEvent: (listener: AgentEventListener) => () => void;
  };
  data: {
    listProjects: () => Promise<{ ok: boolean; projects: unknown[] }>;
    saveProjects: (projects: unknown[]) => Promise<{ ok: boolean }>;
    openProject: () => Promise<{ ok: boolean; name?: string; path?: string }>;
    readModels: () => Promise<{ ok: boolean; config: unknown }>;
    writeModels: (config: unknown) => Promise<{ ok: boolean }>;
    readSettings: () => Promise<{ ok: boolean; settings: unknown }>;
    writeSettings: (settings: unknown) => Promise<{ ok: boolean }>;
    readUseCases: () => Promise<{ ok: boolean; cases: unknown[] }>;
    writeUseCases: (cases: unknown[]) => Promise<{ ok: boolean }>;
    fetchModels: (baseUrl: string, apiKey: string, api: string) => Promise<{ ok: boolean; models?: { id: string; name: string }[]; error?: string }>;
  };
}

export type AgentEventListener = (event: unknown) => void;

declare global {
  interface Window {
    lxcode: LxcodeAPI;
  }
}
