import { useRef, useState } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { useSettingsStore } from "../../stores/settings-store";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Separator } from "../ui/separator";
import { Badge } from "../ui/badge";
import {
  X, Settings, Cpu, Palette, Keyboard, Info, ChevronRight,
  Sun, Moon, Monitor,
  Globe, BookOpen, MessageCircle, GitBranch,
  Layers,
} from "lucide-react";
import { Logo } from "../ui/logo";
import { ModelConfigPanel } from "./model-config-panel";
import { UseCasePanel } from "./usecase-panel";
import { cn } from "../../lib/utils";

gsap.registerPlugin(useGSAP);

gsap.registerPlugin(useGSAP);

/** 分类定义。 */
const SECTIONS = [
  { id: "general", label: "通用", Icon: Settings },
  { id: "model", label: "模型", Icon: Cpu },
  { id: "usecase", label: "用途", Icon: Layers },
  { id: "appearance", label: "外观", Icon: Palette },
  { id: "keybindings", label: "快捷键", Icon: Keyboard },
  { id: "about", label: "关于", Icon: Info },
] as const;

/** 开关行。 */
function ToggleRow({ label, desc, defaultOn = false }: { label: string; desc?: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn);
  const knobRef = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      if (!knobRef.current) return;
      gsap.to(knobRef.current, {
        left: on ? 18 : 2,
        duration: 0.25,
        ease: "back.out(2)",
        overwrite: true,
      });
    },
    { dependencies: [on] },
  );

  return (
    <div className="flex items-center justify-between py-3">
      <div className="min-w-0">
        <div className="text-[13px] font-medium">{label}</div>
        {desc ? <div className="mt-0.5 text-[12px] text-muted-foreground">{desc}</div> : null}
      </div>
      <button
        type="button"
        onClick={() => setOn(!on)}
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200",
          on ? "bg-accent" : "bg-muted-foreground/30",
        )}
      >
        <span
          ref={knobRef}
          className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow"
          style={{ left: on ? 18 : 2 }}
        />
      </button>
    </div>
  );
}

/** 主题选择卡。 */
function ThemeRow() {
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const opts: { id: typeof theme; label: string; Icon: typeof Sun }[] = [
    { id: "light", label: "浅色", Icon: Sun },
    { id: "dark", label: "深色", Icon: Moon },
    { id: "system", label: "跟随系统", Icon: Monitor },
  ];
  const cardsRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const active = cardsRef.current?.querySelector(".theme-card-active");
      if (active) {
        gsap.fromTo(active, { scale: 0.92 }, { scale: 1, duration: 0.35, ease: "back.out(2.5)", overwrite: true });
      }
    },
    { scope: cardsRef, dependencies: [theme] },
  );

  return (
    <div className="py-3">
      <div className="mb-2 text-[13px] font-medium">主题</div>
      <div ref={cardsRef} className="grid grid-cols-3 gap-2">
        {opts.map((o) => {
          const active = theme === o.id;
          const Icon = o.Icon;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => setTheme(o.id)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-lg border p-3 transition-colors",
                active ? "theme-card-active border-accent bg-accent/5 text-accent" : "border-border/60 hover:bg-muted/40",
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="text-[12px] font-medium">{o.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** 快捷键行。 */
function KeyRow({ label, keys }: { label: string; keys: string }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-[13px]">{label}</span>
      <kbd className="rounded border border-border/60 bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
        {keys}
      </kbd>
    </div>
  );
}

/** 各分类内容。 */
function SectionContent({ id }: { id: string }) {
  if (id === "general") {
    return (
      <div>
        <h3 className="mb-1 text-base font-semibold">通用</h3>
        <p className="mb-2 text-[12px] text-muted-foreground">应用基础行为与默认值。</p>
        <Separator className="my-2 bg-border/60" />
        <ToggleRow label="自动保存会话" desc="关闭窗口前自动保存当前会话" defaultOn />
        <Separator className="bg-border/40" />
        <ToggleRow label="发送后清空输入" desc="回车发送消息后自动清空输入框" defaultOn />
        <Separator className="bg-border/40" />
        <ToggleRow label="显示工具调用细节" desc="在对话中展开工具调用输出" defaultOn />
        <Separator className="bg-border/40" />
        <div className="flex items-center justify-between py-3">
          <div>
            <div className="text-[13px] font-medium">工作目录</div>
            <div className="mt-0.5 text-[12px] text-muted-foreground">agent 操作的根目录</div>
          </div>
          <Input className="h-8 w-64 font-mono text-[12px]" defaultValue="C:/Users/xzy/Desktop/my/lx-code" />
        </div>
      </div>
    );
  }
  if (id === "model") {
    return (
      <div>
        <h3 className="mb-1 text-base font-semibold">模型</h3>
        <p className="mb-3 text-[12px] text-muted-foreground">配置提供商与模型,选择默认模型。</p>

        <ModelConfigPanel />

        <Separator className="my-3 bg-border/60" />
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">生成选项</div>
        <ToggleRow label="流式输出" desc="逐字显示回复,而非等待整段" defaultOn />
        <Separator className="bg-border/40" />
        <ToggleRow label="自动思考" desc="模型推理时显示思考过程" defaultOn />
      </div>
    );
  }
  if (id === "usecase") {
    return (
      <div>
        <h3 className="mb-1 text-base font-semibold">用途</h3>
        <p className="mb-3 text-[12px] text-muted-foreground">为不同功能场景指定专用模型。</p>
        <UseCasePanel />
      </div>
    );
  }
  if (id === "appearance") {
    return (
      <div>
        <h3 className="mb-1 text-base font-semibold">外观</h3>
        <p className="mb-2 text-[12px] text-muted-foreground">主题、字体与界面密度。</p>
        <Separator className="my-2 bg-border/60" />
        <ThemeRow />
        <Separator className="bg-border/40" />
        <div className="py-3">
          <div className="mb-2 text-[13px] font-medium">界面密度</div>
          <div className="grid grid-cols-3 gap-2">
            {["紧凑", "标准", "宽松"].map((d, i) => (
              <button
                key={d}
                type="button"
                className={cn(
                  "rounded-lg border px-3 py-2 text-[12px] font-medium transition-colors",
                  i === 1 ? "border-accent bg-accent/5 text-accent" : "border-border/60 hover:bg-muted/40",
                )}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
        <Separator className="bg-border/40" />
        <ToggleRow label="显示状态栏" defaultOn />
        <Separator className="bg-border/40" />
        <ToggleRow label="动画效果" desc="启用界面过渡与微交互" defaultOn />
      </div>
    );
  }
  if (id === "keybindings") {
    return (
      <div>
        <h3 className="mb-1 text-base font-semibold">快捷键</h3>
        <p className="mb-2 text-[12px] text-muted-foreground">查看与自定义键盘快捷键。</p>
        <Separator className="my-2 bg-border/60" />
        <KeyRow label="发送消息" keys="Enter" />
        <Separator className="bg-border/40" />
        <KeyRow label="换行" keys="Shift + Enter" />
        <Separator className="bg-border/40" />
        <KeyRow label="新建会话" keys="Ctrl + N" />
        <Separator className="bg-border/40" />
        <KeyRow label="中断生成" keys="Ctrl + C" />
        <Separator className="bg-border/40" />
        <KeyRow label="打开命令菜单" keys="/" />
        <Separator className="bg-border/40" />
        <KeyRow label="切换模式" keys="Ctrl + Tab" />
      </div>
    );
  }
  // about
  return (
    <div>
      <h3 className="mb-1 text-base font-semibold">关于</h3>
      <p className="mb-3 text-[12px] text-muted-foreground">应用版本与信息。</p>

      {/* 品牌头部 */}
      <div className="surface mb-4 flex flex-col items-center rounded-xl p-6 text-center">
        <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/15 to-accent/5 text-accent">
          <Logo className="h-10 w-10" />
        </div>
        <div className="text-xl font-semibold tracking-tight">LXCode</div>
        <div className="mt-1 text-[12px] text-muted-foreground">本地优先的 AI 编码助手</div>
        <div className="mt-3 flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-[11px]">v0.1.0</Badge>
          <Badge variant="outline" className="border-accent/30 text-[11px] text-accent">设计阶段</Badge>
        </div>
      </div>

      {/* 技术栈 */}
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">技术栈</div>
      <div className="grid grid-cols-2 gap-2">
        {[
          { name: "React", ver: "19.x", color: "text-sky-500" },
          { name: "Vite", ver: "7.x", color: "text-amber-500" },
          { name: "Tailwind", ver: "3.4", color: "text-cyan-500" },
          { name: "TypeScript", ver: "5.x", color: "text-blue-500" },
          { name: "Monaco", ver: "0.56", color: "text-indigo-500" },
          { name: "GSAP", ver: "3.15", color: "text-green-500" },
          { name: "Zustand", ver: "5.x", color: "text-orange-500" },
          { name: "Tauri", ver: "2.x", color: "text-rose-500" },
        ].map((t) => (
          <div key={t.name} className="flex items-center justify-between rounded-lg border border-border/60 bg-background/60 px-3 py-2">
            <span className={cn("flex items-center gap-1.5 text-[12px] font-medium", t.color)}>
              <span className="h-2 w-2 rounded-full bg-current" />
              {t.name}
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">{t.ver}</span>
          </div>
        ))}
      </div>

      {/* 链接区 */}
      <div className="mb-3 mt-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">资源</div>
      <div className="grid grid-cols-4 gap-2">
        {[
          { Icon: Globe, label: "官网" },
          { Icon: BookOpen, label: "文档" },
          { Icon: MessageCircle, label: "反馈" },
          { Icon: GitBranch, label: "源码" },
        ].map((l) => {
          const Icon = l.Icon;
          return (
            <button
              key={l.label}
              type="button"
              className="flex flex-col items-center gap-1.5 rounded-lg border border-border/60 bg-background/60 px-2 py-3 transition-colors hover:bg-muted/40"
            >
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-[11px] font-medium">{l.label}</span>
            </button>
          );
        })}
      </div>

      {/* 版权 */}
      <div className="mt-6 border-t border-border/60 pt-3 text-center text-[11px] text-muted-foreground/70">
        <div>© 2025 LXCode</div>
        <div className="mt-0.5">Powered by pi-core</div>
      </div>
    </div>
  );
}

/**
 * 设置面板:覆盖在 AppShell 之上的全屏卡片。
 * 左侧分类导航 + 右侧表单内容,顶部标题 + 关闭。
 */
export function SettingsPanel() {
  const open = useSettingsStore((s) => s.open);
  const active = useSettingsStore((s) => s.activeSection);
  const setSection = useSettingsStore((s) => s.setSection);
  const setOpen = useSettingsStore((s) => s.setOpen);

  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // 面板打开:淡入 + 轻微缩放(fromTo 明确起止,overwrite 防叠加)
  useGSAP(
    () => {
      if (!open) return;
      gsap.fromTo(".sp-overlay", { opacity: 0 }, { opacity: 1, duration: 0.18, ease: "power2.out", overwrite: true });
      gsap.fromTo(".sp-card", { opacity: 0, scale: 0.97, y: 6 }, { opacity: 1, scale: 1, y: 0, duration: 0.22, ease: "power3.out", overwrite: true });
    },
    { scope: rootRef, dependencies: [open] },
  );

  // 分类切换:内容淡入上移 + 左条弹出
  useGSAP(
    () => {
      if (!open) return;
      gsap.fromTo(contentRef.current, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.2, ease: "power2.out", overwrite: true });
      gsap.fromTo(".sp-nav-indicator", { scaleY: 0 }, { scaleY: 1, duration: 0.25, ease: "back.out(2.5)", overwrite: true });
    },
    { scope: rootRef, dependencies: [active, open] },
  );

  if (!open) return null;

  return (
    <div ref={rootRef} className="sp-overlay absolute inset-0 z-40 flex flex-col rounded-xl bg-background/80 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div
        className="sp-card surface m-2 mt-1 flex flex-1 overflow-hidden rounded-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 左侧分类导航 */}
        <aside className="flex w-52 shrink-0 flex-col border-r border-border/60 bg-muted/20">
          <div className="px-4 pb-2 pt-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            设置
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <ul className="space-y-0.5">
              {SECTIONS.map((s) => {
                const Icon = s.Icon;
                const isActive = active === s.id;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setSection(s.id)}
                      className={cn(
                        "relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors",
                        isActive ? "bg-background text-foreground shadow-sm" : "text-foreground/80 hover:bg-background/60",
                      )}
                    >
                      {isActive ? <span className="sp-nav-indicator absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-accent origin-center" /> : null}
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      {s.label}
                      <ChevronRight className={cn("ml-auto h-3.5 w-3.5 text-muted-foreground/40", isActive && "text-foreground/60")} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>

        {/* 右侧内容 */}
        <main className="flex-1 overflow-y-auto">
          <div className="flex h-12 items-center justify-between border-b border-border/60 px-8">
            <h2 className="text-[15px] font-semibold tracking-tight">
              {SECTIONS.find((s) => s.id === active)?.label}
            </h2>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div ref={contentRef} className="sp-content px-8 py-6">
            <SectionContent id={active} />
          </div>
        </main>
      </div>
    </div>
  );
}
