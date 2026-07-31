/**
 * 对话页原型 —— 占位骨架。
 * 后续在 Phase 3 做真实布局时替换。
 */
export function ChatPrototype() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto space-y-3">
        <div className="flex justify-end">
          <div className="max-w-[70%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
            帮我看一下这个函数
          </div>
        </div>
        <div className="flex justify-start">
          <div className="max-w-[70%] rounded-lg bg-muted px-3 py-2 text-sm">
            好的,请把代码贴出来。
          </div>
        </div>
      </div>
      <div className="mt-3 flex gap-2 border-t border-border pt-3">
        <input
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
          placeholder="输入消息..."
        />
        <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          发送
        </button>
      </div>
    </div>
  );
}
