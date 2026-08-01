import { useSessionStore } from "@/pages/prototypes/session-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CodingView } from "./coding-view";

/**
 * Coding 模式主区:顶栏(会话标题 + 模型) + 三栏(文件树 | 对话 + Monaco)。
 */
export function ChatMain() {
  const sessions = useSessionStore((s) => s.sessions);
  const activeId = useSessionStore((s) => s.activeId);
  const active = sessions.find((x) => x.id === activeId);

  return (
    <div className="flex h-full flex-col bg-background">
      {/* 顶栏:会话标题 + 模型胶囊 */}
      <div className="flex h-11 items-center gap-2.5 border-b border-border/60 px-3">
        <span className="text-[13px] font-medium tracking-tight">
          {active?.title ?? "未选择会话"}
        </span>
        <Badge variant="outline" className="h-4 px-1.5 text-[10px] font-normal text-muted-foreground">
          main
        </Badge>
        <div className="flex-1" />
        <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
          <span className="signal-dot scale-[0.8]" aria-hidden />
          claude-sonnet-4
        </Button>
      </div>

      {/* Coding 模式三栏 */}
      <div className="flex-1 overflow-hidden">
        <CodingView />
      </div>
    </div>
  );
}
