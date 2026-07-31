import { useSessionStore } from "@/pages/prototypes/session-store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/** 相对时间格式化。 */
function relTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "刚刚";
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  return `${Math.floor(h / 24)} 天前`;
}

/**
 * 应用左侧会话栏:新建 + 会话列表 + 设置入口。
 */
export function SessionSidebar() {
  const sessions = useSessionStore((s) => s.sessions);
  const activeId = useSessionStore((s) => s.activeId);
  const create = useSessionStore((s) => s.create);
  const select = useSessionStore((s) => s.select);

  return (
    <div className="flex h-full flex-col bg-muted/25">
      {/* 顶部:新建会话(强调色) */}
      <div className="p-2.5">
        <Button className="w-full justify-start gap-2 shadow-sm" onClick={create}>
          <span className="text-base leading-none">+</span>
          新建会话
        </Button>
      </div>

      <div className="px-3.5 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
        会话
      </div>

      {/* 会话列表 */}
      <ScrollArea className="flex-1">
        <div className="space-y-0.5 px-1.5 pb-2">
          {sessions.map((s) => {
            const active = s.id === activeId;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => select(s.id)}
                className={cn(
                  "group relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                  active ? "bg-background shadow-sm" : "hover:bg-background/60",
                )}
              >
                {/* 选中态左侧强调条 */}
                {active ? (
                  <span
                    className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-accent"
                    aria-hidden
                  />
                ) : null}
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback
                    className={cn(
                      "text-[11px]",
                      active ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground",
                    )}
                  >
                    📝
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div
                    className={cn(
                      "truncate text-[13px]",
                      active ? "font-medium text-foreground" : "text-foreground/85",
                    )}
                  >
                    {s.title}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground/80">
                    {relTime(s.updatedAt)}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>

      <Separator className="bg-border/60" />

      {/* 底部:设置入口 */}
      <div className="p-1.5">
        <Button variant="ghost" className="w-full justify-start gap-2.5 text-muted-foreground">
          <Avatar className="h-5 w-5">
            <AvatarFallback className="bg-transparent text-[11px]">⚙</AvatarFallback>
          </Avatar>
          设置
        </Button>
      </div>
    </div>
  );
}
