import { useModeStore, type AppMode } from "../../stores/mode-store";
import { useChatStore } from "../../stores/chat-store";
import { cn } from "../../lib/utils";
import { Bot, Code2 } from "lucide-react";

const MODES: { id: AppMode; label: string; icon: typeof Bot }[] = [
  { id: "agent", label: "Agent", icon: Bot },
  { id: "coding", label: "Coding", icon: Code2 },
];

/**
 * 模式切换器:应用主区顶栏左侧的三段式分段控件。
 * 切换中间主区的呈现视角,会话状态共享。
 */
export function ModeSwitcher() {
  const mode = useModeStore((s) => s.mode);
  const setMode = useModeStore((s) => s.setMode);
  const generating = useChatStore((s) => Object.values(s.generatingBySession).some(Boolean));

  return (
    <div className="inline-flex h-7 items-center rounded-lg border border-border/60 bg-muted/40 p-0.5">
      {MODES.map((m) => {
        const active = m.id === mode;
        const Icon = m.icon;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => setMode(m.id)}
            className={cn(
              "inline-flex h-6 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active && generating ? (
              <span className="signal-dot signal-dot-live" aria-hidden />
            ) : (
              <Icon className="h-3.5 w-3.5" />
            )}
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
