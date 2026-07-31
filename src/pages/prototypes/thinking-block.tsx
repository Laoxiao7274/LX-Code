import { useRef, useState } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { ChevronRight } from "lucide-react";
import { Brain } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ThinkingPart } from "./chat-store";

gsap.registerPlugin(useGSAP);

interface ThinkingBlockProps {
  part: ThinkingPart;
}

/**
 * 思考段:流式时显示 5 行滚动窗口,折叠后显示最后一段 teaser。
 * 点击展开/折叠全部分段。等宽字体,muted 配色,贴近 kimi/codex 思考样式。
 */
export function ThinkingBlock({ part }: ThinkingBlockProps) {
  const [open, setOpen] = useState(part.streaming ?? false);
  const container = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const { contextSafe } = useGSAP({ scope: container });

  const paragraphs = part.text.split(/\n{2,}/).filter((p) => p.trim().length > 0);
  const teaser = paragraphs[paragraphs.length - 1] ?? "";

  const toggle = contextSafe(() => {
    setOpen((prev) => {
      const next = !prev;
      // 折叠动画:用 grid-template-rows 0fr↔1fr 过渡(比 height:auto 平滑)
      const wrap = bodyRef.current?.querySelector(".tb-window") as HTMLElement | null;
      if (wrap) {
        gsap.to(wrap, {
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
    <div ref={container} className="my-1">
      <button
        type="button"
        onClick={toggle}
        className="group flex w-full items-center gap-2 rounded-lg px-1 py-1.5 text-left"
      >
        <Brain className={cn("h-3.5 w-3.5", part.streaming ? "text-accent" : "text-muted-foreground")} />
        <span className="text-xs font-medium text-muted-foreground">
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
            <span className="truncate font-mono text-[11px] text-muted-foreground/70">{teaser}</span>
            <ChevronRight
              className={cn(
                "ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground/60 transition-transform",
                open && "rotate-90",
              )}
            />
          </>
        )}
      </button>

      <div ref={bodyRef} className="overflow-hidden">
        <div className="tb-window overflow-hidden">
          <pre
            className={cn(
              "max-h-32 overflow-y-auto whitespace-pre-wrap break-words px-1 py-2 font-mono text-[12px] leading-relaxed",
              "text-muted-foreground",
            )}
          >
            {part.text}
            {part.streaming ? (
              <span className="ml-0.5 inline-block h-3.5 w-px animate-pulse bg-foreground/50 align-middle" />
            ) : null}
          </pre>
        </div>
      </div>
    </div>
  );
}
