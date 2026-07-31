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
 * handler 返回的字符串会显示在"已触发"反馈条;无返回值则只显示事件名。
 */
export function EventsSidebar({ title, events, hint }: EventsSidebarProps) {
  const [fired, setFired] = useState<{ id: string; label: string; result?: string } | null>(null);

  const trigger = (ev: WorkbenchEvent) => {
    const result = ev.handler?.();
    setFired({ id: ev.id, label: ev.label, result: result ?? undefined });
  };

  return (
    <aside className="flex h-full flex-col border-l border-border bg-muted/30">
      <div className="px-3 py-2 text-xs font-medium tracking-wide text-muted-foreground">
        {title}
      </div>
      <div className="px-3 pb-1 text-xs text-muted-foreground">
        {hint ?? "点击触发,效果实时反映在预览区"}
      </div>
      <div className="flex-1 overflow-y-auto px-1.5 pb-2">
        {events.length === 0 ? (
          <div className="px-2 py-3 text-xs text-muted-foreground">该页面暂无事件</div>
        ) : (
          <ul className="space-y-0.5">
            {events.map((ev) => (
              <li key={ev.id}>
                <button
                  type="button"
                  onClick={() => trigger(ev)}
                  className={cn(
                    "w-full rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
                    fired?.id === ev.id
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground/80 hover:bg-accent/60 hover:text-foreground",
                  )}
                >
                  <div>{ev.label}</div>
                  {ev.description ? (
                    <div className="mt-0.5 text-xs opacity-70">{ev.description}</div>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {fired ? (
        <div className="border-t border-border bg-background px-3 py-2 text-xs">
          <span className="text-muted-foreground">已触发:</span>{" "}
          <span className="font-medium text-foreground">{fired.label}</span>
          {fired.result ? (
            <div className="mt-1 text-muted-foreground">→ {fired.result}</div>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}
