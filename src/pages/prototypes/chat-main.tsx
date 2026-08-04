import { useSessionStore } from "@/pages/prototypes/session-store";
import { Badge } from "@/components/ui/badge";
import { CodingView } from "./coding-view";

/**
 * Coding 模式主区:顶栏(会话标题 + 项目名) + 三栏。
 * 模型/思考/上下文控件移到输入框附近(ChatToolbar),不在这。
 */
export function ChatMain() {
  const projects = useSessionStore((s) => s.projects);
  const activeId = useSessionStore((s) => s.activeId);
  // 找当前会话 + 所属项目
  let active: { title: string; projectName: string } | undefined;
  for (const p of projects) {
    const s = p.sessions.find((x) => x.id === activeId);
    if (s) { active = { title: s.title, projectName: p.name }; break; }
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {/* 顶栏:会话标题 + 项目名 */}
      <div className="flex h-11 items-center gap-2.5 border-b border-border/60 px-3">
        <span className="text-[13px] font-medium tracking-tight">
          {active?.title ?? "未选择会话"}
        </span>
        {active ? (
          <Badge variant="outline" className="h-4 px-1.5 text-[10px] font-normal text-muted-foreground">
            {active.projectName}
          </Badge>
        ) : null}
      </div>

      {/* Coding 模式三栏 */}
      <div className="flex-1 overflow-hidden">
        <CodingView />
      </div>
    </div>
  );
}
