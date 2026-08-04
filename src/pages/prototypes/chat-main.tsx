import { useState } from "react";
import { useSessionStore } from "@/pages/prototypes/session-store";
import { useModelStore } from "@/pages/prototypes/model-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { ChevronDown, Check, Brain, Activity } from "lucide-react";
import { CodingView } from "./coding-view";

/** 思考等级。 */
type ThinkingLevel = "off" | "low" | "medium" | "high" | "xhigh" | "max";
const THINKING_LEVELS: { id: ThinkingLevel; label: string }[] = [
  { id: "off", label: "关闭" },
  { id: "low", label: "低" },
  { id: "medium", label: "中" },
  { id: "high", label: "高" },
  { id: "xhigh", label: "极高" },
  { id: "max", label: "最大" },
];

/** 模型选择下拉。 */
function ModelSwitcher() {
  const providers = useModelStore((s) => s.providers);
  const defaultModel = useModelStore((s) => s.defaultModel);
  const setDefault = useModelStore((s) => s.setDefault);
  const [open, setOpen] = useState(false);

  // 当前选中的模型名
  const [curProvider, curModel] = defaultModel.split("/");
  const cur = providers.find((p) => p.id === curProvider)?.models.find((m) => m.id === curModel);
  const curLabel = cur?.name ?? defaultModel;

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1.5 text-xs"
        onClick={() => setOpen(!open)}
      >
        <span className="signal-dot scale-[0.8]" aria-hidden />
        <span className="max-w-[120px] truncate">{curLabel}</span>
        <ChevronDown className={cn("h-3 w-3 text-muted-foreground/60 transition-transform", open && "rotate-180")} />
      </Button>
      {open ? (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 max-h-72 w-60 overflow-y-auto rounded-lg border border-border/60 bg-popover p-1 shadow-lg">
            {providers.map((p) => (
              <div key={p.id}>
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                  {p.name}
                </div>
                {p.models.filter((m) => m.enabled).map((m) => {
                  const key = `${p.id}/${m.id}`;
                  const active = defaultModel === key;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => { setDefault(key); setOpen(false); }}
                      className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[12px] hover:bg-muted/60"
                    >
                      <span className="truncate">{m.name}</span>
                      {active ? <Check className="h-3.5 w-3.5 shrink-0 text-accent" /> : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

/** 思考等级选择。 */
function ThinkingLevelSwitcher() {
  const [level, setLevel] = useState<ThinkingLevel>("medium");
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1.5 text-xs"
        onClick={() => setOpen(!open)}
      >
        <Brain className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">思考</span>
        <span className="font-medium">{THINKING_LEVELS.find((l) => l.id === level)?.label}</span>
        <ChevronDown className={cn("h-3 w-3 text-muted-foreground/60 transition-transform", open && "rotate-180")} />
      </Button>
      {open ? (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-40 rounded-lg border border-border/60 bg-popover p-1 shadow-lg">
            {THINKING_LEVELS.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => { setLevel(l.id); setOpen(false); }}
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[12px] hover:bg-muted/60"
              >
                <span>{l.label}</span>
                {level === l.id ? <Check className="h-3.5 w-3.5 shrink-0 text-accent" /> : null}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

/** 上下文使用量(模拟)。 */
function ContextUsage() {
  const used = 24576;
  const total = 200000;
  const pct = Math.round((used / total) * 100);
  return (
    <div className="flex h-7 items-center gap-1.5 rounded-md border border-border/60 px-2 text-xs text-muted-foreground">
      <Activity className="h-3.5 w-3.5" />
      <div className="flex items-center gap-1.5">
        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              pct > 80 ? "bg-destructive" : pct > 50 ? "bg-amber-500" : "bg-accent",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="font-mono text-[10px] tabular-nums">{pct}%</span>
      </div>
    </div>
  );
}

/**
 * Coding 模式主区:顶栏(会话标题 + 模型切换 + 思考等级 + 上下文用量) + 三栏。
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
      {/* 顶栏:会话标题 + 项目 + 模型切换 + 思考等级 + 上下文用量 */}
      <div className="flex h-11 items-center gap-2.5 border-b border-border/60 px-3">
        <span className="text-[13px] font-medium tracking-tight">
          {active?.title ?? "未选择会话"}
        </span>
        {active ? (
          <Badge variant="outline" className="h-4 px-1.5 text-[10px] font-normal text-muted-foreground">
            {active.projectName}
          </Badge>
        ) : null}
        <div className="flex-1" />
        <ContextUsage />
        <Separator orientation="vertical" className="h-5" />
        <ThinkingLevelSwitcher />
        <ModelSwitcher />
      </div>

      {/* Coding 模式三栏 */}
      <div className="flex-1 overflow-hidden">
        <CodingView />
      </div>
    </div>
  );
}
