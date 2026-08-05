import { useState } from "react";
import { useModelStore } from "../../stores/model-store";
import { useChatStore } from "../../stores/chat-store";
import { cn } from "../../lib/utils";
import { ChevronDown, Check, Brain, Activity } from "lucide-react";

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
        className="flex h-6 items-center gap-1.5 rounded-md px-2 text-[11px] text-muted-foreground transition-colors hover:bg-muted/60"
      >
        <span className="signal-dot scale-[0.7]" aria-hidden />
        <span className="max-w-[120px] truncate font-medium text-foreground">{curLabel}</span>
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

/** 思考等级直接下拉(不跳设置)。 */
function ThinkingLevelSelect({ sessionId }: { sessionId: string }) {
  const [level, setLevel] = useState<ThinkingLevel>("medium");
  const [open, setOpen] = useState(false);
  const cur = THINKING_LEVELS.find((l) => l.id === level)?.label ?? "中";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-6 items-center gap-1.5 rounded-md px-2 text-[11px] text-muted-foreground transition-colors hover:bg-muted/60"
      >
        <Brain className="h-3.5 w-3.5" />
        <span>思考</span>
        <span className="font-medium text-foreground">{cur}</span>
        <ChevronDown className={cn("h-3 w-3 text-muted-foreground/60 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 z-20 mb-1 w-36 rounded-lg border border-border/60 bg-popover p-1 shadow-lg">
            {THINKING_LEVELS.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => { setLevel(l.id); setOpen(false); if (sessionId) void window.lxcode?.agent?.setThinkingLevel?.(sessionId, l.id); }}
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

/** 格式化 tokens 为 k(如 24576 → 24.6k)。 */
function fmtK(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k";
  return String(n);
}

/** 上下文用量纯展示(hover 显示详情浮层)。 */
function ContextUsage({ sessionId }: { sessionId: string }) {
  const usage = useChatStore((s) => s.usageBySession[sessionId]);
  const providers = useModelStore((s) => s.providers);
  const defaultModel = useModelStore((s) => s.defaultModel);
  const [hover, setHover] = useState(false);
  // 从默认模型查 contextWindow
  let total = 128000;
  if (defaultModel) {
    const [pid, mid] = defaultModel.split("/");
    const m = providers.find((p) => p.id === pid)?.models.find((x) => x.id === mid) as unknown as { contextWindow?: number } | undefined;
    if (m?.contextWindow) total = m.contextWindow;
  }
  const used = usage?.input ?? 0;
  const output = usage?.output ?? 0;
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  if (!usage) {
    // 还没收到 usage(未发过消息):显示空占位
    return (
      <div className="flex h-6 items-center gap-1.5 px-2 text-[11px] text-muted-foreground/50">
        <Activity className="h-3.5 w-3.5" />
        <span className="font-mono tabular-nums">—</span>
      </div>
    );
  }
  return (
    <div
      className="relative flex h-6 items-center gap-1.5 px-2 text-[11px] text-muted-foreground"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <Activity className="h-3.5 w-3.5" />
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            pct > 80 ? "bg-destructive" : pct > 50 ? "bg-amber-500" : "bg-accent",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono tabular-nums">{pct}%</span>
      {hover ? (
        <div className="absolute bottom-full right-0 mb-1 z-50 w-44 rounded-lg border border-border/60 bg-popover p-2.5 text-[11px] shadow-lg">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">上下文用量</div>
          <div className="space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">当前上下文</span><span className="font-mono tabular-nums text-foreground">{fmtK(used)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">模型窗口</span><span className="font-mono tabular-nums text-foreground">{fmtK(total)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">本轮输出</span><span className="font-mono tabular-nums text-foreground">{fmtK(output)}</span></div>
            <div className="flex justify-between border-t border-border/40 pt-1"><span className="text-muted-foreground">已用</span><span className="font-mono tabular-nums text-accent">{pct}%</span></div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * 会话工具条:输入框下方一行,模型下拉 + 思考等级下拉 + 上下文展示。
 * 全部直接操作/展示,不跳设置。
 */
export function ChatToolbar({ sessionId }: { sessionId: string }) {
  return (
    <div className="mt-1.5 flex items-center gap-0.5 px-1">
      <ModelSelect />
      <span className="h-3 w-px bg-border/40" />
      <ThinkingLevelSelect sessionId={sessionId} />
      <div className="flex-1" />
      <ContextUsage sessionId={sessionId} />
    </div>
  );
}
