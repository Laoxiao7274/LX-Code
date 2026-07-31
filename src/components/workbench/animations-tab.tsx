import { useState } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Badge } from "@/components/ui/badge";
import { ANIMATIONS } from "@/pages/animations-demo";
import { NavSidebar } from "@/components/workbench/nav-sidebar";
import { PreviewPane } from "@/components/workbench/preview-pane";
import { Empty } from "@/components/workbench/empty";

/**
 * 动画演示 Tab:
 * 左栏 = 已注册的 GSAP 动画清单(带 tag 标签)
 * 右栏 = 选中动画的实时预览。
 * 与组件调试场同构,便于复用工作台框架。
 */
export function AnimationsTab() {
  const [activeId, setActiveId] = useState(ANIMATIONS[0]?.id ?? "");
  const active = ANIMATIONS.find((a) => a.id === activeId);

  return (
    <ResizablePanelGroup orientation="horizontal">
      <ResizablePanel defaultSize="22" minSize="14" maxSize="35">
        <NavSidebar
          title="动画"
          items={ANIMATIONS.map((a) => ({ id: a.id, label: a.label }))}
          activeId={activeId}
          onSelect={setActiveId}
        />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize="78" minSize="40">
        <PreviewPane title={active?.label ?? ""} description={active?.description}>
          {active ? (
            <div className="space-y-3">
              <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
                {active.tag}
              </Badge>
              <active.Component />
            </div>
          ) : (
            <Empty />
          )}
        </PreviewPane>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
