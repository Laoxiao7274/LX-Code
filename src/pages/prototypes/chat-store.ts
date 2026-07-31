import { create } from "zustand";

/** 对话页原型用的消息状态 —— 让右栏事件能真实操作预览区。 */

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  /** 这条助手消息是否正在流式生成中(用于演示中断) */
  streaming?: boolean;
}

interface ChatState {
  messages: ChatMessage[];
  input: string;
  /** 当前是否正在生成回复(用于演示中断) */
  isGenerating: boolean;

  setInput: (text: string) => void;
  /** 发送当前 input,追加一条用户消息并启动一段模拟的助手回复流 */
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

/** 模拟一段流式助手回复:逐字追加,可被 abort 打断。 */
function streamReply(
  get: () => ChatState,
  set: (partial: Partial<ChatState>) => void,
  text: string,
) {
  set({ isGenerating: true });
  const replyId = nextId();
  // 先占位一条空的助手消息
  set({
    messages: [...get().messages, { id: replyId, role: "assistant", text: "", streaming: true }],
  });

  let i = 0;
  const timer = setInterval(() => {
    // 被中断则停止并把占位消息标记为非流式
    if (!get().isGenerating) {
      clearInterval(timer);
      set({
        messages: get().messages.map((m) =>
          m.id === replyId ? { ...m, streaming: false } : m,
        ),
      });
      return;
    }
    i += 1;
    const partial = text.slice(0, i);
    set({
      messages: get().messages.map((m) =>
        m.id === replyId ? { ...m, text: partial } : m,
      ),
    });
    if (i >= text.length) {
      clearInterval(timer);
      set({
        isGenerating: false,
        messages: get().messages.map((m) =>
          m.id === replyId ? { ...m, streaming: false } : m,
        ),
      });
    }
  }, 28);
}

const REPLY_TEXT = "好的,我已经看完这段代码。下面是我的分析:这里可以抽取成一个独立函数,提升可读性。";

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [
    { id: nextId(), role: "user", text: "帮我看一下这个函数" },
    { id: nextId(), role: "assistant", text: "好的,请把代码贴出来。" },
  ],
  input: "",
  isGenerating: false,

  setInput: (text) => set({ input: text }),

  send: () => {
    const { input, isGenerating } = get();
    if (!input.trim() || isGenerating) return;
    const userMsg: ChatMessage = { id: nextId(), role: "user", text: input.trim() };
    set({ input: "", messages: [...get().messages, userMsg] });
    streamReply(get, set, REPLY_TEXT);
  },

  abort: () => {
    if (!get().isGenerating) return;
    set({ isGenerating: false });
  },

  retry: () => {
    const { messages, isGenerating } = get();
    if (isGenerating) return;
    // 去掉最后一条助手消息,重新生成
    let trimmed = messages;
    if (trimmed.length && trimmed[trimmed.length - 1].role === "assistant") {
      trimmed = trimmed.slice(0, -1);
    }
    set({ messages: trimmed });
    streamReply(get, set, REPLY_TEXT);
  },

  clear: () => set({ messages: [], input: "", isGenerating: false }),
}));
