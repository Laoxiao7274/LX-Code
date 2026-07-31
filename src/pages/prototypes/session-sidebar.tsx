import { useSessionStore } from "@/pages/prototypes/session-store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/** 相对时间格式化(简易版)。 */
function relTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "刚刚";
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  return `${d} 天前`;
}

/**
 * 应用左侧会话栏:新建 + 会话列表 + 设置入口。
 * 全部用调试场组件拼装。
 */
export function SessionSidebar() {
  const sessions = useSessionStore((s) => s.sessions);
  const activeId = useSessionStore((s) => s.activeId);
  const create = useSessionStore((s) => s.create);
  const select = useSessionStore((s) => s.select);

  return (
    <div className="flex h-full flex-col bg-muted/30">
      {/* 顶部:新建会话 */}
      <div className="p-2">
        <Button variant="outline" className="w-full justify-start gap-2" onClick={create}>
          <span className="text-base leading-none">+</span> 新建会话
        </Button>
      </div>

      <Separator />

      {/* 会话列表 */}
      <ScrollArea className="flex-1">
        <div className="space-y-0.5 p-1.5">
          {sessions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => select(s.id)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors",
                s.id === activeId
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/60",
              )}
            >
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-[10px]">📝</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{s.title}</div>
                <div className="text-xs text-muted-foreground">{relTime(s.updatedAt)}</div>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>

      <Separator />

      {/* 底部:设置入口 */}
      <div className="p-1.5">
        <Button variant="ghost" className="w-full justify-start gap-2">
          <Avatar className="h-5 w-5">
            <AvatarFallback className="text-[9px]">⚙</AvatarFallback>
          </Avatar>
          设置
        </Button>
      </div>
    </div>
  );
}
