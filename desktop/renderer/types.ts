/** 渲染进程通过 contextBridge 暴露的 LXCode API。 */
export interface LxcodeAPI {
  version: string;
  platform: string;
  agent: {
    prompt: (sessionId: string, cwd: string, text: string, images?: { path: string }[], sessionPath?: string) => Promise<{ ok: boolean; error?: string }>;
    abort: (sessionId: string) => Promise<{ ok: boolean }>;
    dispose: (sessionId: string) => Promise<{ ok: boolean }>;
    listProviders: () => Promise<{ ok: boolean; error?: string; providers: unknown[] }>;
    listSessions: (cwd: string) => Promise<{ ok: boolean; error?: string; sessions: unknown[] }>;
    getMessages: (sessionPath: string) => Promise<{ ok: boolean; error?: string; messages: unknown[] }>;
    createSession: (cwd: string, name?: string) => Promise<{ ok: boolean; error?: string; id?: string; name?: string; cwd?: string; path?: string }>;
    setModel: (sessionId: string, providerId: string, modelId: string) => Promise<{ ok: boolean; error?: string }>;
    setThinkingLevel: (sessionId: string, level: string) => Promise<{ ok: boolean; error?: string }>;
    onEvent: (sessionId: string, listener: AgentEventListener) => () => void;
  };
  data: {
    listProjects: () => Promise<{ ok: boolean; projects: unknown[] }>;
    saveProjects: (projects: unknown[]) => Promise<{ ok: boolean }>;
    openProject: () => Promise<{ ok: boolean; name?: string; path?: string }>;
    selectFiles: () => Promise<{ ok: boolean; files?: { path: string; name: string; kind: "image" | "file" }[] }>;
    readModels: () => Promise<{ ok: boolean; config: unknown }>;
    writeModels: (config: unknown) => Promise<{ ok: boolean }>;
    readSettings: () => Promise<{ ok: boolean; settings: unknown }>;
    writeSettings: (settings: unknown) => Promise<{ ok: boolean }>;
    readUseCases: () => Promise<{ ok: boolean; cases: unknown[] }>;
    writeUseCases: (cases: unknown[]) => Promise<{ ok: boolean }>;
    readArchived: () => Promise<{ ok: boolean; ids: string[] }>;
    writeArchived: (ids: string[]) => Promise<{ ok: boolean }>;
    fetchModels: (baseUrl: string, apiKey: string, api: string) => Promise<{ ok: boolean; models?: { id: string; name: string }[]; error?: string }>;
    getDigest: (cwd: string) => Promise<{ ok: boolean; digest?: DigestFile; error?: string }>;
    getDigestConfig: (cwd: string) => Promise<{ ok: boolean; config: DigestConfig }>;
    setDigestConfig: (cwd: string, config: Partial<DigestConfig>) => Promise<{ ok: boolean }>;
    refreshDigest: (cwd: string) => Promise<{ ok: boolean; modules?: number; functions?: number; error?: string }>;
  };
  win: {
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    close: () => Promise<void>;
    isMaximized: () => Promise<boolean>;
    onMaximizedChange: (cb: (maximized: boolean) => void) => () => void;
  };
}

export type AgentEventListener = (event: unknown) => void;

/** digest 配置(开关)。 */
export interface DigestConfig {
  enabled: boolean;
  autoUpdate: boolean;
  injectContext: boolean;
}

/** digest.json 结构(与扩展 schema 对齐,前端只读)。 */
export interface DigestFile {
  version: 1;
  generatedAt: string;
  trigger: "onboarding" | "incremental";
  cwd: string;
  modules: { name: string; path: string; what: string; files: string[]; related: string[] }[];
  functions: Record<string, FunctionSummary[]>;
  provider: { name: string; version: string };
}
export interface FunctionSummary {
  file: string;
  fn: string;
  startLine: number;
  endLine: number;
  level: "core" | "util" | "ui" | "glue";
  what: string;
  how: string[];
  logic?: string[];
  pitfalls?: string[];
  calls?: { calls: string[]; calledBy: string[]; source: string };
  deps?: string[];
  entry?: boolean;
  blocks?: { lines: [number, number]; what: string }[];
}

declare global {
  interface Window {
    lxcode: LxcodeAPI;
  }
}
