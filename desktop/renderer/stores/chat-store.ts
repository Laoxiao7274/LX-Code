import { create } from "zustand";
import type { AgentEventListener } from "../types";

/** 消息段:与设计原型一致的结构,对接真实 agent 事件。 */
export type ToolStatus = "running" | "ok" | "error";

export interface ToolCallPart {
  type: "tool";
  id: string;
  name: string;
  arg: string;
  output?: string[];
  status: ToolStatus;
  timing?: string;
}

export interface ThinkingPart {
  type: "thinking";
  id: string;
  text: string;
  streaming?: boolean;
}

export interface TextPart {
  type: "text";
  id: string;
  text: string;
  streaming?: boolean;
}

export interface ImagePart {
  type: "image";
  id: string;
  data: string;
  mimeType: string;
}

export type MessagePart = ThinkingPart | ToolCallPart | TextPart | ImagePart;

/** 消息附件:文件或图片。 */
export interface Attachment {
  id: string;
  kind: "image" | "file";
  name: string;
  url?: string;
  size?: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  text?: string;
  parts?: MessagePart[];
  /** 消息携带的附件(图片/文件)。 */
  attachments?: Attachment[];
  streaming?: boolean;
}

interface ChatState {
  /** 按会话 id 存消息。 */
  messagesBySession: Record<string, Message[]>;
  input: string;
  isGenerating: boolean;
  /** 输入区待发送的附件(图片/文件)。 */
  pendingAttachments: Attachment[];

  setInput: (t: string) => void;
  /** 新增一条待发送附件。 */
  addAttachment: (a: Attachment) => void;
  /** 移除一条待发送附件。 */
  removeAttachment: (id: string) => void;
  /** 发送消息(调真实 agent)。 */
  send: (sessionId: string, cwd: string) => Promise<void>;
  /** 加载会话历史消息(从会话文件)。 */
  loadHistory: (sessionId: string, sessionPath: string) => Promise<void>;
  /** 中断。 */
  abort: (sessionId: string) => Promise<void>;
  clear: (sessionId: string) => void;
}

let seed = 0;
const nid = () => `m${++seed}`;

/** 全局事件取消订阅。 */
let unsubEvent: (() => void) | null = null;

/** 当前正在接收事件的会话 id + 消息 id(用于把事件归位)。 */
let activeStream: { sessionId: string; msgId: string } | null = null;

export const useChatStore = create<ChatState>((set, get) => ({
  messagesBySession: {},
  input: "",
  isGenerating: false,
  pendingAttachments: [],

  setInput: (t) => set({ input: t }),

  addAttachment: (a) => set((s) => ({ pendingAttachments: [...s.pendingAttachments, a] })),
  removeAttachment: (id) =>
    set((s) => ({ pendingAttachments: s.pendingAttachments.filter((a) => a.id !== id) })),

  send: async (sessionId, cwd) => {
    const { input, isGenerating, pendingAttachments } = get();
    if ((!input.trim() && pendingAttachments.length === 0) || isGenerating) return;

    const userMsg: Message = {
      id: nid(),
      role: "user",
      text: input.trim() || undefined,
      attachments: pendingAttachments.length ? pendingAttachments : undefined,
    };
    const assistantId = nid();
    const assistantMsg: Message = {
      id: assistantId,
      role: "assistant",
      streaming: true,
      parts: [],
    };

    set((s) => ({
      input: "",
      pendingAttachments: [],
      isGenerating: true,
      messagesBySession: {
        ...s.messagesBySession,
        [sessionId]: [
          ...(s.messagesBySession[sessionId] ?? []),
          userMsg,
          assistantMsg,
        ],
      },
    }));

    activeStream = { sessionId, msgId: assistantId };

    // 订阅事件流(首次)
    if (!unsubEvent && window.lxcode?.agent) {
      unsubEvent = window.lxcode.agent.onEvent((event) => {
        handleAgentEvent(event as AgentEvent, set, get);
      });
    }

    try {
      await window.lxcode?.agent?.prompt(sessionId, cwd, userMsg.text!);
    } catch (e) {
      console.error("agent prompt 失败", e);
    }
  },

  abort: async (sessionId) => {
    try {
      await window.lxcode?.agent?.abort(sessionId);
    } finally {
      set({ isGenerating: false });
      activeStream = null;
    }
  },

  loadHistory: async (sessionId, sessionPath) => {
    // 已加载过则不重复加载
    if (get().messagesBySession[sessionId]?.length) return;
    if (typeof window === "undefined" || !window.lxcode?.agent) return;
    try {
      const res = await window.lxcode.agent.getMessages(sessionPath);
      if (!res.ok) return;
      const msgs = res.messages as { id: string; role: "user" | "assistant"; text?: string; parts?: MessagePart[] }[];
      const history: Message[] = msgs.map((m) => ({
        id: m.id,
        role: m.role,
        text: m.text,
        parts: m.parts ?? undefined,
      }));
      set((s) => ({ messagesBySession: { ...s.messagesBySession, [sessionId]: history } }));
    } catch {
      // 静默
    }
  },

  clear: (sessionId) =>
    set((s) => ({
      messagesBySession: { ...s.messagesBySession, [sessionId]: [] },
    })),
}));

/** 真实 agent 事件类型(与 desktop/main 的 serializeEvent 对应)。 */
type AgentEvent = {
  type: string;
  assistantMessageEvent?: {
    type: string;
    delta?: string;
    content?: string;
    reason?: string;
    data?: string;
    mimeType?: string;
    toolCall?: { id?: string; name?: string; arguments?: unknown };
  };
  toolCallId?: string;
  toolName?: string;
  args?: unknown;
  result?: unknown;
  partialResult?: unknown;
  isError?: boolean;
  level?: string;
  id?: string;
  delta?: string;
};

/** 把事件应用到当前活跃流的 assistant 消息。 */
function handleAgentEvent(
  event: AgentEvent,
  set: (fn: (s: ChatState) => Partial<ChatState>) => void,
  get: () => ChatState,
) {
  if (!activeStream) return;
  const { sessionId, msgId } = activeStream;
  const msgs = get().messagesBySession[sessionId] ?? [];

  const updateAssistant = (patch: (m: Message) => Message) =>
    set((s) => ({
      messagesBySession: {
        ...s.messagesBySession,
        [sessionId]: (s.messagesBySession[sessionId] ?? []).map((m) =>
          m.id === msgId ? patch(m) : m,
        ),
      },
    }));

  switch (event.type) {
    case "message_update": {
      const ae = event.assistantMessageEvent;
      if (!ae) break;
      if (ae.type === "text_start") {
        // 新文本块开始:结束上个 thinking part(若有),准备接收 text_delta
        updateAssistant((m) => ({
          ...m,
          parts: (m.parts ?? []).map((p) =>
            p.type === "thinking" && "streaming" in p && p.streaming ? { ...p, streaming: false } : p,
          ),
        }));
      } else if (ae.type === "text_delta") {
        updateAssistant((m) => ({
          ...m,
          parts: appendText(m, ae.delta ?? "", "text"),
        }));
      } else if (ae.type === "text_end") {
        // 文本块结束:标记当前 text part 不再 streaming
        updateAssistant((m) => ({
          ...m,
          parts: (m.parts ?? []).map((p) =>
            p.type === "text" && "streaming" in p && p.streaming ? { ...p, streaming: false } : p,
          ),
        }));
      } else if (ae.type === "thinking_delta") {
        updateAssistant((m) => ({
          ...m,
          parts: appendText(m, ae.delta ?? "", "thinking"),
        }));
      } else if (ae.type === "thinking_start") {
        updateAssistant((m) => ({
          ...m,
          parts: [
            ...(m.parts ?? []),
            { type: "thinking", id: nid(), text: "", streaming: true },
          ],
        }));
      } else if (ae.type === "thinking_end") {
        updateAssistant((m) => ({
          ...m,
          parts: (m.parts ?? []).map((p) =>
            p.type === "thinking" && "streaming" in p && p.streaming ? { ...p, streaming: false } : p,
          ),
        }));
      } else if (ae.type === "toolcall_start") {
        // 工具调用开始(参数流式):占位 tool part,等待 toolcall_delta 填参数
        updateAssistant((m) => ({
          ...m,
          parts: [
            ...(m.parts ?? []),
            { type: "tool", id: nid(), name: "", arg: "", status: "running" as ToolStatus },
          ],
        }));
      } else if (ae.type === "toolcall_delta") {
        // 工具调用参数流式:追加到末尾 tool part 的 arg
        updateAssistant((m) => ({
          ...m,
          parts: (m.parts ?? []).map((p, i) =>
            p.type === "tool" && i === (m.parts ?? []).length - 1
              ? { ...p, arg: (p.arg ?? "") + (ae.delta ?? "") }
              : p,
          ),
        }));
      } else if (ae.type === "toolcall_end") {
        // 工具调用结束:用完整 toolCall 填补 name/arg/id(后续 tool_execution 用同 id)
        const tc = ae.toolCall;
        updateAssistant((m) => {
          const parts = m.parts ?? [];
          // 找最后一个 running 且 name 空的占位 tool part(来自 toolcall_start)
          const idx = [...parts].reverse().findIndex((p) => p.type === "tool" && p.status === "running" && !p.name);
          if (idx === -1) return m;
          const realIdx = parts.length - 1 - idx;
          const tp = parts[realIdx];
          if (tp.type !== "tool") return m;
          return { ...m, parts: [...parts.slice(0, realIdx), { ...tp, id: tc?.id ?? tp.id, name: tc?.name ?? tp.name, arg: summarizeArgs(tc?.arguments) ?? tp.arg }, ...parts.slice(realIdx + 1)] };
        });
      } else if (ae.type === "image") {
        // 图片输出(多模态)
        updateAssistant((m) => ({
          ...m,
          parts: [
            ...(m.parts ?? []),
            { type: "image", id: nid(), data: ae.data ?? "", mimeType: ae.mimeType ?? "image/png" },
          ],
        }));
      } else if (ae.type === "error") {
        // 错误事件:标记错误状态,停止生成
        updateAssistant((m) => ({
          ...m,
          streaming: false,
          parts: (m.parts ?? []).map((p) =>
            "streaming" in p && p.streaming ? { ...p, streaming: false } : p,
          ),
        }));
        set(() => ({ isGenerating: false }));
        activeStream = null;
      } else if (ae.type === "done") {
        // 消息完成:结束当前 streaming part
        updateAssistant((m) => ({
          ...m,
          parts: (m.parts ?? []).map((p) =>
            "streaming" in p && p.streaming ? { ...p, streaming: false } : p,
          ),
        }));
      }
      break;
    }
    case "tool_execution_start": {
      // 已有同 id 的占位 tool part(toolcall_end 建的)则复用更新,否则新建
      const existId = event.toolCallId;
      updateAssistant((m) => {
        const parts = m.parts ?? [];
        const idx = parts.findIndex((p) => p.type === "tool" && p.id === existId);
        if (idx !== -1) {
          const tp = parts[idx];
          if (tp.type === "tool") {
            return { ...m, parts: [...parts.slice(0, idx), { ...tp, name: event.toolName ?? tp.name, arg: summarizeArgs(event.args) ?? tp.arg, status: "running" as ToolStatus }, ...parts.slice(idx + 1)] };
          }
        }
        return { ...m, parts: [...parts, { type: "tool" as const, id: existId ?? nid(), name: event.toolName ?? "tool", arg: summarizeArgs(event.args), status: "running" as ToolStatus }] };
      });
      break;
    }
    case "tool_execution_end": {
      updateAssistant((m) => ({
        ...m,
        parts: (m.parts ?? []).map((p) =>
          p.type === "tool" && p.id === event.toolCallId
            ? {
                ...p,
                status: event.isError ? "error" : "ok",
                output: summarizeResult(event.result),
              }
            : p,
        ),
      }));
      break;
    }
    case "tool_execution_update": {
      // 工具执行进度(bash 实时输出等):追加到对应 tool part 的 output
      updateAssistant((m) => ({
        ...m,
        parts: (m.parts ?? []).map((p) =>
          p.type === "tool" && p.id === event.toolCallId
            ? { ...p, output: [...(p.output ?? []), String(event.partialResult ?? "")] }
            : p,
        ),
      }));
      break;
    }
    case "bash_execution_update": {
      // bash 命令实时输出:追加到最近 running tool part
      const delta = event.delta ?? "";
      if (!delta) break;
      updateAssistant((m) => {
        const parts = m.parts ?? [];
        // 找最后一个 running 的 tool part
        const idx = [...parts].reverse().findIndex((p) => p.type === "tool" && p.status === "running");
        if (idx === -1) return m;
        const realIdx = parts.length - 1 - idx;
        const tp = parts[realIdx];
        if (tp.type !== "tool") return m;
        return { ...m, parts: [...parts.slice(0, realIdx), { ...tp, output: [...(tp.output ?? []), delta] }, ...parts.slice(realIdx + 1)] };
      });
      break;
    }
    case "turn_start": {
      // 一轮开始:确保 assistant 消息 streaming 状态
      updateAssistant((m) => ({ ...m, streaming: true }));
      break;
    }
    case "agent_start":
    case "agent_end":
    case "agent_settled": {
      // agent 真正结束:停止生成 + 清 activeStream + 结束所有 part
      updateAssistant((m) => ({
        ...m,
        streaming: false,
        parts: (m.parts ?? []).map((p) => {
          if ("streaming" in p && p.streaming) return { ...p, streaming: false };
          if (p.type === "tool" && p.status === "running") return { ...p, status: "ok" as ToolStatus };
          return p;
        }),
      }));
      set(() => ({ isGenerating: false }));
      activeStream = null;
      break;
    }
    case "thinking_level_changed": {
      // 思考等级变化(由工具或系统触发):记录但不影响 UI part
      break;
    }
    case "compaction_start":
    case "compaction_end":
    case "auto_retry_start":
    case "auto_retry_end":
    case "session_info_changed":
    case "entry_appended":
    case "queue_update":
      // 内部状态事件,UI 忽略
      break;
    case "message_end": {
      // 单条消息结束(思考或回复):结束当前 streaming part
      updateAssistant((m) => ({
        ...m,
        parts: (m.parts ?? []).map((p) =>
          (p.type === "thinking" || p.type === "text") && p.streaming
            ? { ...p, streaming: false }
            : p,
        ),
      }));
      break;
    }
    case "turn_end": {
      // 一轮结束(agent 可能继续下一轮工具调用):只结束当前 streaming part
      // 不清 activeStream/不置 isGenerating=false,等 agent_end/agent_settled 才真正结束
      updateAssistant((m) => ({
        ...m,
        parts: (m.parts ?? []).map((p) => {
          if ((p.type === "thinking" || p.type === "text") && p.streaming) return { ...p, streaming: false };
          return p;
        }),
      }));
      break;
    }
    default:
      break;
  }
}

/** 追加文本到末尾的 text/thinking part(合并连续 delta)。 */
function appendText(m: Message, delta: string, kind: "text" | "thinking"): MessagePart[] {
  const parts = m.parts ?? [];
  const last = parts[parts.length - 1];
  if (last && last.type === kind && last.streaming) {
    return [...parts.slice(0, -1), { ...last, text: last.text + delta }];
  }
  return [
    ...parts,
    { type: kind, id: nid(), text: delta, streaming: true } as MessagePart,
  ];
}

/** 工具参数摘要(取主要字段)。 */
function summarizeArgs(args: unknown): string {
  if (!args || typeof args !== "object") return "";
  const a = args as Record<string, unknown>;
  return String(a.command ?? a.path ?? a.pattern ?? a.file_path ?? "");
}

/** 工具结果摘要(转字符串行)。 */
function summarizeResult(result: unknown): string[] | undefined {
  if (result == null) return undefined;
  if (typeof result === "string") return result.split("\n").slice(0, 50);
  if (Array.isArray(result)) return result.slice(0, 50).map(String);
  try {
    return JSON.stringify(result, null, 2).split("\n").slice(0, 50);
  } catch {
    return [String(result)];
  }
}
