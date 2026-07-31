import { useState } from "react";
import { cn } from "@/lib/utils";

export interface WorkbenchEvent {
  id: string;
  label: string;
  description?: string;
  /** 真正触发的事件处理:点击时执行,返回值显示在底部反馈条。 */
  handler?: () => string | void;
}

interface EventsSidebarProps {
  title: string;
  events: WorkbenchEvent[];
  hint?: string;
}

/**
 * 右侧事件/状态侧栏:点击真正执行 handler,并在底部反馈条显示结果。
 */
export function EventsSidebar({ title, events, hint }: EventsSidebarProps) {
  const [fired, setFired] = useState<{ id: string; label: string; result?: string } | null>(null);

  const trigger = (ev: WorkbenchEvent) => {
    const result = ev.handler?.();
    setFired({ id: ev.id, label: ev.label, result: result ?? undefined });
  };

  return (
    <aside className="flex h-full flex-col border-l border-border/60 bg-muted/25">
      <div className="px-3.5 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
        {title}
      </div>
      <div className="px-3.5 pb-2 text-[11px] text-muted-foreground/80">
        {hint ?? "点击触发,效果实时反映在预览区"}
      </div>
      <div className="flex-1 overflow-y-auto px-1.5 pb-2">
        {events.length === 0 ? (
          <div className="px-2.5 py-3 text-xs text-muted-foreground">该页面暂无事件</div>
        ) : (
          <ul className="space-y-1">
            {events.map((ev) => {
              const active = fired?.id === ev.id;
              return (
                <li key={ev.id}>
                  <button
                    type="button"
                    onClick={() => trigger(ev)}
                    className={cn(
                      "w-full rounded-lg px-2.5 py-2 text-left transition-colors",
                      active
                        ? "bg-accent text-accent-foreground shadow-sm"
                        : "bg-background/50 text-foreground/85 hover:bg-background hover:shadow-sm",
                    )}
                  >
                    <div className="text-[13px] font-medium">{ev.label}</div>
                    {ev.description ? (
                      <div
                        className={cn(
                          "mt-0.5 text-[11px]",
                          active ? "text-accent-foreground/70" : "text-muted-foreground/80",
                        )}
                      >
                        {ev.description}
                      </div>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {fired ? (
        <div className="border-t border-border/60 bg-background px-3.5 py-2.5 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="signal-dot scale-75" aria-hidden />
            <span className="text-muted-foreground">已触发</span>
            <span className="font-medium text-foreground">{fired.label}</span>
          </div>
          {fired.result ? (
            <div className="mt-1 pl-4 text-muted-foreground/90">→ {fired.result}</div>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}
