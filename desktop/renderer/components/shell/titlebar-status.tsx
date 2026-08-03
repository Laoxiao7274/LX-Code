import { Logo } from "../../components/ui/logo";
import { Separator } from "../../components/ui/separator";
import { ModeSwitcher } from "./mode-switcher";
import { useChatStore } from "../../stores/chat-store";
import { cn } from "../../lib/utils";

/** 标题栏:Logo + 应用名 + 模式切换。 */
export function Titlebar() {
  return (
    <div className="flex h-10 items-center gap-2.5 border-b border-border/60 bg-muted/30 px-3.5 select-none">
      <Logo size={20} />
      <span className="text-[13px] font-semibold tracking-tight">LXCode</span>
      <Separator orientation="vertical" className="mx-1 h-4" />
      <span className="text-xs text-muted-foreground">AI 编码助手</span>
      <div className="flex-1" />
      <ModeSwitcher />
    </div>
  );
}

/** 状态栏:状态点 + 模型 + 消息数。 */
export function StatusBar() {
  const isGenerating = useChatStore((s) => s.isGenerating);
  return (
    <div className="flex h-7 items-center gap-2.5 border-t border-border/60 bg-muted/20 px-3.5 text-[11px] text-muted-foreground">
      <span className={cn("signal-dot", isGenerating && "signal-dot-live")} aria-hidden />
      <span className="font-medium">{isGenerating ? "运行中" : "就绪"}</span>
      <Separator orientation="vertical" className="h-3.5" />
      <span className="font-mono">pi-core 0.83.0</span>
      <div className="flex-1" />
      <span className="opacity-60">v0.1.0</span>
    </div>
  );
}
