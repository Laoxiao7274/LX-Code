import { useState } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { COMPONENTS } from "@/pages/components-demo";
import { NavSidebar } from "@/components/workbench/nav-sidebar";
import { PreviewPane } from "@/components/workbench/preview-pane";
import { Empty } from "@/components/workbench/empty";

/**
 * 组件调试场 Tab:
 * 左栏 = 所有已接入组件清单(点击选中)
 * 右栏 = 选中组件的实时预览 + 说明
 */
export function ComponentsTab() {
  const [activeId, setActiveId] = useState(COMPONENTS[0]?.id ?? "");
  const active = COMPONENTS.find((c) => c.id === activeId);

  return (
    <ResizablePanelGroup orientation="horizontal">
      <ResizablePanel defaultSize="22" minSize="14" maxSize="35">
        <NavSidebar
          title="组件"
          items={COMPONENTS.map((c) => ({ id: c.id, label: c.label }))}
          activeId={activeId}
          onSelect={setActiveId}
        />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize="78" minSize="40">
        <PreviewPane title={active?.label ?? ""} description={active?.description}>
          {active ? <active.Component /> : <Empty />}
        </PreviewPane>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
