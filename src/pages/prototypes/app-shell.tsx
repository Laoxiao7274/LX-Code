import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Titlebar, StatusBar } from "./titlebar-status";
import { SessionSidebar } from "./session-sidebar";
import { ChatMain } from "./chat-main";

/**
 * LXCode 应用框架 —— 整个桌面应用的骨架。
 * 标题栏 + (会话侧栏 | 对话主区) + 状态栏。
 * 这是「页面原型」Tab 中栏渲染的完整应用,而非单个孤立页面。
 */
export function AppShell() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-md border border-border bg-background">
      <Titlebar />
      <ResizablePanelGroup orientation="horizontal" className="flex-1">
        <ResizablePanel defaultSize="24" minSize="16" maxSize="32">
          <SessionSidebar />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize="76" minSize="40">
          <ChatMain />
        </ResizablePanel>
      </ResizablePanelGroup>
      <StatusBar />
    </div>
  );
}
