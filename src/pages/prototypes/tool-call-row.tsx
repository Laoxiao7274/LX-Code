import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { ChevronRight, Check, X, FileText, Terminal, Pencil, Search, FileSearch } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToolCallPart, ToolStatus } from "./chat-store";

gsap.registerPlugin(useGSAP);

interface ToolCallRowProps {
  part: ToolCallPart;
}

/** 工具名 → 图标映射。 */
const TOOL_ICON: Record<string, typeof FileText> = {
  read: FileSearch,
  write: FileText,
  edit: Pencil,
  bash: Terminal,
  grep: Search,
};

/** 状态 → 颜色。 */
const STATUS_CLASS: Record<ToolStatus, string> = {
  running: "text-accent",
  ok: "text-emerald-500",
  error: "text-destructive",
};

/**
 * 工具调用行:等宽字体,状态图标 + 工具名 + 参数 + 耗时,可折叠看输出。
 * 参照 kimi ToolRow / opencode MessagePart 的克制风格。
 */
export function ToolCallRow({ part }: ToolCallRowProps) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const { contextSafe } = useGSAP({ scope: container });
  const prevStatus = useRef<ToolStatus>(part.status);

  const Icon = TOOL_ICON[part.name] ?? Terminal;
  const hasOutput = !!part.output && part.output.length > 0;
  const canExpand = hasOutput || part.status === "running";

  // 状态从 running 切到 ok/error 时:自动展开 + output/图标/timing 淄入(非打字机)
  useEffect(() => {
    if (prevStatus.current === "running" && part.status !== "running") {
      setOpen(true);
      const body = bodyRef.current;
      if (body) {
        gsap.fromTo(
          body,
          { opacity: 0, y: -4 },
          { opacity: 1, y: 0, duration: 0.3, ease: "power2.out", overwrite: true },
        );
      }
      // 状态图标缩放淡入
      const icon = container.current?.querySelector(".status-icon") as HTMLElement | null;
      if (icon) {
        gsap.fromTo(icon, { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.25, ease: "back.out(2)" });
      }
      // timing 从右侧滑入
      const chip = container.current?.querySelector(".timing-chip") as HTMLElement | null;
      if (chip) {
        gsap.fromTo(chip, { opacity: 0, x: 6 }, { opacity: 1, x: 0, duration: 0.3, ease: "power2.out" });
      }
    }
    prevStatus.current = part.status;
  }, [part.status]);

  const toggle = contextSafe(() => {
    if (!canExpand) return;
    setOpen((prev) => {
      const next = !prev;
      const body = bodyRef.current;
      if (body) {
        gsap.to(body, {
          height: next ? "auto" : 0,
          duration: 0.3,
          ease: "power2.inOut",
          overwrite: true,
        });
      }
      return next;
    });
  });

  return (
    <div
      ref={container}
      className={cn(
        "my-1 overflow-hidden rounded-lg border border-border/60 bg-muted/30",
        part.status === "error" && "border-destructive/30",
      )}
    >
      <button
        type="button"
        onClick={toggle}
        disabled={!canExpand}
        className={cn(
          "flex w-full items-center gap-2 px-2.5 py-1.5 text-left font-mono text-[12px] transition-colors",
          canExpand && "hover:bg-muted/60",
          open && "bg-muted/60",
        )}
      >
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="shrink-0 font-medium text-foreground">{part.name}</span>
        <span className="min-w-0 flex-1 truncate text-muted-foreground">{part.arg}</span>

        {/* 状态指示:running→ok/error 平滑过渡,非打字机 */}
        <span className={cn("flex shrink-0 items-center transition-colors duration-200", STATUS_CLASS[part.status])}>
          {part.status === "ok" ? (
            <Check className="status-icon h-3.5 w-3.5" />
          ) : part.status === "error" ? (
            <X className="status-icon h-3.5 w-3.5" />
          ) : (
            <span className="signal-dot signal-dot-live" aria-hidden />
          )}
        </span>

        {part.timing ? (
          <span className="timing-chip shrink-0 text-[11px] text-muted-foreground/70">{part.timing}</span>
        ) : null}

        {canExpand ? (
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-muted-foreground/60 transition-transform",
              open && "rotate-90",
            )}
          />
        ) : null}
      </button>

      <div ref={bodyRef} className="h-0 overflow-hidden">
        <div className="border-t border-border/60 bg-muted/20 px-2.5 py-2 pl-8">
          {part.status === "running" && !hasOutput ? (
            <div className="font-mono text-[12px] italic text-muted-foreground">等待输出…</div>
          ) : (
            <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed text-muted-foreground">
              {part.output?.join("\n")}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
