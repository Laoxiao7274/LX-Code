import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "../../components/ui/resizable";
import { Titlebar } from "./titlebar-status";
import { ModeSwitcher } from "./mode-switcher";
import { SessionSidebar } from "../sidebar/session-sidebar";
import { ChatMain } from "../chat/chat-main";
import { SettingsPanel } from "../settings/settings-panel";
import { useModeStore } from "../../stores/mode-store";
import { useRef, useState } from "react";
import type { PanelImperativeHandle } from "react-resizable-panels";
import { Bot } from "lucide-react";

/** 应用框架:标题栏(含模式切换) + (侧栏 | 主区) + 状态栏 + 设置覆盖层。 */
export function AppShell() {
  const mode = useModeStore((s) => s.mode);
  // 左侧项目栏折叠(chat 模式)
  const leftPanelRef = useRef<PanelImperativeHandle>(null);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const toggleLeft = () => {
    const ref = leftPanelRef.current;
    if (!ref) return;
    if (leftCollapsed) ref.expand();
    else ref.collapse();
  };

  return (
    <div className="surface relative flex h-full flex-col overflow-hidden rounded-xl">
      <Titlebar />
      {mode === "agent" ? (
        <div className="flex flex-1 items-center justify-center bg-muted/10 p-8">
          <div className="flex max-w-md flex-col items-center gap-4 rounded-2xl border border-border/50 bg-background/60 px-10 py-12 text-center shadow-sm backdrop-blur-sm">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent">
              <Bot className="h-7 w-7" />
            </div>
            <div>
              <div className="text-base font-semibold tracking-tight">Agent 模式开发中</div>
              <div className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
                自主任务执行流(目标→思考→工具→结果)正在开发,暂时请用 Coding 模式对话。
              </div>
            </div>
            <div className="mt-1 flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-medium text-amber-600">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              WIP
            </div>
          </div>
        </div>
      ) : (
        <ResizablePanelGroup orientation="horizontal" className="flex-1">
          <ResizablePanel
            panelRef={leftPanelRef}
            defaultSize="18"
            minSize="14"
            maxSize="28"
            collapsible
            collapsedSize="4"
            onResize={() => {
              // 用 isCollapsed() 准确判断折叠状态(避免百分比阈值抖动)
              setLeftCollapsed(!!leftPanelRef.current?.isCollapsed());
            }}
          >
            <SessionSidebar collapsed={leftCollapsed} onToggleCollapse={toggleLeft} />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize="82" minSize="40">
            <ChatMain />
          </ResizablePanel>
        </ResizablePanelGroup>
      )}
      {/* 设置面板(覆盖层) */}
      <SettingsPanel />
    </div>
  );
}
