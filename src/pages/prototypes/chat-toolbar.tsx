import { useState } from "react";
import { useModelStore } from "@/pages/prototypes/model-store";
import { useSettingsStore } from "@/pages/prototypes/settings-store";
import { cn } from "@/lib/utils";
import { ChevronDown, Check, Brain, Activity } from "lucide-react";

/** 思考等级(展示用,配置在设置)。 */
const THINKING_LABEL: Record<string, string> = {
  off: "关闭",
  low: "低",
  medium: "中",
  high: "高",
  xhigh: "极高",
  max: "最大",
};

/** 模型下拉(只选模型,不配置)。 */
function ModelSelect() {
  const providers = useModelStore((s) => s.providers);
  const defaultModel = useModelStore((s) => s.defaultModel);
  const setDefault = useModelStore((s) => s.setDefault);
  const [open, setOpen] = useState(false);

  const [curProvider, curModel] = defaultModel.split("/");
  const cur = providers.find((p) => p.id === curProvider)?.models.find((m) => m.id === curModel);
  const curLabel = cur?.name ?? defaultModel;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-7 items-center gap-1.5 rounded-md border border-border/60 bg-background px-2 text-[12px] transition-colors hover:bg-muted/40"
      >
        <span className="signal-dot scale-[0.7]" aria-hidden />
        <span className="max-w-[140px] truncate font-medium">{curLabel}</span>
        <ChevronDown className={cn("h-3 w-3 text-muted-foreground/60 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 z-20 mb-1 max-h-72 w-60 overflow-y-auto rounded-lg border border-border/60 bg-popover p-1 shadow-lg">
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

/** 思考等级展示(点开跳设置)。 */
function ThinkingLevelChip() {
  const openSettings = useSettingsStore((s) => s.setOpen);
  const setSection = useSettingsStore((s) => s.setSection);
  // 模拟当前思考等级(真实接 session.thinkingLevel)
  const level = "medium";
  return (
    <button
      type="button"
      onClick={() => { setSection("model"); openSettings(true); }}
      className="flex h-7 items-center gap-1.5 rounded-md border border-border/60 px-2 text-[12px] text-muted-foreground transition-colors hover:bg-muted/40"
      title="在设置中配置思考等级"
    >
      <Brain className="h-3.5 w-3.5" />
      <span>思考 {THINKING_LABEL[level]}</span>
    </button>
  );
}

/** 上下文用量展示(模拟)。 */
function ContextUsageChip() {
  const openSettings = useSettingsStore((s) => s.setOpen);
  const used = 24576;
  const total = 200000;
  const pct = Math.round((used / total) * 100);
  return (
    <button
      type="button"
      onClick={() => openSettings(true)}
      className="flex h-7 items-center gap-1.5 rounded-md border border-border/60 px-2 text-[12px] text-muted-foreground transition-colors hover:bg-muted/40"
      title={`${used.toLocaleString()} / ${total.toLocaleString()} tokens`}
    >
      <Activity className="h-3.5 w-3.5" />
      <div className="h-1.5 w-12 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            pct > 80 ? "bg-destructive" : pct > 50 ? "bg-amber-500" : "bg-accent",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-[10px] tabular-nums">{pct}%</span>
    </button>
  );
}

/**
 * 会话工具条:输入框上方一行,模型下拉 + 思考等级 + 上下文用量。
 * 模型只选不配(配置在设置),思考/上下文点开跳设置。
 */
export function ChatToolbar() {
  return (
    <div className="mb-1.5 flex items-center gap-1.5">
      <ModelSelect />
      <ThinkingLevelChip />
      <ContextUsageChip />
    </div>
  );
}
