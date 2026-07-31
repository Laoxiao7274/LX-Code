import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useChatStore } from "@/pages/prototypes/chat-store";

/**
 * 应用标题栏:logo + 应用名 + 当前会话(拖拽区)。
 * 渐变背景 + 微妙下边线,营造窗口顶部质感。
 */
export function Titlebar() {
  return (
    <div className="relative flex h-10 items-center gap-2.5 border-b border-border/60 bg-gradient-to-b from-muted/50 to-transparent px-3.5 select-none">
      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-accent to-accent/70 text-[11px] font-bold text-accent-foreground shadow-sm">
        LX
      </div>
      <span className="text-[13px] font-semibold tracking-tight">LXCode</span>
      <Separator orientation="vertical" className="mx-1 h-4" />
      <span className="text-xs text-muted-foreground">本地编码助手</span>
    </div>
  );
}

/**
 * 应用状态栏:信号点 + 模型 + token 计数。
 * 信号点是整个应用的签名元素:就绪/生成中呼吸光。
 */
export function StatusBar() {
  const isGenerating = useChatStore((s) => s.isGenerating);
  const messages = useChatStore((s) => s.messages);

  return (
    <div className="flex h-7 items-center gap-2.5 border-t border-border/60 bg-muted/30 px-3.5 text-[11px] text-muted-foreground">
      <span className="signal-dot" aria-hidden />
      <span className="font-medium">{isGenerating ? "生成中" : "就绪"}</span>
      <Separator orientation="vertical" className="h-3.5" />
      <span className="tabular-nums">claude-sonnet-4</span>
      <Separator orientation="vertical" className="h-3.5" />
      <span className="tabular-nums">{messages.length} 条消息</span>
      <div className="flex-1" />
      <Badge variant="outline" className="h-4 px-1.5 text-[10px] font-normal opacity-70">
        v0.1.0
      </Badge>
    </div>
  );
}
