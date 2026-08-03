import { useEffect, useRef, useState } from "react";
import { Code, Bug, FlaskConical, Wand2, FileSearch, ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";

/** 命令定义。 */
interface Command {
  name: string;
  label: string;
  desc: string;
  Icon: typeof Code;
  /** 插入到输入框的文本。 */
  insert: string;
}

const COMMANDS: Command[] = [
  { name: "explain", label: "解释代码", desc: "说明这段代码的作用", Icon: FileSearch, insert: "/explain " },
  { name: "fix", label: "修复问题", desc: "定位并修复 bug", Icon: Bug, insert: "/fix " },
  { name: "test", label: "生成测试", desc: "为选区生成单元测试", Icon: FlaskConical, insert: "/test " },
  { name: "refactor", label: "重构优化", desc: "改善代码结构", Icon: Wand2, insert: "/refactor " },
  { name: "review", label: "代码审查", desc: "审查改动并提建议", Icon: Code, insert: "/review " },
  { name: "todo", label: "任务规划", desc: "先拆解任务再执行", Icon: ListTodo, insert: "/todo " },
];

interface SlashMenuProps {
  /** 是否显示菜单(输入框以 / 开头时)。 */
  open: boolean;
  /** 当前已输入的过滤词(去掉 /)。 */
  query: string;
  /** 选中某命令时回调,传入要插入的文本。 */
  onSelect: (insert: string) => void;
  /** 关闭菜单(如 Esc / 失焦)。 */
  onClose: () => void;
}

/**
 * 斜杠命令菜单:输入框输入 / 时弹出,键盘上下选择 + 回车确认。
 * 参照 Cursor/codex 的 slash command 体验。
 */
export function SlashMenu({ open, query, onSelect, onClose }: SlashMenuProps) {
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = COMMANDS.filter(
    (c) => !query || c.name.includes(query.toLowerCase()) || c.label.includes(query),
  );

  // query 变化时重置选中
  useEffect(() => {
    setActive(0);
  }, [query]);

  // 滚动到当前选中项
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${active}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open || filtered.length === 0) return null;

  // 键盘导航(由输入框的 onKeyDown 转发,这里暴露处理函数)
  // 为简化,这里通过全局键盘事件监听
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => (i + 1) % filtered.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => (i - 1 + filtered.length) % filtered.length);
      } else if (e.key === "Enter" && filtered[active]) {
        e.preventDefault();
        onSelect(filtered[active].insert);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, active, filtered, onSelect, onClose]);

  return (
    <div className="mb-1 overflow-hidden rounded-lg border border-border/60 bg-popover shadow-lg">
      <div className="border-b border-border/60 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
        命令
      </div>
      <div ref={listRef} className="max-h-60 overflow-y-auto p-1">
        {filtered.map((c, i) => {
          const Icon = c.Icon;
          return (
            <button
              key={c.name}
              type="button"
              data-idx={i}
              onMouseEnter={() => setActive(i)}
              onClick={() => onSelect(c.insert)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left transition-colors",
                i === active ? "bg-muted" : "hover:bg-muted/60",
              )}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Icon className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono text-[12px] text-foreground">/{c.name}</span>
                  <span className="text-[12px] text-muted-foreground">{c.label}</span>
                </div>
                <div className="truncate text-[11px] text-muted-foreground/80">{c.desc}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
