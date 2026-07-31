import { cn } from "@/lib/utils";

interface NavItem {
  id: string;
  label: string;
}

interface NavSidebarProps {
  title: string;
  items: NavItem[];
  activeId: string;
  onSelect: (id: string) => void;
}

/** 通用左侧导航侧栏:选中态强调色左条 + 卡片浮起。 */
export function NavSidebar({ title, items, activeId, onSelect }: NavSidebarProps) {
  return (
    <aside className="flex h-full flex-col border-r border-border/60 bg-muted/25">
      <div className="px-3.5 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
        {title}
      </div>
      <div className="flex-1 overflow-y-auto px-1.5 pb-2">
        {items.length === 0 ? (
          <div className="px-2.5 py-3 text-xs text-muted-foreground">暂无</div>
        ) : (
          <ul className="space-y-0.5">
            {items.map((item) => {
              const active = item.id === activeId;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(item.id)}
                    className={cn(
                      "relative flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors",
                      active
                        ? "bg-background text-foreground shadow-sm"
                        : "text-foreground/80 hover:bg-background/60 hover:text-foreground",
                    )}
                  >
                    {active ? (
                      <span
                        className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-accent"
                        aria-hidden
                      />
                    ) : null}
                    {item.label}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
