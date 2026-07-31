import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PrototypesTab } from "@/components/workbench/prototypes-tab";
import { ComponentsTab } from "@/components/workbench/components-tab";

/**
 * 工作台:两个 Tab —— 页面原型 / 组件调试场。
 * 每个 Tab 内部都是"左侧导航侧栏 + 右侧预览区"的可调宽布局。
 */
export function Workbench() {
  const [tab, setTab] = useState("prototypes");

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <Tabs value={tab} onValueChange={setTab} className="flex h-full flex-col">
        <div className="border-b border-border px-3 pt-2">
          <TabsList>
            <TabsTrigger value="prototypes">页面原型</TabsTrigger>
            <TabsTrigger value="components">组件调试场</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="prototypes" className="mt-0 flex-1 overflow-hidden">
          <PrototypesTab />
        </TabsContent>
        <TabsContent value="components" className="mt-0 flex-1 overflow-hidden">
          <ComponentsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
