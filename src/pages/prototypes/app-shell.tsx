import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Titlebar, StatusBar } from "./titlebar-status";
import { useModeStore } from "./mode-store";
import { TaskSidebar } from "./task-sidebar";
import { AgentMain } from "./agent-main";
import { SessionSidebar } from "./session-sidebar";
import { ChatMain } from "./chat-main";
import { DesignView } from "./design-view";
import { SettingsPanel } from "./settings-panel";

/**
 * LXCode 应用框架:三种大模式各自独立框架,标题栏全局切换。
 * - agent:  任务列表 + 任务执行流(无代码编辑器)
 * - coding:  会话列表 + (文件树 | 对话 + Monaco)
 * - design:  设计工作台(左中右)
 * 三种模式各自独立会话,切换后整个侧栏+主区都换。
 */
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
      ) : mode === "coding" ? (
        <ResizablePanelGroup orientation="horizontal" className="flex-1">
          <ResizablePanel defaultSize="24" minSize="16" maxSize="32">
            <SessionSidebar />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize="76" minSize="40">
            <ChatMain />
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        <div className="flex-1 overflow-hidden">
          <DesignView />
        </div>
      )}
      <StatusBar />
      {/* 设置面板(覆盖层) */}
      <SettingsPanel />
    </div>
  );
}
