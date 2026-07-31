import { useEffect, useState } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { SCENES, AppFrame } from "@/pages/prototypes/scenes";
import { NavSidebar } from "@/components/workbench/nav-sidebar";
import { PreviewPane } from "@/components/workbench/preview-pane";
import { EventsSidebar } from "@/components/workbench/events-sidebar";

/**
 * 页面原型 Tab:
 * 左栏 = 场景预设(切换整个应用的不同状态)
 * 中栏 = 完整应用框架 AppShell(自带会话侧栏 + 对话主区)
 * 右栏 = 当前场景可触发的事件(真实生效于应用)
 */
export function PrototypesTab() {
  const [activeId, setActiveId] = useState(SCENES[0]?.id ?? "");
  const active = SCENES.find((s) => s.id === activeId);

  // 进入场景时执行其 enter,把应用置成对应状态
  useEffect(() => {
    active?.enter?.();
  }, [active, activeId]);

  return (
    <ResizablePanelGroup orientation="horizontal">
      <ResizablePanel defaultSize="16" minSize="12" maxSize="24">
        <NavSidebar
          title="场景"
          items={SCENES.map((s) => ({ id: s.id, label: s.label }))}
          activeId={activeId}
          onSelect={setActiveId}
        />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize="60" minSize="30">
        <PreviewPane
          title={active?.label ?? ""}
          description={active?.description}
        >
          <AppFrame />
        </PreviewPane>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize="24" minSize="15" maxSize="40">
        <EventsSidebar
          title="事件"
          events={active?.events ?? []}
          hint={active?.eventsHint}
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
