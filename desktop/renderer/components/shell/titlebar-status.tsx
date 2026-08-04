import { useEffect, useState } from "react";
import { Logo } from "../../components/ui/logo";
import { Separator } from "../../components/ui/separator";
import { ModeSwitcher } from "./mode-switcher";

/** 窗口控制按钮(最小化/最大化/关闭)。 */
function WindowButtons() {
  const [maximized, setMaximized] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.lxcode?.win) return;
    void window.lxcode.win.isMaximized().then(setMaximized);
    const off = window.lxcode.win.onMaximizedChange(setMaximized);
    return off;
  }, []);

  return (
    <div className="flex items-center" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
      <button
        type="button"
        onClick={() => window.lxcode?.win?.minimize()}
        className="flex h-8 w-10 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        title="最小化"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
          <rect x="3" y="7.5" width="10" height="1.2" rx="0.6" fill="currentColor" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => window.lxcode?.win?.maximize()}
        className="flex h-8 w-10 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        title={maximized ? "还原" : "最大化"}
      >
        {maximized ? (
          <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
            <rect x="3.5" y="5" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" />
            <path d="M5.5 5 V3.5 H12.5 V10.5 H11" stroke="currentColor" strokeWidth="1.2" fill="none" />
          </svg>
        ) : (
          <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
            <rect x="3.5" y="3.5" width="9" height="9" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" />
          </svg>
        )}
      </button>
      <button
        type="button"
        onClick={() => window.lxcode?.win?.close()}
        className="flex h-8 w-10 items-center justify-center text-muted-foreground transition-colors hover:bg-red-500/90 hover:text-white"
        title="关闭"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
          <path d="M4 4 L12 12 M12 4 L4 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

/** 标题栏:Logo + 应用名 + 模式切换 + 窗口控制(无边框窗口)。 */
export function Titlebar() {
  return (
    <div
      className="flex h-10 items-center gap-2.5 border-b border-border/60 bg-muted/30 px-3.5 select-none"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      <Logo size={20} />
      <span className="text-[13px] font-semibold tracking-tight">LXCode</span>
      <Separator orientation="vertical" className="mx-1 h-4" />
      <span className="text-xs text-muted-foreground">AI 编码助手</span>
      <div className="flex-1" />
      <div style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
        <ModeSwitcher />
      </div>
      <Separator orientation="vertical" className="mx-1 h-4" />
      <WindowButtons />
    </div>
  );
}
