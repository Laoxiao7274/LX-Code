import { useState } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { PanelRightClose, FolderTree, ListTodo } from "lucide-react";
import { FileTree } from "./file-tree";
import { CodeEditor } from "./code-editor";
import { ChatPrototype } from "./chat";
import { TaskPlanner } from "./task-planner";
import { useAgentStore } from "./agent-task-store";
import { cn } from "@/lib/utils";

type SideTab = "files" | "plan";

/**
 * Coding 模式视图(三栏,避免拥挤):
 * 会话列表(外层) | 对话+代码编辑器(主体) | 右侧面板(Tab:文件/任务规划,可折叠)
 *
 * 右侧用 Tab 切换文件树与任务规划,不再同时占两栏;
 * 折叠后变成一条图标竖栏,点击重新展开。
 */
export function CodingView() {
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<SideTab>("plan");
  const tasks = useAgentStore((s) => s.tasks);
  const activeId = useAgentStore((s) => s.activeId);
  const active = tasks.find((t) => t.id === activeId);

  return (
    <ResizablePanelGroup orientation="horizontal" className="h-full">
      {/* 主体:对话 + Monaco */}
      <ResizablePanel defaultSize={open ? 74 : 96} minSize={50}>
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

      {/* 右侧面板 */}
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={open ? 26 : 4} minSize={open ? 18 : 4} maxSize={36}>
        {open ? (
          <div className="flex h-full flex-col">
            {/* 顶部:Tab 切换 + 收起按钮 */}
            <div className="flex h-8 items-center gap-0.5 border-b border-border/60 bg-muted/20 px-1.5">
              <button
                type="button"
                onClick={() => setTab("files")}
                className={cn(
                  "flex h-6 items-center gap-1 rounded px-2 text-[11px] font-medium transition-colors",
                  tab === "files" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <FolderTree className="h-3 w-3" />
                文件
              </button>
              <button
                type="button"
                onClick={() => setTab("plan")}
                className={cn(
                  "flex h-6 items-center gap-1 rounded px-2 text-[11px] font-medium transition-colors",
                  tab === "plan" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <ListTodo className="h-3 w-3" />
                任务规划
              </button>
              <div className="flex-1" />
              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" onClick={() => setOpen(false)} title="收起侧栏">
                <PanelRightClose className="h-3.5 w-3.5" />
              </Button>
            </div>
            {/* 内容 */}
            <div className="flex-1 overflow-hidden">
              {tab === "files" ? <FileTree /> : <TaskPlanner activeTask={active} embedded />}
            </div>
          </div>
        ) : (
          // 折叠态:竖向图标条
          <div className="flex h-full flex-col items-center gap-1 border-l border-border/60 bg-muted/20 py-1.5">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:bg-muted" onClick={() => { setOpen(true); setTab("files"); }} title="文件">
              <FolderTree className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:bg-muted" onClick={() => { setOpen(true); setTab("plan"); }} title="任务规划">
              <ListTodo className="h-4 w-4" />
            </Button>
          </div>
        )}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
