import { useSessionStore } from "@/pages/prototypes/session-store";
import { useModeStore } from "@/pages/prototypes/mode-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ModeSwitcher } from "./mode-switcher";
import { AgentView } from "./agent-view";
import { CodingView } from "./coding-view";
import { DesignView } from "./design-view";

/**
 * 对话主区:顶栏(模式切换 + 会话标题 + 模型) + 当前模式视图。
 * 三种模式共享会话状态,只切中间主区呈现。
 */
export function ChatMain() {
  const sessions = useSessionStore((s) => s.sessions);
  const activeId = useSessionStore((s) => s.activeId);
  const mode = useModeStore((s) => s.mode);
  const active = sessions.find((x) => x.id === activeId);

  return (
    <div className="flex h-full flex-col bg-background">
      {/* 顶栏:模式切换 + 会话标题 + 模型胶囊 */}
      <div className="flex h-11 items-center gap-2.5 border-b border-border/60 px-3">
        <ModeSwitcher />
        <span className="mx-1 h-4 w-px bg-border/60" />
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

      {/* 当前模式视图 */}
      <div className="flex-1 overflow-hidden">
        {mode === "agent" && <AgentView />}
        {mode === "coding" && <CodingView />}
        {mode === "design" && <DesignView />}
      </div>
    </div>
  );
}
