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

/** 通用左侧导航侧栏:列出可选项,点击高亮选中。 */
export function NavSidebar({ title, items, activeId, onSelect }: NavSidebarProps) {
  return (
    <aside className="flex h-full flex-col border-r border-border bg-muted/30">
      <div className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <div className="flex-1 overflow-y-auto px-1.5 pb-2">
        {items.length === 0 ? (
          <div className="px-2 py-3 text-xs text-muted-foreground">暂无</div>
        ) : (
          <ul className="space-y-0.5">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSelect(item.id)}
                  className={cn(
                    "w-full rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
                    item.id === activeId
                      ? "bg-accent text-accent-foreground"
                      : "text-foreground/80 hover:bg-accent/60 hover:text-foreground",
                  )}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
