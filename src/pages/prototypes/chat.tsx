import { useChatStore } from "./chat-store";

/**
 * 对话页原型 —— 真实交互版。
 * 状态来自 useChatStore,右栏事件直接调 store 方法,
 * 预览区自动重渲染。输入框回车也能发送。
 */
export function ChatPrototype() {
  const messages = useChatStore((s) => s.messages);
  const input = useChatStore((s) => s.input);
  const isGenerating = useChatStore((s) => s.isGenerating);
  const setInput = useChatStore((s) => s.setInput);
  const send = useChatStore((s) => s.send);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            暂无消息
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
            >
              <div
                className={
                  m.role === "user"
                    ? "max-w-[70%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                    : "max-w-[70%] rounded-lg bg-muted px-3 py-2 text-sm"
                }
              >
                {m.text}
                {m.streaming ? (
                  <span className="ml-1 inline-block h-3 w-px animate-pulse bg-foreground/60 align-middle" />
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-3 flex gap-2 border-t border-border pt-3">
        <input
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
          placeholder={isGenerating ? "生成中..." : "输入消息,回车发送"}
          value={input}
          disabled={isGenerating}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button
          type="button"
          disabled={isGenerating || !input.trim()}
          onClick={send}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          发送
        </button>
      </div>
    </div>
  );
}
