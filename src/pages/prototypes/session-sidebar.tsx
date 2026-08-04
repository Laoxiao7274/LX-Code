import { useSessionStore } from "@/pages/prototypes/session-store";
import { useSettingsStore } from "@/pages/prototypes/settings-store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Plus, MessageSquare, Settings, ChevronRight, Folder } from "lucide-react";

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
 * 左侧会话栏:按项目(文件夹)分组,项目下挂会话。
 * 两级树:项目头(折叠/展开) + 会话列表。
 */
export function SessionSidebar() {
  const projects = useSessionStore((s) => s.projects);
  const activeId = useSessionStore((s) => s.activeId);
  const create = useSessionStore((s) => s.create);
  const select = useSessionStore((s) => s.select);
  const toggleProject = useSessionStore((s) => s.toggleProject);
  const openSettings = useSettingsStore((s) => s.setOpen);

  return (
    <div className="flex h-full flex-col bg-muted/25">
      {/* 顶部:打开项目按钮 */}
      <div className="px-2.5 pt-2.5">
        <Button
          variant="outline"
          className="h-8 w-full justify-start gap-2 rounded-full px-3 text-[13px] font-normal"
        >
          <Folder className="h-4 w-4" />
          打开项目
        </Button>
      </div>

      {/* 项目列表 */}
      <ScrollArea className="flex-1">
        <div className="px-1.5 pb-2 pt-2">
          {projects.map((p) => {
            const collapsed = p.collapsed;
            return (
              <div key={p.id} className="mb-1">
                {/* 项目头 */}
                <div className="group flex items-center gap-1 rounded-md px-1.5 py-1">
                  <button
                    type="button"
                    onClick={() => toggleProject(p.id)}
                    className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                  >
                    <ChevronRight
                      className={cn(
                        "h-3.5 w-3.5 shrink-0 text-muted-foreground/60 transition-transform",
                        !collapsed && "rotate-90",
                      )}
                    />
                    <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate text-[12px] font-medium">{p.name}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground/50">
                      {p.sessions.length}
                    </span>
                  </button>
                  {/* 项目级新建会话 */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 shrink-0 text-muted-foreground/60 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() => create(p.id)}
                    title="新建会话"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>

                {/* 会话列表(折叠时隐藏) */}
                {!collapsed ? (
                  <div className="ml-3 space-y-0.5 border-l border-border/40 pl-1">
                    {p.sessions.map((s) => {
                      const active = s.id === activeId;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => select(s.id)}
                          className={cn(
                            "relative flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors",
                            active ? "bg-background shadow-sm" : "hover:bg-background/60",
                          )}
                        >
                          {active ? (
                            <span className="absolute -left-[5px] top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-accent" />
                          ) : null}
                          <MessageSquare className={cn("h-3 w-3 shrink-0", active ? "text-accent" : "text-muted-foreground")} />
                          <div className="min-w-0 flex-1">
                            <div
                              className={cn(
                                "truncate text-[12px]",
                                active ? "font-medium text-foreground" : "text-foreground/85",
                              )}
                            >
                              {s.title}
                            </div>
                            <div className="text-[10px] text-muted-foreground/70">{relTime(s.updatedAt)}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <Separator className="bg-border/60" />

      {/* 底部:设置入口 */}
      <div className="p-1.5">
        <Button variant="ghost" className="w-full justify-start gap-2.5 text-muted-foreground" onClick={() => openSettings(true)}>
          <div className="flex h-5 w-5 items-center justify-center">
            <Settings className="h-4 w-4" />
          </div>
          设置
        </Button>
      </div>
    </div>
  );
}
