import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, ListTodo, CheckCircle2, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentTask } from "./agent-task-store";

interface TaskPlannerProps {
  activeTask?: AgentTask;
  onClose?: () => void;
}

/** 构造一个示例执行计划(用于演示)。 */
function stepsFor(): { label: string; done: boolean; current?: boolean }[] {
  return [
    { label: "分析任务目标", done: true },
    { label: "扫描相关代码", done: true },
    { label: "制定改动方案", done: false, current: true },
    { label: "执行代码修改", done: false },
    { label: "运行验证与构建", done: false },
  ];
}

/**
 * 任务规划面板:展示 Coding agent 当前任务的执行计划步骤。
 * 占位/打勾/当前步 三种状态,并显示任务标题与进度。
 */
export function TaskPlanner({ activeTask, onClose }: TaskPlannerProps) {
  const title = activeTask?.title ?? "等待任务…";
  const steps = stepsFor();
  const done = steps.filter((s) => s.done).length;

  return (
    <div className="flex h-full flex-col bg-muted/20">
      <div className="flex h-8 items-center justify-between border-b border-border/60 bg-muted/20 pl-3 pr-1">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          <ListTodo className="h-3 w-3" />
          任务规划
        </span>
        {onClose ? (
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3">
          {/* 任务标题 + 进度 */}
          <div className="mb-3">
            <div className="truncate text-[13px] font-medium leading-snug">{title}</div>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(done / steps.length) * 100}%` }} />
              </div>
              <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">{done}/{steps.length}</span>
            </div>
          </div>

          {/* 步骤列表 */}
          <ul className="space-y-0.5">
            {steps.map((s) => (
              <li
                key={s.label}
                className={cn(
                  "flex items-start gap-2 rounded-md px-2 py-1.5 text-[12px]",
                  s.done ? "text-muted-foreground" : s.current ? "bg-background text-foreground" : "text-muted-foreground/70",
                )}
              >
                {s.done ? (
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                ) : s.current ? (
                  <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-accent" />
                ) : (
                  <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                )}
                <span>{s.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </ScrollArea>
    </div>
  );
}
