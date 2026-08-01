import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import {
  ChevronRight, Check, X, FileText, Terminal, Pencil, Search, FileSearch, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToolCallPart, ToolStatus } from "./chat-store";
import { toolMeta } from "./tool-meta";

gsap.registerPlugin(useGSAP);

interface ToolCallRowProps {
  part: ToolCallPart;
}

/** 工具名 → 图标。 */
const TOOL_ICON: Record<string, typeof FileText> = {
  read: FileSearch,
  write: FileText,
  edit: Pencil,
  bash: Terminal,
  grep: Search,
};

/** 状态 → 整体色系(左条+图标+chip)。 */
const STATUS: Record<ToolStatus, { bar: string; icon: string; label: string; labelCls: string }> = {
  running: { bar: "bg-muted-foreground/40", icon: "text-muted-foreground", label: "运行中", labelCls: "text-muted-foreground" },
  ok: { bar: "bg-emerald-500", icon: "text-emerald-500", label: "完成", labelCls: "text-emerald-600" },
  error: { bar: "bg-destructive", icon: "text-destructive", label: "失败", labelCls: "text-destructive" },
};

/**
 * 工具调用卡片。
 * 设计:左侧状态色条 + 图标 + 摘要 + 统计 chip,折叠/展开看输出。
 * 摘要按工具类型智能提取(read→文件名, bash→命令, edit→+/-),
 * 而非显示原始参数。
 */
export function ToolCallRow({ part }: ToolCallRowProps) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const prevStatus = useRef<ToolStatus>(part.status);
  const { contextSafe } = useGSAP({ scope: container });

  const Icon = TOOL_ICON[part.name] ?? Terminal;
  const meta = toolMeta(part.name, part.arg, part.output, part.status);
  const s = STATUS[part.status];
  const hasOutput = !!part.output && part.output.length > 0;
  const canExpand = hasOutput || part.status === "running";
  const isBash = part.name === "bash";

  // running → ok/error:自动展开 + 元素协同淡入(非打字机)
  useEffect(() => {
    if (prevStatus.current === "running" && part.status !== "running") {
      setOpen(true);
      const body = bodyRef.current;
      if (body) {
        gsap.fromTo(body, { opacity: 0, y: -4 }, { opacity: 1, y: 0, duration: 0.28, ease: "power2.out", overwrite: true });
      }
      const icon = container.current?.querySelector(".tc-status-icon") as HTMLElement | null;
      if (icon) gsap.fromTo(icon, { scale: 0.3, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: "back.out(2.2)" });
      const chip = container.current?.querySelector(".tc-chip") as HTMLElement | null;
      if (chip) gsap.fromTo(chip, { opacity: 0, x: 6 }, { opacity: 1, x: 0, duration: 0.3, ease: "power2.out" });
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
      {/* 左侧状态色条 */}
      <div className={cn("absolute left-0 top-0 h-full w-[3px] transition-colors duration-200", s.bar)} />

      <button
        type="button"
        onClick={toggle}
        disabled={!canExpand}
        className={cn(
          "flex w-full items-center gap-2.5 py-2 pl-3 pr-2.5 text-left transition-colors",
          canExpand && "hover:bg-muted/40",
          open && "bg-muted/40",
        )}
      >
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />

        {/* 工具名 + 摘要 */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="shrink-0 font-mono text-[12px] font-medium text-foreground">{part.name}</span>
            <span className="min-w-0 truncate font-mono text-[12px] text-muted-foreground">
              {open ? meta.summaryFull ?? meta.summary : meta.summary}
            </span>
          </div>
        </div>

        {/* 统计 chip */}
        {meta.chip ? (
          <span className={cn("tc-chip shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium", part.status === "error" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground")}>
            {meta.chip}
          </span>
        ) : null}

        {/* 状态图标 */}
        <span className={cn("tc-status-icon flex h-4 w-4 shrink-0 items-center justify-center", s.icon)}>
          {part.status === "ok" ? (
            <Check className="h-3.5 w-3.5" />
          ) : part.status === "error" ? (
            <X className="h-3.5 w-3.5" />
          ) : (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          )}
        </span>

        {/* 状态文字 + 耗时 */}
        {part.timing ? (
          <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground/70">{part.timing}</span>
        ) : null}

        {canExpand ? (
          <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-transform", open && "rotate-90")} />
        ) : null}
      </button>

      {/* 输出面板 */}
      <div ref={bodyRef} className={cn("h-0 overflow-hidden", isBash && "bg-zinc-950")}>
        <div className={cn("border-t px-3 py-2.5", isBash ? "border-zinc-800" : "border-border/60 bg-muted/20")}>
          {part.status === "running" && !hasOutput ? (
            <div className={cn("font-mono text-[12px] italic", isBash ? "text-zinc-500" : "text-muted-foreground")}>
              等待输出…
            </div>
          ) : isBash ? (
            // bash:终端样式(深底亮字)
            <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed text-zinc-300">
              {part.output?.join("\n")}
            </pre>
          ) : (
            // 其他:代码块带行号
            <div className="space-y-0.5">
              {part.output?.map((line, i) => (
                <div key={i} className="flex gap-3 font-mono text-[12px] leading-relaxed">
                  <span className="w-6 shrink-0 select-none text-right text-muted-foreground/40 tabular-nums">{i + 1}</span>
                  <span className={cn("whitespace-pre-wrap break-words", line.startsWith("+") ? "text-emerald-600" : line.startsWith("-") ? "text-destructive" : "text-muted-foreground")}>
                    {line}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
