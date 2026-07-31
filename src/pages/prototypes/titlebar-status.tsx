import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useChatStore } from "@/pages/prototypes/chat-store";

/**
 * 应用标题栏:logo + 应用名 + 拖拽区(原生,窗口控制是特殊区域)。
 * 桌面应用标题栏通常需要原生,非调试场基础原语范畴。
 */
export function Titlebar() {
  return (
    <div className="flex h-9 items-center gap-2 border-b border-border px-3 select-none">
      <div className="flex h-5 w-5 items-center justify-center rounded bg-primary text-[10px] font-bold text-primary-foreground">
        LX
      </div>
      <span className="text-sm font-semibold">LXCode</span>
    </div>
  );
}

/**
 * 应用状态栏:模型 + 运行状态 + token 计数。
 */
export function StatusBar() {
  const isGenerating = useChatStore((s) => s.isGenerating);
  const messages = useChatStore((s) => s.messages);

  return (
    <div className="flex h-6 items-center gap-2 border-t border-border px-3 text-xs text-muted-foreground">
      <Badge variant={isGenerating ? "default" : "secondary"} className="h-4 px-1.5 text-[10px]">
        {isGenerating ? "生成中" : "空闲"}
      </Badge>
      <Separator orientation="vertical" className="h-3" />
      <span>claude-sonnet-4</span>
      <Separator orientation="vertical" className="h-3" />
      <span>{messages.length} 条消息</span>
      <div className="flex-1" />
      <span className="opacity-60">就绪</span>
    </div>
  );
}
