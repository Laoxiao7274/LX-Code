import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Component, Wand2, MousePointerClick } from "lucide-react";
import { Logo } from "@/components/ui/logo";

const NAV = [
  { id: "components", label: "组件库" },
  { id: "prototypes", label: "页面原型" },
  { id: "animations", label: "动画" },
];

const PREVIEW_CARDS = [
  { title: "AppShell", desc: "标题栏 + 侧栏 + 主区 + 状态栏" },
  { title: "ChatPrototype", desc: "对话流 + 思考块 + 工具调用" },
  { title: "EmptyState", desc: "居中 Logo + 建议卡入场" },
];

const EVENTS = [
  { id: "toggle-theme", label: "切换主题", desc: "浅色 / 深色" },
  { id: "preview-mobile", label: "移动预览", desc: "375px 视口" },
  { id: "export", label: "导出截图", desc: "保存当前预览" },
];

/**
 * 设计模式视图:左中右工作台布局。
 * 左 = 导航(组件/原型/动画),中 = 预览区,右 = 事件调试。
 * 复用工作台的设计资产,作为应用内的「设计视角」。
 */
export function DesignView() {
  return (
    <ResizablePanelGroup orientation="horizontal">
      <ResizablePanel defaultSize="20" minSize="14" maxSize="30">
        <aside className="flex h-full flex-col border-r border-border/60 bg-muted/25">
          <div className="px-3 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            设计资产
          </div>
          <div className="flex-1 overflow-y-auto px-1.5">
            <ul className="space-y-0.5">
              {NAV.map((n, i) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={`relative flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors ${
                      i === 0
                        ? "bg-background text-foreground shadow-sm"
                        : "text-foreground/80 hover:bg-background/60"
                    }`}
                  >
                    {i === 0 ? (
                      <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-accent" />
                    ) : null}
                    <Component className="h-3.5 w-3.5 text-muted-foreground" />
                    {n.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize="58" minSize="30">
        <main className="flex h-full flex-col bg-background">
          <header className="flex h-10 items-center gap-2 border-b border-border/60 px-4">
            <Wand2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[13px] font-medium">预览:AppShell</span>
            <Badge variant="outline" className="h-4 px-1.5 text-[10px] font-normal text-muted-foreground">
              原型
            </Badge>
          </header>
          <div className="flex flex-1 items-center justify-center overflow-auto p-6">
            <div className="surface flex h-full max-h-[420px] w-full max-w-2xl flex-col items-center justify-center gap-4 rounded-xl p-8 text-center">
              <Logo size={40} className="text-accent/80" />
              <div className="space-y-1">
                <div className="text-lg font-semibold tracking-tight">设计预览区</div>
                <div className="text-xs text-muted-foreground font-mono">AppShell · 1280 × 800</div>
              </div>
              <div className="grid w-full grid-cols-3 gap-2">
                {PREVIEW_CARDS.map((c) => (
                  <div key={c.title} className="surface-flat rounded-lg p-2.5 text-left">
                    <div className="font-mono text-[11px] font-medium">{c.title}</div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">{c.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize="22" minSize="16" maxSize="32">
        <aside className="flex h-full flex-col border-l border-border/60 bg-muted/25">
          <div className="px-3 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            事件调试
          </div>
          <div className="px-3 pb-2 text-[11px] text-muted-foreground/80">点击触发预览区响应</div>
          <div className="flex-1 overflow-y-auto px-1.5">
            <ul className="space-y-1">
              {EVENTS.map((e) => (
                <li key={e.id}>
                  <button className="w-full rounded-lg bg-background/50 px-2.5 py-2 text-left transition-colors hover:bg-background hover:shadow-sm">
                    <div className="flex items-center gap-1.5">
                      <MousePointerClick className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[13px] font-medium">{e.label}</span>
                    </div>
                    <div className="mt-0.5 pl-4 text-[11px] text-muted-foreground/80">{e.desc}</div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="border-t border-border/60 p-2">
            <Button variant="outline" size="sm" className="w-full text-xs">
              打开完整工作台
            </Button>
          </div>
        </aside>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
