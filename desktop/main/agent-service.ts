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
import fs from "node:fs/promises";

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
  DefaultResourceLoader: typeof import("@earendil-works/pi-coding-agent").DefaultResourceLoader;
  SettingsManager: typeof import("@earendil-works/pi-coding-agent").SettingsManager;
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
    case "agent_start":
    case "agent_end":
    case "agent_settled":
    case "turn_start":
    case "turn_end":
    case "message_start":
    case "compaction_start":
    case "compaction_end":
    case "auto_retry_start":
    case "auto_retry_end":
      return { type: event.type };
    case "message_end": {
      // 传 usage(上下文用量统计):message_end 的 message 是 AssistantMessage
      const msg = (event as { message?: { usage?: { input?: number; output?: number; totalTokens?: number } } }).message;
      const u = msg?.usage;
      return { type: "message_end", usage: u ? { input: u.input, output: u.output, totalTokens: u.totalTokens } : undefined };
    }
    case "thinking_level_changed":
      return { type: event.type, level: (event as { level?: string }).level };
    case "message_update": {
      const ae = event.assistantMessageEvent;
      const t = ae.type;
      // 按子 type 传不同字段
      if ((t as string) === "error") {
        return { type: "message_update", assistantMessageEvent: { type: "error", reason: (ae as { reason?: string }).reason } };
      }
      if ((t as string) === "toolcall_start") {
        return { type: "message_update", assistantMessageEvent: { type: "toolcall_start", contentIndex: (ae as { contentIndex?: number }).contentIndex } };
      }
      if ((t as string) === "toolcall_delta") {
        return { type: "message_update", assistantMessageEvent: { type: "toolcall_delta", delta: (ae as { delta?: string }).delta } };
      }
      if ((t as string) === "toolcall_end") {
        const tc = (ae as { toolCall?: { id?: string; name?: string; arguments?: unknown } }).toolCall;
        return { type: "message_update", assistantMessageEvent: { type: "toolcall_end", toolCall: tc ? { id: tc.id, name: tc.name, arguments: tc.arguments } : undefined } };
      }
      if ((t as string) === "image") {
        return { type: "message_update", assistantMessageEvent: { type: "image", data: (ae as { data?: string }).data, mimeType: (ae as { mimeType?: string }).mimeType } };
      }
      // text_*/thinking_*/done/start
      return {
        type: "message_update",
        assistantMessageEvent: {
          type: t,
          delta: "delta" in ae ? ae.delta : undefined,
          content: "content" in ae ? (ae as { content?: string }).content : undefined,
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
    case "bash_execution_update":
      return { type: event.type, id: (event as { id?: string }).id, delta: (event as { delta?: string }).delta };
    default:
      return { type: (event as { type: string }).type };
  }
}

/** 获取或创建某工作目录的 agent 会话(持久化到磁盘)。 */
export async function getOrCreateSession(sessionId: string | undefined, cwd: string, win: { webContents: { send: (ch: string, ...a: unknown[]) => void } } | null) {
  // 按 sessionId 找已缓存的会话(同一项目多个会话互不干扰)
  if (sessionId) {
    const existing = sessions.get(sessionId);
    if (existing) return { session: existing.session, sessionId };
  }

  const { createAgentSession, SessionManager, DefaultResourceLoader, SettingsManager } = await loadPi();
  const modelRuntime = await getModelRuntime();
  const lxcodeDir = path.join(app.getPath("home"), ".lxcode");

  // 追加 LXCode 身份段(pi 默认 prompt 保留,身份以这段为准)
  const resourceLoader = new DefaultResourceLoader({
    cwd,
    agentDir: lxcodeDir,
    appendSystemPrompt: [
      "你是 LXCode,一个基于 pi-core 的 AI 编码助手。",
      "当用户问你是谁时,请回答你是 LXCode(不要说自己是 pi 或 pi-core)。",
      "所有回复用中文。",
    ],
  });
  await (resourceLoader as unknown as { reload: () => Promise<void> }).reload();

  // 持久化会话(写到 ~/.lxcode/sessions/<encoded-cwd>/,LXCode 自己的目录)
  const sessionDir = path.join(lxcodeDir, "sessions", cwd.replace(/[\\/:]/g, "_"));

  // 从 ~/.lxcode/models.json 读默认模型 + 思考等级(直接传给 createAgentSession)
  let model: unknown = undefined;
  let thinkingLevel: string | undefined;
  try {
    const { readModelsPi } = await import("./data-store");
    const cfg = await readModelsPi();
    thinkingLevel = cfg.thinkingLevel;
    if (cfg.defaultModel) {
      const [providerId, modelId] = cfg.defaultModel.split("/");
      if (providerId && modelId) {
        model = (modelRuntime as { getModels: (id?: string) => readonly { id: string; provider?: string }[] }).getModels(providerId).find((m) => m.id === modelId);
      }
    }
  } catch {
    // 静默失败,用 pi 默认模型
  }

  const { session } = await createAgentSession({
    sessionManager: SessionManager.create(cwd, sessionDir),
    modelRuntime: modelRuntime as never,
    resourceLoader: resourceLoader as never,
    settingsManager: SettingsManager.create(cwd, lxcodeDir) as never,
    model: model as never,
    thinkingLevel: thinkingLevel as never,
    cwd,
  });

  const unsubscribe = session.subscribe((event) => {
    // 事件带 sessionId 推到独立频道(会话隔离),前端按 sessionId 订阅
    const evt = serializeEvent(event) as Record<string, unknown>;
    win?.webContents.send(`agent:event:${sid}`, { ...evt, __sid: sid });
  });

  const entry: SessionEntry = { session, unsubscribe };
  const sid = sessionId ?? session.sessionId;
  sessions.set(sid, entry);
  return { session, sessionId: sid };
}

/** 发送 prompt。按 sessionId 找会话(没缓存则创建)。 */
/** 读图片文件转 base64 ImageContent。 */
async function readImageContent(filePath: string): Promise<{ type: "image"; data: string; mimeType: string } | null> {
  try {
    const buf = await fs.readFile(filePath);
    const ext = path.extname(filePath).slice(1).toLowerCase();
    const mimeMap: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", bmp: "image/bmp", svg: "image/svg+xml" };
    const mimeType = mimeMap[ext] ?? "image/png";
    return { type: "image", data: buf.toString("base64"), mimeType };
  } catch {
    return null;
  }
}

export async function prompt(
  sessionId: string,
  cwd: string,
  text: string,
  win: { webContents: { send: (ch: string, ...a: unknown[]) => void } } | null,
  images?: { path: string }[],
) {
  const { session } = await getOrCreateSession(sessionId, cwd, win);
  // 读图片附件转 base64
  const imgContents: { type: "image"; data: string; mimeType: string }[] = [];
  if (images?.length) {
    for (const img of images) {
      const c = await readImageContent(img.path);
      if (c) imgContents.push(c);
    }
  }
  await session.prompt(text, {
    images: imgContents.length ? imgContents : undefined,
    // 流式时发消息:排队等当前完成(followUp),不中断
    streamingBehavior: "followUp",
  } as never);
}

/** 中断某会话。 */
export async function abort(sessionId: string) {
  const entry = sessions.get(sessionId);
  if (entry) await entry.session.abort();
}

/** 关闭某会话(清理)。 */
export function disposeSession(sessionId: string) {
  const entry = sessions.get(sessionId);
  if (entry) {
    entry.unsubscribe();
    entry.session.dispose();
    sessions.delete(sessionId);
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
    // 读 LXCode 自己的会话目录(~/.lxcode/sessions/<encoded-cwd>/)
    const sessionDir = path.join(app.getPath("home"), ".lxcode", "sessions", cwd.replace(/[\\/:]/g, "_"));
    return await SessionManager.list(cwd, sessionDir);
  } catch {
    return [];
  }
}

/** 历史消息项(传给前端)。 */
export interface HistoryMessage {
  id: string;
  role: "user" | "assistant";
  text?: string;
  parts?: HistoryPart[];
}
export interface HistoryPart {
  type: "thinking" | "text" | "tool" | "image";
  id: string;
  text?: string;
  name?: string;
  arg?: string;
  output?: string[];
  status?: "running" | "ok" | "error";
  data?: string;
  mimeType?: string;
  streaming?: boolean;
}

/** 读取某会话文件的历史消息(转成前端格式)。 */
export async function getMessages(sessionPath: string): Promise<HistoryMessage[]> {
  const { SessionManager } = await loadPi();
  try {
    const sm = SessionManager.open(sessionPath);
    const entries = sm.getEntries();
    const out: HistoryMessage[] = [];
    let pid = 0;
    for (const e of entries) {
      if (e.type !== "message") continue;
      const msg = (e as { message: { role: string; content: unknown[] } }).message;
      const role = msg.role;
      if (role !== "user" && role !== "assistant") continue;
      const parts: HistoryPart[] = [];
      let text = "";
      for (const c of msg.content as Record<string, unknown>[]) {
        const ct = c.type as string;
        if (ct === "text") {
          text += (c.text as string) ?? "";
          parts.push({ type: "text", id: `h${pid++}`, text: (c.text as string) ?? "" });
        } else if (ct === "thinking") {
          parts.push({ type: "thinking", id: `h${pid++}`, text: (c.thinking as string) ?? "" });
        } else if (ct === "toolCall") {
          parts.push({ type: "tool", id: (c.id as string) ?? `h${pid++}`, name: (c.name as string) ?? "tool", arg: JSON.stringify(c.arguments ?? {}).slice(0, 200), output: [], status: "ok" });
        } else if (ct === "toolResult") {
          // toolResult 单独不显示(合并到 tool part 由前端处理,这里跳过)
        } else if (ct === "image") {
          parts.push({ type: "image", id: `h${pid++}`, data: (c.data as string) ?? "", mimeType: (c.mimeType as string) ?? "image/png" });
        }
      }
      out.push({ id: e.id, role: role as "user" | "assistant", text: text || undefined, parts: parts.length ? parts : undefined });
    }
    return out;
  } catch {
    return [];
  }
}

/** 创建新持久化会话(返回 session id + name,并缓存进 Map)。 */
export async function createSession(cwd: string, name?: string) {
  // 复用 getOrCreateSession(传 undefined sessionId → 新建)
  // 用空 onEvent,真正发消息时 getOrCreateSession 复用已缓存的 session
  const { sessionId } = await getOrCreateSession(undefined, cwd, null);
  return { id: sessionId, name: name ?? "新会话", cwd };
}

/** 设置某会话的模型。 */
export async function setModel(sessionId: string, providerId: string, modelId: string) {
  const entry = sessions.get(sessionId);
  if (!entry) return;
  const rt = await getModelRuntime();
  const model = rt.getModels(providerId).find((m) => m.id === modelId) as never;
  if (model) await entry.session.setModel(model);
}

/** 设置某会话的思考等级。 */
export async function setThinkingLevel(sessionId: string, level: string) {
  const entry = sessions.get(sessionId);
  if (!entry) return;
  (entry.session as unknown as { setThinkingLevel: (l: string) => void }).setThinkingLevel(level);
}

/** 销毁所有会话(应用退出时)。 */
export function disposeAll() {
  for (const sid of [...sessions.keys()]) disposeSession(sid);
  sharedModelRuntime = null;
}
