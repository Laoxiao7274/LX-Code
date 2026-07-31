import { useState } from "react";
import { cn } from "@/lib/utils";

export interface WorkbenchEvent {
  id: string;
  label: string;
  description?: string;
}

interface EventsSidebarProps {
  title: string;
  events: WorkbenchEvent[];
  hint?: string;
}

/**
 * 右侧事件/状态侧栏:列出原型可触发的事件。
 * 点击 → 高亮 + 弹出 toast 样式的反馈条(模拟事件触发效果)。
 */
export function EventsSidebar({ title, events, hint }: EventsSidebarProps) {
  const [fired, setFired] = useState<string | null>(null);

  return (
    <aside className="flex h-full flex-col border-l border-border bg-muted/30">
      <div className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <div className="px-3 pb-1 text-xs text-muted-foreground">
        {hint ?? "点击触发,效果显示在底部"}
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
                  onClick={() => setFired(ev.id)}
                  className={cn(
                    "w-full rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
                    fired === ev.id
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
          <span className="font-medium text-foreground">
            {events.find((e) => e.id === fired)?.label}
          </span>
        </div>
      ) : null}
    </aside>
  );
}
