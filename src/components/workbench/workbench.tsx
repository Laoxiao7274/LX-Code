import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Logo } from "@/components/ui/logo";
import { PrototypesTab } from "@/components/workbench/prototypes-tab";
import { ComponentsTab } from "@/components/workbench/components-tab";
import { AnimationsTab } from "@/components/workbench/animations-tab";

/**
 * 工作台:顶部品牌头 + 两个 Tab(页面原型 / 组件调试场)。
 * 每个 Tab 内部都是"左侧导航侧栏 + 右侧预览区"的可调宽布局。
 */
export function Workbench() {
  const [tab, setTab] = useState("prototypes");

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      {/* 品牌头 */}
      <header className="flex h-11 items-center gap-2.5 border-b border-border/60 bg-muted/30 px-4">
        <Logo size={22} />
        <span className="text-[13px] font-semibold tracking-tight">LXCode</span>
        <span className="text-xs text-muted-foreground">设计工作台</span>
        <div className="flex-1" />
        <span className="text-[11px] text-muted-foreground/70">v0.1.0 · 设计阶段</span>
      </header>

      <Tabs value={tab} onValueChange={setTab} className="flex flex-1 flex-col overflow-hidden">
        <div className="border-b border-border/60 bg-muted/20 px-3 pt-2">
          <TabsList>
            <TabsTrigger value="prototypes">页面原型</TabsTrigger>
            <TabsTrigger value="components">组件调试场</TabsTrigger>
            <TabsTrigger value="animations">动画演示</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="prototypes" className="mt-0 flex-1 overflow-hidden">
          <PrototypesTab />
        </TabsContent>
        <TabsContent value="components" className="mt-0 flex-1 overflow-hidden">
          <ComponentsTab />
        </TabsContent>
        <TabsContent value="animations" className="mt-0 flex-1 overflow-hidden">
          <AnimationsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
