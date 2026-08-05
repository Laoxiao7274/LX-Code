import { memo, useEffect, useRef, useState } from "react";
import { ChevronRight, Brain, Wrench } from "lucide-react";
import { cn } from "../../lib/utils";
import type { MessagePart, ThinkingPart, ToolCallPart } from "../../stores/chat-store";
import { ToolCallRow } from "./tool-call-row";

/** 一组相邻的思考/工具 part,聚成一个可折叠的思维链。 */
interface ChainGroup {
  type: "chain";
  parts: MessagePart[];
}

/** 不进思维链的 part(text/image),平铺。 */
interface LeafGroup {
  type: "leaf";
  part: MessagePart;
}

/** 分组结果。 */
export type GroupedPart = ChainGroup | LeafGroup;

/**
 * 把平铺的 parts 按"连续相邻的 thinking/tool 聚成思维链,text/image 平铺"分组。
 * 抄 assistant-ui(opencode UI 库)的 chain-of-thought 分组逻辑:
 * 连续的 reasoning + tool-call 归一个 group-chainOfThought,中间遇 text/image 断开。
 */
export function groupParts(parts: MessagePart[] | undefined): GroupedPart[] {
  if (!parts || parts.length === 0) return [];
  const out: GroupedPart[] = [];
  let chain: MessagePart[] = [];
  const flush = () => {
    if (chain.length > 0) {
      out.push({ type: "chain", parts: chain });
      chain = [];
    }
  };
  for (const p of parts) {
    if (p.type === "thinking" || p.type === "tool") {
      chain.push(p);
    } else {
      flush();
      out.push({ type: "leaf", part: p });
    }
  }
  flush();
  return out;
}

/** 思考小组:多个思考块平铺(不再各自折叠,外层思维链已管折叠)。带统一缩进。 */
const ReasoningGroup = memo(function ReasoningGroup({ parts }: { parts: ThinkingPart[] }) {
  const streaming = parts.some((p) => p.streaming);
  return (
    <div className="rounded-lg">
      <div className="flex items-center gap-1.5 px-1.5 py-1 text-[11px] font-medium text-muted-foreground/80">
        <Brain className={cn("h-3 w-3 shrink-0", streaming ? "text-accent" : "text-muted-foreground/70")} />
        {streaming ? (
          <>
            <span>思考中</span>
            <span className="flex gap-0.5">
              <span className="h-1 w-1 animate-bounce rounded-full bg-accent [animation-delay:-0.3s]" />
              <span className="h-1 w-1 animate-bounce rounded-full bg-accent [animation-delay:-0.15s]" />
              <span className="h-1 w-1 animate-bounce rounded-full bg-accent" />
            </span>
          </>
        ) : (
          <span>思考</span>
        )}
      </div>
      <div className="mt-0.5 space-y-1.5 border-l border-border/40 pl-2.5">
        {parts.map((p) => (
          <div key={p.id} className="tb-window max-h-48 overflow-y-auto overflow-x-hidden">
            <pre className="min-w-0 whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed text-muted-foreground">
              {p.text}
              {p.streaming ? <span className="ml-0.5 inline-block h-3.5 w-px animate-pulse bg-foreground/50 align-middle" /> : null}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
});

/** 工具小组:工具调用列表,带组头(N 次调用)。 */
const ToolGroup = memo(function ToolGroup({ parts }: { parts: ToolCallPart[] }) {
  return (
    <div className="space-y-0.5">
      {parts.length > 1 ? (
        <div className="flex items-center gap-1.5 px-1.5 pb-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60">
          <Wrench className="h-3 w-3" />
          {parts.length} 次工具调用
        </div>
      ) : null}
      {parts.map((p) => <ToolCallRow key={p.id} part={p} />)}
    </div>
  );
});

/** 思维链容器:最外层可折叠,里面分思考小组 + 工具小组。 */
export const ChainOfThoughtBlock = memo(function ChainOfThoughtBlock({ parts }: { parts: MessagePart[] }) {
  const thinkingParts = parts.filter((p): p is ThinkingPart => p.type === "thinking");
  const toolParts = parts.filter((p): p is ToolCallPart => p.type === "tool");
  const anyStreaming = thinkingParts.some((p) => p.streaming) || toolParts.some((p) => p.status === "running");
  const doneCount = toolParts.filter((p) => p.status !== "running").length;

  // 流式中自动展开,结束自动收起
  const [open, setOpen] = useState(anyStreaming);
  const prevStreaming = useRef(anyStreaming);
  useEffect(() => {
    if (anyStreaming) setOpen(true);
    else if (prevStreaming.current && !anyStreaming) setOpen(false);
    prevStreaming.current = anyStreaming;
  }, [anyStreaming]);

  // 折叠头摘要
  const summary = thinkingParts.length > 0
    ? `${thinkingParts.length} 段思考${toolParts.length ? ` · ${doneCount}/${toolParts.length} 工具` : ""}`
    : `${doneCount}/${toolParts.length} 工具调用`;

  return (
    <div className="my-1 rounded-xl border border-border/50 bg-muted/20 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/40"
      >
        <Brain className={cn("h-3.5 w-3.5 shrink-0", anyStreaming ? "text-accent" : "text-muted-foreground")} />
        <span className="shrink-0 text-[12px] font-medium text-muted-foreground">
          {anyStreaming ? "思考中" : "已思考"}
        </span>
        {anyStreaming ? (
          <span className="flex gap-1">
            <span className="h-1 w-1 animate-bounce rounded-full bg-accent [animation-delay:-0.3s]" />
            <span className="h-1 w-1 animate-bounce rounded-full bg-accent [animation-delay:-0.15s]" />
            <span className="h-1 w-1 animate-bounce rounded-full bg-accent" />
          </span>
        ) : (
          <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground/70">{summary}</span>
        )}
        <ChevronRight className={cn("ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground/60 transition-transform", open && "rotate-90")} />
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="border-t border-border/40 px-2.5 py-2 space-y-2">
            {/* 思考小组(有思考才显示) */}
            {thinkingParts.length > 0 ? <ReasoningGroup parts={thinkingParts} /> : null}
            {/* 工具小组(有工具才显示) */}
            {toolParts.length > 0 ? <ToolGroup parts={toolParts} /> : null}
          </div>
        </div>
      </div>
    </div>
  );
});
