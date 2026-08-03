import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "../../components/ui/resizable";
import { Titlebar, StatusBar } from "./titlebar-status";
import { SessionSidebar } from "../sidebar/session-sidebar";
import { ChatMain } from "../chat/chat-main";

/** 应用框架:标题栏 + (会话侧栏 | 对话主区) + 状态栏。 */
export function AppShell() {
  return (
    <div className="surface flex h-full flex-col overflow-hidden rounded-xl">
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
