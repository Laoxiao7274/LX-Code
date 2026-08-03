import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { ChevronRight, Check, X, FileText, Terminal, Pencil, Search, FileSearch, Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";
import type { ToolCallPart, ToolStatus } from "../../stores/chat-store";

gsap.registerPlugin(useGSAP);

interface ToolCallRowProps {
  part: ToolCallPart;
}

const TOOL_ICON: Record<string, typeof FileText> = {
  read: FileSearch,
  write: FileText,
  edit: Pencil,
  bash: Terminal,
  grep: Search,
};

const STATUS: Record<ToolStatus, { bar: string; icon: string }> = {
  running: { bar: "bg-muted-foreground/40", icon: "text-muted-foreground" },
  ok: { bar: "bg-emerald-500", icon: "text-emerald-500" },
  error: { bar: "bg-destructive", icon: "text-destructive" },
};

/** 工具调用卡片:照抄设计原型样式。 */
export function ToolCallRow({ part }: ToolCallRowProps) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const prevStatus = useRef<ToolStatus>(part.status);
  const { contextSafe } = useGSAP({ scope: container });

  const Icon = TOOL_ICON[part.name] ?? Terminal;
  const s = STATUS[part.status];
  const hasOutput = !!part.output && part.output.length > 0;
  const canExpand = hasOutput || part.status === "running";
  const isBash = part.name === "bash";

  // running → ok/error:自动展开 + 淡入
  useEffect(() => {
    if (prevStatus.current === "running" && part.status !== "running") {
      setOpen(true);
      const body = bodyRef.current;
      if (body) gsap.fromTo(body, { opacity: 0, y: -4 }, { opacity: 1, y: 0, duration: 0.28, ease: "power2.out", overwrite: true });
      const icon = container.current?.querySelector(".tc-status-icon") as HTMLElement | null;
      if (icon) gsap.fromTo(icon, { scale: 0.3, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: "back.out(2.2)" });
    }
    prevStatus.current = part.status;
  }, [part.status]);

  const toggle = contextSafe(() => {
    if (!canExpand) return;
    setOpen((prev) => {
      const next = !prev;
      const body = bodyRef.current;
      if (body) gsap.to(body, { height: next ? "auto" : 0, duration: 0.28, ease: "power2.inOut", overwrite: true });
      return next;
    });
  });

  return (
    <div
      ref={container}
      className={cn(
        "group relative my-1 overflow-hidden rounded-lg border bg-card",
        part.status === "error" ? "border-destructive/30 bg-destructive/5" : "border-border/60",
      )}
    >
      <div className={cn("absolute left-0 top-0 h-full w-[3px] transition-colors duration-200", s.bar)} />
      <button
        type="button"
        onClick={toggle}
        disabled={!canExpand}
        className={cn("flex w-full items-center gap-2.5 py-2 pl-3 pr-2.5 text-left transition-colors", canExpand && "hover:bg-muted/40", open && "bg-muted/40")}
      >
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="shrink-0 font-mono text-[12px] font-medium text-foreground">{part.name}</span>
            <span className="min-w-0 truncate font-mono text-[12px] text-muted-foreground">{part.arg}</span>
          </div>
        </div>
        <span className={cn("tc-status-icon flex h-4 w-4 shrink-0 items-center justify-center", s.icon)}>
          {part.status === "ok" ? <Check className="h-3.5 w-3.5" /> : part.status === "error" ? <X className="h-3.5 w-3.5" /> : <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        </span>
        {part.timing ? <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground/70">{part.timing}</span> : null}
        {canExpand ? <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-transform", open && "rotate-90")} /> : null}
      </button>

      <div ref={bodyRef} className={cn("h-0 overflow-hidden", isBash && "bg-zinc-950")}>
        <div className={cn("border-t px-3 py-2.5", isBash ? "border-zinc-800" : "border-border/60 bg-muted/20")}>
          {part.status === "running" && !hasOutput ? (
            <div className={cn("font-mono text-[12px] italic", isBash ? "text-zinc-500" : "text-muted-foreground")}>等待输出…</div>
          ) : (
            <pre className={cn("overflow-x-auto whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed", isBash ? "text-zinc-300" : "text-muted-foreground")}>
              {part.output?.join("\n")}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
