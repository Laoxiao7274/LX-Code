import { Logo } from "../../components/ui/logo";
import { Separator } from "../../components/ui/separator";
import { ModeSwitcher } from "./mode-switcher";

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
