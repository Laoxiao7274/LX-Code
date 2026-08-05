import { useRef, useState } from "react";
import type { PanelImperativeHandle } from "react-resizable-panels";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "../../components/ui/resizable";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { DigestView } from "../digest/digest-panel";
import { useSessionStore } from "../../stores/session-store";
import {
  PanelRightClose, PanelRightOpen, Map, FolderTree, ListTodo,
} from "lucide-react";

type SideTab = "map" | "files" | "plan";

/**
 * 对话页右侧折叠面板(Tab:项目地图/文件/任务规划)。
 * 用 collapsible + panelRef 控制折叠(和左侧侧栏一致机制),拖拽自动折叠/展开。
 */
export function RightPanel({ children }: { children: React.ReactNode }) {
  const panelRef = useRef<PanelImperativeHandle>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [tab, setTab] = useState<SideTab>("map");

  const toggle = () => {
    const ref = panelRef.current;
    if (!ref) return;
    if (collapsed) ref.expand();
    else ref.collapse();
  };

  // 当前会话所属项目 cwd(给 digest 用)
  const projects = useSessionStore((s) => s.projects);
  const activeId = useSessionStore((s) => s.activeId);
  let cwd = "";
  for (const p of projects) {
    if (p.sessions.some((s) => s.id === activeId)) { cwd = p.path; break; }
  }

  const tabs: { id: SideTab; label: string; Icon: typeof Map }[] = [
    { id: "map", label: "项目地图", Icon: Map },
    { id: "files", label: "文件", Icon: FolderTree },
    { id: "plan", label: "任务规划", Icon: ListTodo },
  ];

  return (
    <ResizablePanelGroup orientation="horizontal" className="h-full">
      {/* 左:对话主体 */}
      <ResizablePanel defaultSize="76" minSize="50">
        {children}
      </ResizablePanel>

      {/* 右:折叠面板 */}
      <ResizableHandle withHandle />
      <ResizablePanel
        panelRef={panelRef}
        defaultSize="24"
        minSize="16"
        maxSize="34"
        collapsible
        collapsedSize="4"
        onResize={() => {
          setCollapsed(!!panelRef.current?.isCollapsed());
        }}
      >
        {collapsed ? (
          // 折叠态:图标竖栏
          <div className="flex h-full flex-col items-center gap-1 border-l border-border/60 bg-muted/20 py-1.5">
            {tabs.map((t) => {
              const Icon = t.Icon;
              return (
                <Button
                  key={t.id}
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-7 w-7 hover:bg-muted",
                    tab === t.id ? "text-accent" : "text-muted-foreground",
                  )}
                  onClick={() => { setTab(t.id); toggle(); }}
                  title={t.label}
                >
                  <Icon className="h-4 w-4" />
                </Button>
              );
            })}
            <div className="mt-auto">
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:bg-muted" onClick={toggle} title="展开侧栏">
                <PanelRightOpen className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col border-l border-border/60 bg-muted/15">
            {/* Tab 栏 */}
            <div className="flex h-8 shrink-0 items-center gap-0.5 border-b border-border/60 bg-muted/20 px-1.5">
              {tabs.map((t) => {
                const Icon = t.Icon;
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={cn(
                      "flex h-6 items-center gap-1 rounded px-2 text-[11px] font-medium transition-colors",
                      active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    {t.label}
                  </button>
                );
              })}
              <div className="flex-1" />
              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" onClick={toggle} title="收起侧栏">
                <PanelRightClose className="h-3.5 w-3.5" />
              </Button>
            </div>
            {/* Tab 内容 */}
            <div className="flex-1 overflow-hidden">
              {tab === "map" ? (
                cwd ? <DigestView cwd={cwd} /> : (
                  <div className="flex h-full items-center justify-center px-4 text-center text-[12px] text-muted-foreground">
                    选择一个项目会话以查看地图
                  </div>
                )
              ) : tab === "files" ? (
                <div className="flex h-full items-center justify-center text-[12px] text-muted-foreground/60">
                  文件树(待接入)
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-[12px] text-muted-foreground/60">
                  任务规划(待接入)
                </div>
              )}
            </div>
          </div>
        )}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
