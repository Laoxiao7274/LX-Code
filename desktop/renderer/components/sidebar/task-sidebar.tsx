import { useAgentStore, type TaskStatus } from "../../stores/agent-task-store";
import { useSettingsStore } from "../../stores/settings-store";
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";
import { Separator } from "../ui/separator";
import { Plus, CheckCircle2, Loader2, AlertCircle, Clock, Settings } from "lucide-react";
import { cn } from "../../lib/utils";

const STATUS: Record<TaskStatus, { icon: typeof CheckCircle2; cls: string; label: string }> = {
  running: { icon: Loader2, cls: "text-accent", label: "进行中" },
  done: { icon: CheckCircle2, cls: "text-emerald-500", label: "已完成" },
  waiting: { icon: Clock, cls: "text-amber-500", label: "等待确认" },
  error: { icon: AlertCircle, cls: "text-destructive", label: "出错" },
};

function relTime(ts: number): string {
  const m = Math.floor((Date.now() - ts) / 60_000);
  if (m < 1) return "刚刚";
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  return `${Math.floor(h / 24)} 天前`;
}

/**
 * Agent 模式左侧栏:任务列表。
 * 每个任务带状态图标 + 进度 + 相对时间,与 Coding 模式的会话列表区分。
 */
export function TaskSidebar() {
  const tasks = useAgentStore((s) => s.tasks);
  const activeId = useAgentStore((s) => s.activeId);
  const create = useAgentStore((s) => s.create);
  const select = useAgentStore((s) => s.select);
  const openSettings = useSettingsStore((s) => s.setOpen);

  return (
    <div className="flex h-full flex-col bg-muted/25">
      <div className="p-2.5">
        <Button variant="outline" className="h-8 w-full justify-start gap-2 rounded-full px-3 text-[13px] font-normal" onClick={create}>
          <Plus className="h-4 w-4" />
          新建任务
        </Button>
      </div>

      <div className="px-3.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
        任务
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-0.5 px-1.5 pb-2">
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 px-3 py-10 text-center text-muted-foreground">
              <div className="text-[12px]">还没有任务</div>
              <div className="text-[11px] text-muted-foreground/70">Agent 模式任务流待对接</div>
            </div>
          ) : (
            tasks.map((t) => {
            const active = t.id === activeId;
            const s = STATUS[t.status];
            const Icon = s.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => select(t.id)}
                className={cn(
                  "group relative flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                  active ? "bg-background shadow-sm" : "hover:bg-background/60",
                )}
              >
                {active ? <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-accent" /> : null}
                <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", s.cls, t.status === "running" && "animate-spin")} />
                <div className="min-w-0 flex-1">
                  <div className={cn("truncate text-[13px]", active ? "font-medium text-foreground" : "text-foreground/85")}>
                    {t.title}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground/80">
                    <span>{s.label}</span>
                    {t.totalSteps > 0 ? (
                      <>
                        <span>·</span>
                        <span className="font-mono">{t.doneSteps}/{t.totalSteps}</span>
                      </>
                    ) : null}
                    <span>·</span>
                    <span>{relTime(t.updatedAt)}</span>
                  </div>
                </div>
              </button>
            );
          }))}
        </div>
      </ScrollArea>

      <Separator className="bg-border/60" />

      <div className="p-1.5">
        <Button variant="ghost" className="w-full justify-start gap-2.5 text-muted-foreground" onClick={() => openSettings(true)}>
          <div className="flex h-5 w-5 items-center justify-center"><Settings className="h-4 w-4" /></div>
          设置
        </Button>
      </div>
    </div>
  );
}
