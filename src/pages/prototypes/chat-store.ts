import { create } from "zustand";

/** 对话页原型用的消息状态 —— 让右栏事件能真实操作预览区。 */

/** 工具调用状态。 */
export type ToolStatus = "running" | "ok" | "error";

/** 工具调用段:读取/编辑/执行命令等。 */
export interface ToolCallPart {
  type: "tool";
  id: string;
  /** 工具名,如 read / write / bash / grep */
  name: string;
  /** 主要参数,如文件路径或命令,显示在行头。 */
  arg: string;
  /** 输出行,展开后显示。 */
  output?: string[];
  status: ToolStatus;
  /** 耗时,如 "0.4s"。 */
  timing?: string;
}

/** 思考段:模型推理过程。 */
export interface ThinkingPart {
  type: "thinking";
  id: string;
  text: string;
  /** 是否仍在流式生成。 */
  streaming?: boolean;
}

/** 文本段:普通正文。 */
export interface TextPart {
  type: "text";
  id: string;
  text: string;
  /** 这条文本段是否正在流式生成。 */
  streaming?: boolean;
}

export type MessagePart = ThinkingPart | ToolCallPart | TextPart;

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  /** 纯用户消息只有 text;助手消息用 parts 分段。 */
  text?: string;
  parts?: MessagePart[];
  /** 这条助手消息是否正在流式生成中(用于演示中断) */
  streaming?: boolean;
}

interface ChatState {
  messages: ChatMessage[];
  input: string;
  /** 当前是否正在生成回复(用于演示中断) */
  isGenerating: boolean;

  setInput: (text: string) => void;
  /** 发送当前 input,追加一条用户消息并启动一段模拟的助手回复流(含思考+工具调用) */
  send: () => void;
  /** 中断当前正在生成的回复 */
  abort: () => void;
  /** 重新生成最后一条助手回复 */
  retry: () => void;
  /** 清空所有消息 */
  clear: () => void;
}

let idSeed = 0;
const nextId = () => `m${++idSeed}`;

/** 模拟一段流式助手回复:先思考,再调工具,最后正文。可被 abort 打断。 */
function streamReply(get: () => ChatState, set: (partial: Partial<ChatState>) => void) {
  set({ isGenerating: true });
  const replyId = nextId();
  const thinkId = `t${++idSeed}`;
  const toolId = `tl${++idSeed}`;
  const textId = `x${++idSeed}`;

  // 思考段文本
  const THINK_TEXT =
    "用户让我看这个函数。先理解它的职责:它接收一个数组并做过滤。" +
    "问题在于每次迭代都新建临时数组,有性能开销。" +
    "我会先用 read 工具确认上下文,再给出重构建议。";

  const FINAL_TEXT =
    "这段函数可以优化:用一次 filter 替代多次拼接,减少中间数组分配。";

  // 先占位一条助手消息,带思考段 + 工具段 + 文本段
  const placeholder: ChatMessage = {
    id: replyId,
    role: "assistant",
    streaming: true,
    parts: [
      { type: "thinking", id: thinkId, text: "", streaming: true } satisfies MessagePart,
      { type: "tool", id: toolId, name: "read", arg: "src/utils/filter.ts", status: "running" } satisfies MessagePart,
      { type: "text", id: textId, text: "", streaming: true } satisfies MessagePart,
    ],
  };
  set({ messages: [...get().messages, placeholder] });

  const updatePart = (partId: string, patch: Partial<TextPart> & Partial<ToolCallPart> & Partial<ThinkingPart>) => {
    set({
      messages: get().messages.map((m) =>
        m.id === replyId
          ? { ...m, parts: m.parts?.map((p) => (p.id === partId ? { ...p, ...patch } as MessagePart : p)) }
          : m,
      ),
    });
  };

  // 阶段 1:流式思考(逐字)
  let i = 0;
  const thinkTimer = setInterval(() => {
    if (!get().isGenerating) {
      clearInterval(thinkTimer);
      updatePart(thinkId, { streaming: false });
      return;
    }
    i += 2;
    updatePart(thinkId, { text: THINK_TEXT.slice(0, i) });
    if (i >= THINK_TEXT.length) {
      clearInterval(thinkTimer);
      updatePart(thinkId, { streaming: false });

      // 阶段 2:工具调用(模拟 0.8s 后完成)
      setTimeout(() => {
        if (!get().isGenerating) return;
        updatePart(toolId, {
          status: "ok",
          timing: "0.8s",
          output: [
            "1  export function filter<T>(arr: T[], fn: (x: T) => boolean): T[] {",
            "2    let result: T[] = [];",
            "3    for (const x of arr) {",
            "4      if (fn(x)) result = [...result, x];",
            "5    }",
            "6    return result;",
            "7  }",
          ],
        });

        // 阶段 3:正文流式
        let j = 0;
        const textTimer = setInterval(() => {
          if (!get().isGenerating) {
            clearInterval(textTimer);
            updatePart(textId, { streaming: false });
            set({
              messages: get().messages.map((m) =>
                m.id === replyId ? { ...m, streaming: false } : m,
              ),
            });
            return;
          }
          j += 2;
          updatePart(textId, { text: FINAL_TEXT.slice(0, j) });
          if (j >= FINAL_TEXT.length) {
            clearInterval(textTimer);
            updatePart(textId, { streaming: false });
            set({
              isGenerating: false,
              messages: get().messages.map((m) =>
                m.id === replyId ? { ...m, streaming: false } : m,
              ),
            });
          }
        }, 30);
      }, 800);
    }
  }, 24);
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [
    { id: nextId(), role: "user", text: "帮我看一下这个函数" },
    {
      id: nextId(),
      role: "assistant",
      streaming: false,
      parts: [
        {
          type: "thinking",
          id: `t${++idSeed}`,
          text: "用户让我看这个函数。先理解职责,再看实现,最后给优化建议。",
          streaming: false,
        },
        {
          type: "tool",
          id: `tl${++idSeed}`,
          name: "read",
          arg: "src/utils/filter.ts",
          status: "ok",
          timing: "0.5s",
          output: ["已读取 7 行"],
        },
        {
          type: "text",
          id: `x${++idSeed}`,
          text: "这个函数用 `[...result, x]` 每次迭代都新建数组,改成 push 会更高效。",
          streaming: false,
        },
      ],
    },
  ],
  input: "",
  isGenerating: false,

  setInput: (text) => set({ input: text }),

  send: () => {
    const { input, isGenerating } = get();
    if (!input.trim() || isGenerating) return;
    const userMsg: ChatMessage = { id: nextId(), role: "user", text: input.trim() };
    set({ input: "", messages: [...get().messages, userMsg] });
    streamReply(get, set);
  },

  abort: () => {
    if (!get().isGenerating) return;
    set({ isGenerating: false });
  },

  retry: () => {
    const { messages, isGenerating } = get();
    if (isGenerating) return;
    let trimmed = messages;
    if (trimmed.length && trimmed[trimmed.length - 1].role === "assistant") {
      trimmed = trimmed.slice(0, -1);
    }
    set({ messages: trimmed });
    streamReply(get, set);
  },

  clear: () => set({ messages: [], input: "", isGenerating: false }),
}));
