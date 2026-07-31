import { useSessionStore } from "@/pages/prototypes/session-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChatPrototype } from "./chat";

/**
 * 对话主区:顶栏(当前会话标题 + 模型胶囊) + 消息流 + 输入区。
 */
export function ChatMain() {
  const sessions = useSessionStore((s) => s.sessions);
  const activeId = useSessionStore((s) => s.activeId);
  const active = sessions.find((x) => x.id === activeId);

  return (
    <div className="flex h-full flex-col bg-background">
      {/* 顶栏:会话标题 + 模型选择器 */}
      <div className="flex h-11 items-center gap-2 border-b border-border/60 px-4">
        <span className="text-[13px] font-medium tracking-tight">
          {active?.title ?? "未选择会话"}
        </span>
        <Badge variant="outline" className="h-4 px-1.5 text-[10px] font-normal text-muted-foreground">
          main
        </Badge>
        <div className="flex-1" />
        <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
          <span className="signal-dot scale-75" aria-hidden />
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
