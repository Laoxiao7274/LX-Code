import { useState } from "react";
import { useAgentStore, type TaskStep } from "./agent-task-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Target, Flag } from "lucide-react";
import { ThinkingBlock } from "./thinking-block";
import { ToolCallRow } from "./tool-call-row";
import { cn } from "@/lib/utils";

/** 把任务步骤转成 tool-call-row 需要的 part。 */
function ToolStep({ step }: { step: TaskStep }) {
  return (
    <ToolCallRow
      part={{
        type: "tool",
        id: step.id,
        name: step.toolName ?? "tool",
        arg: step.toolArg ?? "",
        output: step.toolOutput,
        status: step.toolStatus ?? "running",
        timing: step.toolTiming,
      }}
    />
  );
}

/**
 * Agent 模式主区:任务执行流。
 * 目标 → 思考 → 工具调用 → 结果,底部是发起任务输入(非普通对话)。
 * 与 Coding 模式区别:无代码编辑器,强调任务进度与自主执行。
 */
export function AgentMain() {
  const tasks = useAgentStore((s) => s.tasks);
  const activeId = useAgentStore((s) => s.activeId);
  const runTask = useAgentStore((s) => s.runTask);
  const task = tasks.find((t) => t.id === activeId);

  const [goal, setGoal] = useState("");

  if (!task) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">选择左侧任务</div>;
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {/* 顶栏:任务标题 + 状态徽章 */}
      <div className="flex h-11 items-center gap-2.5 border-b border-border/60 px-4">
        <Target className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[13px] font-medium tracking-tight">{task.title}</span>
        <Badge
          variant="outline"
          className={cn(
            "h-4 px-1.5 text-[10px] font-normal",
            task.status === "running" && "border-accent/40 text-accent",
            task.status === "done" && "border-emerald-500/40 text-emerald-600",
            task.status === "waiting" && "border-amber-500/40 text-amber-600",
            task.status === "error" && "border-destructive/40 text-destructive",
          )}
        >
          {task.status === "running" ? "进行中" : task.status === "done" ? "已完成" : task.status === "waiting" ? "等待确认" : "出错"}
        </Badge>
        {task.totalSteps > 0 ? (
          <span className="font-mono text-[11px] text-muted-foreground">{task.doneSteps}/{task.totalSteps}</span>
        ) : null}
      </div>

      {/* 执行流 */}
      <ScrollArea className="flex-1">
        <div className="mx-auto max-w-3xl space-y-2 p-4">
          {task.steps.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center text-muted-foreground">
              <Flag className="h-8 w-8 opacity-40" />
              <div className="text-sm">在下方输入任务目标,Agent 将自主执行</div>
            </div>
          ) : (
            task.steps.map((step) => {
              if (step.type === "goal") {
                return (
                  <div key={step.id} className="rounded-lg border border-accent/30 bg-accent/5 px-3.5 py-2.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-accent">
                      <Target className="h-3 w-3" /> 目标
                    </div>
                    <div className="mt-1 text-[13px]">{step.text}</div>
                  </div>
                );
              }
              if (step.type === "thinking") {
                return <ThinkingBlock key={step.id} part={{ type: "thinking", id: step.id, text: step.text ?? "", streaming: step.streaming }} />;
              }
              if (step.type === "tool") {
                return <ToolStep key={step.id} step={step} />;
              }
              return (
                <div key={step.id} className="py-1 text-[13px] leading-relaxed">
                  {step.text}
                  {step.streaming ? <span className="ml-0.5 inline-block h-3.5 w-px animate-pulse bg-foreground/50 align-middle" /> : null}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* 发起任务输入(非普通对话) */}
      <div className="border-t border-border/60 p-3">
        <div className="mx-auto flex max-w-3xl gap-2">
          <Input
            placeholder="描述任务目标,回车发起"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (goal.trim()) {
                  runTask(goal.trim());
                  setGoal("");
                }
              }
            }}
            className="h-10 shadow-sm"
          />
          <Button className="h-10 px-5 shadow-sm" disabled={!goal.trim()} onClick={() => { runTask(goal.trim()); setGoal(""); }}>
            发起
          </Button>
        </div>
      </div>
    </div>
  );
}
