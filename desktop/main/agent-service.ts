/**
 * Agent 服务:封装 pi-coding-agent SDK,管理会话生命周期 + 事件流。
 *
 * pi-coding-agent 是 ESM-only,用动态 import() 加载。
 */
import type {
  AgentSession,
  AgentSessionEvent,
} from "@earendil-works/pi-coding-agent";
import { app } from "electron";
import path from "node:path";

type ModelRuntimeType = {
  getProviders: () => readonly { id: string; name?: string }[];
  getModels: (providerId?: string) => readonly { id: string; name?: string; provider?: string; reasoning?: boolean }[];
  getProvider: (id: string) => unknown;
};

type SessionInfoType = {
  path: string;
  id: string;
  cwd: string;
  name?: string;
};

// 动态加载的模块类型
interface PiModule {
  createAgentSession: typeof import("@earendil-works/pi-coding-agent").createAgentSession;
  ModelRuntime: typeof import("@earendil-works/pi-coding-agent").ModelRuntime;
  SessionManager: typeof import("@earendil-works/pi-coding-agent").SessionManager;
}

let piPromise: Promise<PiModule> | null = null;
async function loadPi(): Promise<PiModule> {
  if (!piPromise) {
    piPromise = import("@earendil-works/pi-coding-agent");
  }
  return piPromise;
}

/** 一个工作目录对应一个 agent 会话。 */
interface SessionEntry {
  session: AgentSession;
  unsubscribe: () => void;
}

const sessions = new Map<string, SessionEntry>();

/** 共享的 model runtime(读 LXCode 自己的 ~/.lxcode/ 数据,非 pi 的)。 */
let sharedModelRuntime: ModelRuntimeType | null = null;

async function getModelRuntime() {
  if (!sharedModelRuntime) {
    const { ModelRuntime } = await loadPi();
    const lxcodeDir = path.join(app.getPath("home"), ".lxcode");
    sharedModelRuntime = (await ModelRuntime.create({
      authPath: path.join(lxcodeDir, "auth.json"),
      modelsPath: path.join(lxcodeDir, "models.json"),
    } as never)) as unknown as ModelRuntimeType;
  }
  return sharedModelRuntime;
}

/** 事件转为可 IPC 序列化的 plain object(去掉函数/类实例)。 */
function serializeEvent(event: AgentSessionEvent): unknown {
  // 大部分事件已是 plain 结构,只挑需要的字段,避免循环引用/大对象
  switch (event.type) {
    case "message_start":
    case "message_end":
      return { type: event.type };
    case "message_update": {
      const ae = event.assistantMessageEvent;
      return {
        type: "message_update",
        assistantMessageEvent: {
          type: ae.type,
          delta: "delta" in ae ? ae.delta : undefined,
        },
      };
    }
    case "tool_execution_start":
      return {
        type: event.type,
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        args: event.args,
      };
    case "tool_execution_update":
      return {
        type: event.type,
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        partialResult: event.partialResult,
      };
    case "tool_execution_end":
      return {
        type: event.type,
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        isError: event.isError,
        result: event.result,
      };
    case "turn_start":
    case "turn_end":
      return { type: event.type };
    default:
      return { type: (event as { type: string }).type };
  }
}

/** 获取或创建某工作目录的 agent 会话(持久化到磁盘)。 */
export async function getSession(cwd: string, onEvent: (e: unknown) => void) {
  const existing = sessions.get(cwd);
  if (existing) return existing.session;

  const { createAgentSession, SessionManager } = await loadPi();
  const modelRuntime = await getModelRuntime();
  // 持久化会话(写到 ~/.pi/agent/sessions),而非 inMemory
  const { session } = await createAgentSession({
    sessionManager: SessionManager.create(cwd),
    modelRuntime: modelRuntime as never,
    cwd,
  });

  // 用 LXCode 配的默认模型(从 ~/.lxcode/models.json 读)
  try {
    const { readModelsPi } = await import("./data-store");
    const cfg = await readModelsPi();
    if (cfg.defaultModel) {
      const [providerId, modelId] = cfg.defaultModel.split("/");
      if (providerId && modelId) {
        const model = (modelRuntime as { getModels: (id?: string) => readonly { id: string; provider?: string }[] }).getModels(providerId).find((m) => m.id === modelId);
        if (model) await session.setModel(model as never);
      }
    }
  } catch {
    // 静默失败,用 pi 默认模型
  }

  const unsubscribe = session.subscribe((event) => {
    onEvent(serializeEvent(event));
  });

  const entry: SessionEntry = { session, unsubscribe };
  sessions.set(cwd, entry);
  return session;
}

/** 发送 prompt。 */
export async function prompt(cwd: string, text: string, onEvent: (e: unknown) => void) {
  const session = await getSession(cwd, onEvent);
  await session.prompt(text);
}

/** 中断当前会话。 */
export async function abort(cwd: string) {
  const entry = sessions.get(cwd);
  if (entry) await entry.session.abort();
}

/** 关闭某会话(清理)。 */
export function disposeSession(cwd: string) {
  const entry = sessions.get(cwd);
  if (entry) {
    entry.unsubscribe();
    entry.session.dispose();
    sessions.delete(cwd);
  }
}

/** 列出真实 providers + models(来自 ~/.pi/agent/models.json)。 */
export async function listProviders() {
  const rt = await getModelRuntime();
  const providers = rt.getProviders();
  return providers.map((p) => ({
    id: p.id,
    name: p.name ?? p.id,
    models: rt.getModels(p.id).map((m) => ({
      id: m.id,
      name: m.name ?? m.id,
      provider: p.id,
      reasoning: m.reasoning ?? false,
    })),
  }));
}

/** 列出某工作目录的已有会话(来自磁盘)。 */
export async function listSessions(cwd: string): Promise<SessionInfoType[]> {
  const { SessionManager } = await loadPi();
  try {
    return await SessionManager.list(cwd);
  } catch {
    return [];
  }
}

/** 创建新持久化会话(返回 session id + name)。 */
export async function createSession(cwd: string, name?: string) {
  const { createAgentSession, SessionManager } = await loadPi();
  const modelRuntime = await getModelRuntime();
  const { session } = await createAgentSession({
    sessionManager: SessionManager.create(cwd),
    modelRuntime: modelRuntime as never,
    cwd,
  });
  const sid = session.sessionId;
  session.dispose();
  return { id: sid, name: name ?? "新会话", cwd };
}

/** 设置某会话的默认模型。 */
export async function setModel(cwd: string, providerId: string, modelId: string) {
  const entry = sessions.get(cwd);
  if (!entry) return;
  const rt = await getModelRuntime();
  const model = rt.getModels(providerId).find((m) => m.id === modelId) as never;
  if (model) await entry.session.setModel(model);
}

/** 销毁所有会话(应用退出时)。 */
export function disposeAll() {
  for (const cwd of [...sessions.keys()]) disposeSession(cwd);
  sharedModelRuntime = null;
}
