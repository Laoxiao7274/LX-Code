import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { FileTree } from "./file-tree";
import { CodeEditor } from "./code-editor";
import { ChatPrototype } from "./chat";

/**
 * Coding 模式视图:文件树 | (对话 + 代码编辑器)。
 * 左侧文件树,右侧上下分栏:上方对话,下方 Monaco 代码编辑器。
 * agent 改动代码时,用户能直接看到文件内容。
 */
export function CodingView() {
  return (
    <ResizablePanelGroup orientation="horizontal">
      <ResizablePanel defaultSize="18" minSize="12" maxSize="30">
        <FileTree />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize="82" minSize="40">
        <ResizablePanelGroup orientation="vertical">
          <ResizablePanel defaultSize="45" minSize="20">
            <div className="h-full p-2">
              <ChatPrototype />
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize="55" minSize="20">
            <CodeEditor />
          </ResizablePanel>
        </ResizablePanelGroup>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
