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
import { DigestPanel } from "../digest/digest-panel";
import { useModeStore } from "../../stores/mode-store";

/** 应用框架:标题栏(含模式切换) + (侧栏 | 主区) + 状态栏 + 设置覆盖层。 */
export function AppShell() {
  const mode = useModeStore((s) => s.mode);

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
          <ResizablePanel defaultSize="18" minSize="14" maxSize="28">
            <SessionSidebar />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize="82" minSize="40">
            <ChatMain />
          </ResizablePanel>
        </ResizablePanelGroup>
      )}
      {/* 设置面板(覆盖层) */}
      <SettingsPanel />
      {/* digest 项目地图面板(覆盖层) */}
      <DigestPanel />
    </div>
  );
}
