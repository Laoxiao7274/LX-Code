import { useSessionStore } from "@/pages/prototypes/session-store";
import { Button } from "@/components/ui/button";
import { ChatPrototype } from "./chat";

/**
 * 对话主区:顶栏(当前会话标题 + 模型) + 消息流 + 输入区。
 * 消息流和输入区复用 ChatPrototype(已用调试场组件拼装)。
 */
export function ChatMain() {
  const sessions = useSessionStore((s) => s.sessions);
  const activeId = useSessionStore((s) => s.activeId);
  const active = sessions.find((x) => x.id === activeId);

  return (
    <div className="flex h-full flex-col">
      {/* 顶栏:会话标题 + 模型切换 */}
      <div className="flex h-10 items-center gap-2 border-b border-border px-3">
        <span className="text-sm font-medium">{active?.title ?? "未选择会话"}</span>
        <div className="flex-1" />
        <Button variant="ghost" size="sm">
          claude-sonnet-4
        </Button>
      </div>

      {/* 消息流 + 输入 */}
      <div className="flex-1 overflow-hidden p-3">
        <ChatPrototype />
      </div>
    </div>
  );
}
