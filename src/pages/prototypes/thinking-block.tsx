import { useEffect, useRef, useState } from "react";
import { ChevronRight, Brain } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ThinkingPart } from "./chat-store";

interface ThinkingBlockProps {
  part: ThinkingPart;
}

/**
 * 思考段:流式时展开显示滚动窗口,结束后自动收起为一行 teaser。
 * 点击可重新展开/折叠。等宽字体,muted 配色,贴近 kimi/codex 思考样式。
 */
export function ThinkingBlock({ part }: ThinkingBlockProps) {
  const [open, setOpen] = useState(part.streaming ?? false);
  const bodyRef = useRef<HTMLDivElement>(null);

  // 流式时自动展开;流式结束自动收起
  useEffect(() => {
    if (part.streaming) {
      setOpen(true);
    } else if (open) {
      // 流式刚结束,收起
      setOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [part.streaming]);

  // 流式时窗口滚到底
  useEffect(() => {
    if (!part.streaming) return;
    const el = bodyRef.current?.querySelector(".tb-window") as HTMLElement | null;
    if (el) el.scrollTop = el.scrollHeight;
  }, [part.text, part.streaming]);

  const paragraphs = part.text.split(/\n{2,}/).filter((p) => p.trim().length > 0);
  const teaser = paragraphs[paragraphs.length - 1] ?? "";

  return (
    <div className="my-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group flex w-full items-center gap-2 rounded-lg px-1 py-1.5 text-left"
      >
        <Brain
          className={cn("h-3.5 w-3.5 shrink-0", part.streaming ? "text-accent" : "text-muted-foreground")}
        />
        <span className="shrink-0 text-xs font-medium text-muted-foreground">
          {part.streaming ? "思考中" : "已思考"}
        </span>
        {part.streaming ? (
          <span className="flex gap-1">
            <span className="h-1 w-1 animate-bounce rounded-full bg-accent [animation-delay:-0.3s]" />
            <span className="h-1 w-1 animate-bounce rounded-full bg-accent [animation-delay:-0.15s]" />
            <span className="h-1 w-1 animate-bounce rounded-full bg-accent" />
          </span>
        ) : (
          <>
            {/* 折叠时才显示 teaser(截断多行),展开时不显示 */}
            {!open ? (
              <span className="min-w-0 flex-1 break-words font-mono text-[11px] leading-snug text-muted-foreground/70 line-clamp-2">
                {teaser}
              </span>
            ) : null}
            <ChevronRight
              className={cn(
                "ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground/60 transition-transform",
                open && "rotate-90",
              )}
            />
          </>
        )}
      </button>

      {/* 用 grid-template-rows 1fr/0fr 过渡,自动高度且平滑 */}
      <div
        ref={bodyRef}
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="tb-window max-h-40 overflow-y-auto overflow-x-hidden px-1 py-2">
            <pre className="min-w-0 whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed text-muted-foreground">
              {part.text}
              {part.streaming ? (
                <span className="ml-0.5 inline-block h-3.5 w-px animate-pulse bg-foreground/50 align-middle" />
              ) : null}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
