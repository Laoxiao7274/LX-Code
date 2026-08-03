import { Plus, MessageSquare } from "lucide-react";
import { Button } from "../../components/ui/button";
import { ScrollArea } from "../../components/ui/scroll-area";
import { cn } from "../../lib/utils";
import { useSessionStore } from "../../stores/session-store";

/** 会话侧栏:新建 + 会话列表。照抄设计原型样式。 */
export function SessionSidebar() {
  const sessions = useSessionStore((s) => s.sessions);
  const activeId = useSessionStore((s) => s.activeId);
  const create = useSessionStore((s) => s.create);
  const select = useSessionStore((s) => s.select);

  return (
    <div className="flex h-full flex-col bg-muted/25">
      <div className="p-2.5">
        <Button variant="outline" className="h-8 w-full justify-start gap-2 rounded-full px-3 text-[13px] font-normal" onClick={() => create()}>
          <Plus className="h-4 w-4" />
          新建会话
        </Button>
      </div>

      <div className="px-3.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
        会话
      </div>

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
                {active ? <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-accent" /> : null}
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted">
                  <MessageSquare className={cn("h-3.5 w-3.5", active ? "text-accent" : "text-muted-foreground")} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className={cn("truncate text-[13px]", active ? "font-medium text-foreground" : "text-foreground/85")}>
                    {s.title}
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-muted-foreground/70 font-mono">{s.cwd}</div>
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
