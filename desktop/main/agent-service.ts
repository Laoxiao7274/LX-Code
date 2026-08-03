/**
 * Agent 服务:封装 pi-coding-agent SDK,管理会话生命周期 + 事件流。
 *
 * pi-coding-agent 是 ESM-only,用动态 import() 加载。
 */
import type {
  AgentSession,
  AgentSessionEvent,
} from "@earendil-works/pi-coding-agent";

type ModelRuntimeType = {
  listModels?: () => unknown[];
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

/** 共享的 model runtime(读 ~/.pi/agent 的 auth/models)。 */
let sharedModelRuntime: ModelRuntimeType | null = null;

async function getModelRuntime() {
  if (!sharedModelRuntime) {
    const { ModelRuntime } = await loadPi();
    sharedModelRuntime = (await ModelRuntime.create()) as unknown as ModelRuntimeType;
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

/** 获取或创建某工作目录的 agent 会话。 */
export async function getSession(cwd: string, onEvent: (e: unknown) => void) {
  const existing = sessions.get(cwd);
  if (existing) return existing.session;

  const { createAgentSession, SessionManager } = await loadPi();
  const modelRuntime = await getModelRuntime();
  const { session } = await createAgentSession({
    sessionManager: SessionManager.inMemory(),
    modelRuntime: modelRuntime as never,
    cwd,
  });

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

/** 列出可用模型(供前端模型选择)。 */
export async function listModels() {
  const rt = await getModelRuntime();
  return { current: rt };
}

/** 销毁所有会话(应用退出时)。 */
export function disposeAll() {
  for (const cwd of [...sessions.keys()]) disposeSession(cwd);
  sharedModelRuntime = null;
}
