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

export type MessagePart = ThinkingPart | ToolCallPart | TextPart;

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

  clear: (sessionId) =>
    set((s) => ({
      messagesBySession: { ...s.messagesBySession, [sessionId]: [] },
    })),
}));

/** 真实 agent 事件类型(与 desktop/main 的 serializeEvent 对应)。 */
type AgentEvent = {
  type: string;
  assistantMessageEvent?: { type: string; delta?: string };
  toolCallId?: string;
  toolName?: string;
  args?: unknown;
  result?: unknown;
  isError?: boolean;
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
      if (ae.type === "text_delta") {
        updateAssistant((m) => ({
          ...m,
          parts: appendText(m, ae.delta ?? "", "text"),
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
            p.type === "thinking" && p.streaming ? { ...p, streaming: false } : p,
          ),
        }));
      }
      break;
    }
    case "tool_execution_start": {
      updateAssistant((m) => ({
        ...m,
        parts: [
          ...(m.parts ?? []),
          {
            type: "tool",
            id: event.toolCallId ?? nid(),
            name: event.toolName ?? "tool",
            arg: summarizeArgs(event.args),
            status: "running",
          },
        ],
      }));
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
    case "turn_end": {
      updateAssistant((m) => ({
        ...m,
        streaming: false,
        parts: (m.parts ?? []).map((p) =>
          (p.type === "thinking" || p.type === "text") && p.streaming
            ? { ...p, streaming: false }
            : p,
        ),
      }));
      set(() => ({ isGenerating: false }));
      activeStream = null;
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
