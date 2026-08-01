import { useState } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { PanelLeftClose, PanelLeft, ListTodo } from "lucide-react";
import { FileTree } from "./file-tree";
import { CodeEditor } from "./code-editor";
import { ChatPrototype } from "./chat";
import { TaskPlanner } from "./task-planner";
import { useAgentStore } from "./agent-task-store";

/**
 * Coding 模式视图(横向多栏):
 * 会话列表(外层 AppShell) | 对话+代码编辑器(主体) | 文件树(右侧可折叠) | 任务规划(右侧可折叠)
 *
 * Coding agent 工作流:先做任务规划(最右),然后边对话边改代码,
 * 文件树展示改动文件,均可折叠收起以腾出主体空间。
 */
export function CodingView() {
  const [filesOpen, setFilesOpen] = useState(true);
  const [planOpen, setPlanOpen] = useState(true);
  const tasks = useAgentStore((s) => s.tasks);
  const activeId = useAgentStore((s) => s.activeId);
  const active = tasks.find((t) => t.id === activeId);

  return (
    <ResizablePanelGroup orientation="horizontal" className="h-full">
      {/* 主体:对话 + Monaco */}
      <ResizablePanel defaultSize={filesOpen && planOpen ? 60 : 80} minSize={40}>
        <ResizablePanelGroup orientation="vertical">
          <ResizablePanel defaultSize={45} minSize={18}>
            <div className="h-full p-2">
              <ChatPrototype />
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={55} minSize={18}>
            <CodeEditor />
          </ResizablePanel>
        </ResizablePanelGroup>
      </ResizablePanel>

      {/* 文件树栏:展开时用 ResizablePanel,收起时用固定窄条 */}
      {filesOpen ? (
        <>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={20} minSize={10} maxSize={30}>
            <div className="flex h-full flex-col">
              <div className="flex h-8 items-center justify-between border-b border-border/60 bg-muted/20 pr-1 pl-3">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">文件</span>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" onClick={() => setFilesOpen(false)}>
                  <PanelLeftClose className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex-1 overflow-hidden">
                <FileTree />
              </div>
            </div>
          </ResizablePanel>
        </>
      ) : (
        <Button variant="ghost" size="icon" onClick={() => setFilesOpen(true)} title="展开文件树" className="mt-1 h-7 w-7 self-start rounded-md text-muted-foreground hover:bg-muted">
          <PanelLeft className="h-4 w-4" />
        </Button>
      )}

      {/* 任务规划栏 */}
      {planOpen ? (
        <>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={18} minSize={12} maxSize={28}>
            <TaskPlanner activeTask={active} onClose={() => setPlanOpen(false)} />
          </ResizablePanel>
        </>
      ) : (
        <Button variant="ghost" size="icon" onClick={() => setPlanOpen(true)} title="展开任务规划" className="mt-1 h-7 w-7 self-start rounded-md text-muted-foreground hover:bg-muted">
          <ListTodo className="h-4 w-4" />
        </Button>
      )}
    </ResizablePanelGroup>
  );
}
