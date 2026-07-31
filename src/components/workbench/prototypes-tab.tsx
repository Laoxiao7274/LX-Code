import { useState } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { PROTOTYPES } from "@/pages/prototypes";
import { NavSidebar } from "@/components/workbench/nav-sidebar";
import { PreviewPane } from "@/components/workbench/preview-pane";
import { EventsSidebar } from "@/components/workbench/events-sidebar";
import { Empty } from "@/components/workbench/empty";

/**
 * 页面原型 Tab:
 * 左栏 = 所有原型页面清单(点击选中)
 * 中栏 = 选中原型的实时预览
 * 右栏 = 该原型对应的"事件/状态"清单(点击触发)
 */
export function PrototypesTab() {
  const [activeId, setActiveId] = useState(PROTOTYPES[0]?.id ?? "");
  const active = PROTOTYPES.find((p) => p.id === activeId);

  return (
    <ResizablePanelGroup orientation="horizontal">
      <ResizablePanel defaultSize="18" minSize="12" maxSize="28">
        <NavSidebar
          title="页面"
          items={PROTOTYPES.map((p) => ({ id: p.id, label: p.label }))}
          activeId={activeId}
          onSelect={setActiveId}
        />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize="57" minSize="30">
        <PreviewPane title={active?.label ?? ""}>
          {active ? <active.Component /> : <Empty />}
        </PreviewPane>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize="25" minSize="15" maxSize="45">
        <EventsSidebar
          title="事件 / 状态"
          events={active?.events ?? []}
          hint={active?.eventsHint}
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
