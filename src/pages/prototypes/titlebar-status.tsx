import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useChatStore } from "@/pages/prototypes/chat-store";
import { cn } from "@/lib/utils";

/**
 * 应用标题栏:logo + 应用名 + 副标题。
 */
export function Titlebar() {
  return (
    <div className="flex h-10 items-center gap-2.5 border-b border-border/60 bg-muted/30 px-3.5 select-none">
      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-foreground text-[11px] font-bold text-background">
        LX
      </div>
      <span className="text-[13px] font-semibold tracking-tight">LXCode</span>
      <Separator orientation="vertical" className="mx-1 h-4" />
      <span className="text-xs text-muted-foreground">本地编码助手</span>
    </div>
  );
}

/**
 * 应用状态栏:状态点 + 模型 + 消息数(等宽数字)。
 * 信号点仅在生成时呼吸,空闲时静态。
 */
export function StatusBar() {
  const isGenerating = useChatStore((s) => s.isGenerating);
  const messages = useChatStore((s) => s.messages);

  return (
    <div className="flex h-7 items-center gap-2.5 border-t border-border/60 bg-muted/20 px-3.5 text-[11px] text-muted-foreground">
      <span className={cn("signal-dot", isGenerating && "signal-dot-live")} aria-hidden />
      <span className="font-medium">{isGenerating ? "生成中" : "就绪"}</span>
      <Separator orientation="vertical" className="h-3.5" />
      <span className="font-mono">claude-sonnet-4</span>
      <Separator orientation="vertical" className="h-3.5" />
      <span className="font-mono tabular-nums">{messages.length} 条消息</span>
      <div className="flex-1" />
      <Badge variant="outline" className="h-4 px-1.5 text-[10px] font-normal opacity-60">
        v0.1.0
      </Badge>
    </div>
  );
}
