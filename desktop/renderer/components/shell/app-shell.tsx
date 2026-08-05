import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "../../components/ui/resizable";
import { Titlebar } from "./titlebar-status";
import { ModeSwitcher } from "./mode-switcher";
import { SessionSidebar } from "../sidebar/session-sidebar";
import { TaskSidebar } from "../sidebar/task-sidebar";
import { ChatMain } from "../chat/chat-main";
import { AgentMain } from "../chat/agent-main";
import { SettingsPanel } from "../settings/settings-panel";
import { RightPanel } from "./right-panel";
import { useModeStore } from "../../stores/mode-store";
import { useRef, useState } from "react";
import type { PanelImperativeHandle } from "react-resizable-panels";

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
        <ResizablePanelGroup orientation="horizontal" className="flex-1">
          <ResizablePanel defaultSize="24" minSize="16" maxSize="32">
            <TaskSidebar />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize="76" minSize="40">
            <AgentMain />
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        <ResizablePanelGroup orientation="horizontal" className="flex-1">
          <ResizablePanel
            panelRef={leftPanelRef}
            defaultSize="18"
            minSize="14"
            maxSize="28"
            collapsible
            collapsedSize="4"
            onResize={(size) => {
              // size.percentage <= collapsedSize 视为折叠(同步给 SessionSidebar 渲染)
              const pct = typeof size.percentage === "number" ? size.percentage : 0;
              setLeftCollapsed(pct <= 5);
            }}
          >
            <SessionSidebar collapsed={leftCollapsed} onToggleCollapse={toggleLeft} />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize="82" minSize="40">
            <RightPanel>
              <ChatMain />
            </RightPanel>
          </ResizablePanel>
        </ResizablePanelGroup>
      )}
      {/* 设置面板(覆盖层) */}
      <SettingsPanel />
    </div>
  );
}
