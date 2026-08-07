import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

/**
 * 自定义下拉选择:替代原生 <select>,带自定义箭头、浮层列表、GSAP 入场动画、
 * hover/focus 高级感、键盘导航(↑↓Enter/Esc)。样式与设置页表单控件统一。
 *
 * 用法(兼容原生心智):
 *   <Select value={v} onChange={setV} options={[{value:"a",label:"A"}]} className="..." />
 */
export function Select({
  value,
  onChange,
  options,
  className = "",
  disabled,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [hoverIndex, setHoverIndex] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ left: 0, top: 0, width: 0 });

  const selected = options.find((o) => o.value === value);

  // 浮层定位:贴触发器下方,宽度至少同触发器
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setBox({ left: r.left, top: r.bottom + 4, width: r.width });
  }, [open]);

  // 滚动时关闭(避免浮层错位)
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    return () => window.removeEventListener("scroll", close, true);
  }, [open]);

  // 点击外部关闭:mousedown 不在触发器/浮层内则收起。
  // 用 mousedown 而非 click,避免与触发器 onClick toggle 冲突(点外部另一控件时先关本菜单再让该控件响应)。
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node | null;
      if (!t) return;
      if (triggerRef.current?.contains(t)) return;
      if (listRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // 键盘导航
  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen(true);
        setHoverIndex(Math.max(0, options.findIndex((o) => o.value === value)));
      }
      return;
    }
    if (e.key === "Escape") { e.preventDefault(); setOpen(false); return; }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHoverIndex((i) => {
        let n = i + 1;
        while (n < options.length && options[n].disabled) n++;
        return n < options.length ? n : i;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHoverIndex((i) => {
        let n = i - 1;
        while (n >= 0 && options[n].disabled) n--;
        return n >= 0 ? n : i;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = options[hoverIndex];
      if (opt && !opt.disabled) { onChange(opt.value); setOpen(false); }
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => !disabled && setOpen((v) => !v)}
        onKeyDown={onKeyDown}
        className={`group flex h-8 items-center justify-between gap-1.5 rounded-md border border-border bg-surface px-2.5 text-xs text-foreground outline-none transition-[border-color,box-shadow] duration-150 hover:border-accent/45 focus:border-accent focus:ring-[3px] focus:ring-accent/15 disabled:opacity-50 ${className}`}
      >
        <span className={`min-w-0 flex-1 truncate ${selected ? "" : "text-muted"}`}>
          {selected ? selected.label : "—"}
        </span>
        <ChevronDown
          size={13}
          className={`shrink-0 text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open &&
        createPortal(
          <div
            style={{ position: "fixed", left: box.left, top: box.top, minWidth: box.width, zIndex: 50 }}
            ref={listRef}
            role="listbox"
            // 入场动画:scale + fade
            className="select-popover origin-top overflow-hidden rounded-md border border-border bg-surface-raised py-1 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {options.map((opt, i) => (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={opt.value === value}
                disabled={opt.disabled}
                onMouseEnter={() => setHoverIndex(i)}
                onClick={() => {
                  if (opt.disabled) return;
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs transition-colors ${
                  opt.disabled
                    ? "cursor-not-allowed text-muted/50"
                    : hoverIndex === i
                      ? "bg-accent/12 text-foreground"
                      : "text-foreground/85 hover:bg-surface-overlay"
                }`}
              >
                <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                {opt.value === value && (
                  <Check size={13} className="shrink-0 text-accent" />
                )}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
