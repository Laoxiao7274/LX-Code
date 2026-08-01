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
  /** 按剧本逐轮自动播放:用户消息 + 助手流式回复,轮间隔等待。 */
  playScript: (turns: { user: string; reply: ReplyScript }[]) => void;
  /** 停止正在播放的剧本 */
  stopScript: () => void;
}

let idSeed = 0;
const nextId = () => `m${++idSeed}`;

/** 剧本播放停止控制器。 */
let scriptStop = () => {};

/** 一轮助手回复的剧本:思考 + 多个工具调用 + 正文。 */
export interface ReplyScript {
  think: string;
  tools?: { name: string; arg: string; output?: string[]; status?: "ok" | "error"; timing?: string }[];
  text: string;
}

/** 模拟一段流式助手回复:先思考,再调工具,最后正文。可被 abort 打断。 */
function streamReply(
  get: () => ChatState,
  set: (partial: Partial<ChatState>) => void,
  script: ReplyScript = {
    think: "用户让我看这个函数。先理解它的职责:它接收一个数组并做过滤。问题在于每次迭代都新建临时数组,有性能开销。我会先用 read 工具确认上下文,再给出重构建议。",
    tools: [{ name: "read", arg: "src/utils/filter.ts", output: ["1  export function filter<T>(arr: T[], fn: (x: T) => boolean): T[] {", "2    let result: T[] = [];", "3    for (const x of arr) {", "4      if (fn(x)) result = [...result, x];", "5    }", "6    return result;", "7  }"], timing: "0.8s" }],
    text: "这段函数可以优化:用一次 filter 替代多次拼接,减少中间数组分配。",
  },
) {
  set({ isGenerating: true });
  const replyId = nextId();
  const thinkId = `t${++idSeed}`;
  const textId = `x${++idSeed}`;
  const toolIds = (script.tools ?? []).map(() => `tl${++idSeed}`);

  // 先占位一条助手消息,带思考段 + 工具段 + 文本段
  const placeholder: ChatMessage = {
    id: replyId,
    role: "assistant",
    streaming: true,
    parts: [
      { type: "thinking", id: thinkId, text: "", streaming: true } satisfies MessagePart,
      ...(script.tools ?? []).map((t, i) => ({
        type: "tool",
        id: toolIds[i],
        name: t.name,
        arg: t.arg,
        status: "running" as const,
      } satisfies MessagePart)),
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
    updatePart(thinkId, { text: script.think.slice(0, i) });
    if (i >= script.think.length) {
      clearInterval(thinkTimer);
      updatePart(thinkId, { streaming: false });

      // 阶段 2:逐个工具调用依次完成
      const tools = script.tools ?? [];
      const runTool = (idx: number) => {
        if (idx >= tools.length) {
          // 阶段 3:正文流式
          startText();
          return;
        }
        const t = tools[idx];
        setTimeout(() => {
          if (!get().isGenerating) return;
          updatePart(toolIds[idx], {
            status: t.status ?? "ok",
            timing: t.timing ?? `${(0.4 + Math.random() * 0.6).toFixed(1)}s`,
            output: t.output,
          });
          runTool(idx + 1);
        }, 700 + Math.random() * 500);
      };
      runTool(0);
    }
  }, 24);

  // 阶段 3:正文流式
  function startText() {
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
      updatePart(textId, { text: script.text.slice(0, j) });
      if (j >= script.text.length) {
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
  }
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

  playScript: (turns) => {
    // 先停掉任何正在进行的播放/生成
    get().stopScript();
    set({ messages: [], input: "", isGenerating: false });

    let idx = 0;
    let stopped = false;
    scriptStop = () => { stopped = true; };

    const playTurn = () => {
      if (stopped || idx >= turns.length) return;
      const turn = turns[idx++];
      // 注入用户消息
      set({ messages: [...get().messages, { id: nextId(), role: "user", text: turn.user }] });
      // 等一下再启动助手回复(模拟用户停顿)
      setTimeout(() => {
        if (stopped) return;
        streamReply(get, set, turn.reply);
        // 等助手回复结束后再播下一轮。轮询 isGenerating
        const waitDone = () => {
          if (stopped) return;
          if (get().isGenerating) {
            setTimeout(waitDone, 200);
          } else {
            // 轮间隔
            setTimeout(playTurn, 600);
          }
        };
        // 流式启动需要一点时间,先等一下再轮询
        setTimeout(waitDone, 300);
      }, 500);
    };
    playTurn();
  },

  stopScript: () => {
    scriptStop();
    scriptStop = () => {};
    set({ isGenerating: false });
  },
}));
