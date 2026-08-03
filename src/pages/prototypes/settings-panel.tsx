import { useState } from "react";
import { useSettingsStore } from "./settings-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  X, Settings, Cpu, Palette, Keyboard, Info, ChevronRight,
  Sun, Moon, Monitor, Check,
  Globe, BookOpen, MessageCircle, GitBranch,
  ChevronDown, Key, Plus, Server, Sparkles,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/utils";

/** 分类定义。 */
const SECTIONS = [
  { id: "general", label: "通用", Icon: Settings },
  { id: "model", label: "模型", Icon: Cpu },
  { id: "appearance", label: "外观", Icon: Palette },
  { id: "keybindings", label: "快捷键", Icon: Keyboard },
  { id: "about", label: "关于", Icon: Info },
] as const;

/** 开关行。 */
function ToggleRow({ label, desc, defaultOn = false }: { label: string; desc?: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn);
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
          "relative h-5 w-9 shrink-0 rounded-full transition-colors",
          on ? "bg-accent" : "bg-muted-foreground/30",
        )}
      >
        <span
          className={cn(
            "absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow transition-all",
            on ? "left-[18px]" : "left-0.5",
          )}
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
  return (
    <div className="py-3">
      <div className="mb-2 text-[13px] font-medium">主题</div>
      <div className="grid grid-cols-3 gap-2">
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
                active ? "border-accent bg-accent/5 text-accent" : "border-border/60 hover:bg-muted/40",
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

/** 提供商定义。 */
interface Provider {
  id: string;
  name: string;
  Icon: typeof Server;
  color: string;
  connected: boolean;
  models: { id: string; name: string; desc: string; badge?: string }[];
}

const PROVIDERS: Provider[] = [
  {
    id: "anthropic",
    name: "Anthropic",
    Icon: Sparkles,
    color: "text-amber-600",
    connected: true,
    models: [
      { id: "sonnet-4", name: "Claude Sonnet 4", desc: "均衡,推荐", badge: "推荐" },
      { id: "opus-4", name: "Claude Opus 4", desc: "最强,慢且贵" },
      { id: "haiku", name: "Claude Haiku 3.5", desc: "最快,简单任务" },
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    Icon: Cpu,
    color: "text-emerald-600",
    connected: true,
    models: [
      { id: "gpt-4o", name: "GPT-4o", desc: "全能旗舰" },
      { id: "gpt-4o-mini", name: "GPT-4o mini", desc: "轻量快速" },
      { id: "o3-mini", name: "o3-mini", desc: "推理增强" },
    ],
  },
  {
    id: "local",
    name: "本地 (Ollama)",
    Icon: Server,
    color: "text-sky-600",
    connected: false,
    models: [
      { id: "qwen", name: "Qwen2.5-Coder", desc: "本地代码模型" },
      { id: "deepseek", name: "DeepSeek-Coder", desc: "本地代码模型" },
    ],
  },
];

/** 提供商 + 模型两级配置。 */
function ModelConfig() {
  const [expanded, setExpanded] = useState<string | null>("anthropic");
  const [selected, setSelected] = useState("sonnet-4");

  return (
    <div className="space-y-2">
      {PROVIDERS.map((p) => {
        const isOpen = expanded === p.id;
        const ProviderIcon = p.Icon;
        const hasSelected = p.models.some((m) => m.id === selected);
        return (
          <div key={p.id} className="overflow-hidden rounded-lg border border-border/60">
            {/* 提供商头 */}
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : p.id)}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-muted/40"
            >
              <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted", p.color)}>
                <ProviderIcon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-medium">{p.name}</span>
                  {hasSelected ? <Badge variant="outline" className="h-4 px-1 text-[9px] text-accent">默认</Badge> : null}
                </div>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className={cn("h-1.5 w-1.5 rounded-full", p.connected ? "bg-emerald-500" : "bg-muted-foreground/40")} />
                  <span className="text-muted-foreground">{p.connected ? "已连接" : "未连接"}</span>
                </div>
              </div>
              <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform", isOpen && "rotate-180")} />
            </button>

            {/* 展开内容:API Key + 模型列表 */}
            {isOpen ? (
              <div className="border-t border-border/60 bg-muted/20 p-3">
                {/* API Key */}
                <div className="mb-3">
                  <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                    <Key className="h-3 w-3" />
                    API Key
                  </div>
                  <Input
                    type="password"
                    className="h-8 font-mono text-[12px]"
                    placeholder={p.id === "local" ? "无需 API Key" : "sk-..."}
                    defaultValue={p.connected ? "sk-ant-••••••••••••" : ""}
                  />
                </div>

                {/* 模型列表 */}
                <div className="text-[11px] font-medium text-muted-foreground">模型</div>
                <div className="mt-1 space-y-1">
                  {p.models.map((m) => {
                    const active = m.id === selected;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSelected(m.id)}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors",
                          active ? "bg-accent/10" : "hover:bg-muted/50",
                        )}
                      >
                        <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded-full border", active ? "border-accent bg-accent" : "border-muted-foreground/30")}>
                          {active ? <Check className="h-2.5 w-2.5 text-white" /> : null}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className={cn("text-[13px]", active ? "font-medium text-foreground" : "text-foreground/85")}>{m.name}</span>
                            {m.badge ? <Badge variant="outline" className="h-4 px-1 text-[9px] text-accent">{m.badge}</Badge> : null}
                          </div>
                          <div className="text-[11px] text-muted-foreground">{m.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        );
      })}

      {/* 添加提供商 */}
      <button type="button" className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/60 py-2 text-[12px] text-muted-foreground transition-colors hover:bg-muted/40">
        <Plus className="h-3.5 w-3.5" />
        添加提供商
      </button>
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

        <ModelConfig />

        <Separator className="my-3 bg-border/60" />
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">生成选项</div>
        <ToggleRow label="流式输出" desc="逐字显示回复,而非等待整段" defaultOn />
        <Separator className="bg-border/40" />
        <ToggleRow label="自动思考" desc="模型推理时显示思考过程" defaultOn />
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

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-40 flex flex-col rounded-xl bg-background/80 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div
        className="surface m-2 mt-1 flex flex-1 overflow-hidden rounded-lg"
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
                      {isActive ? <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-accent" /> : null}
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
          <div className="flex h-12 items-center justify-between border-b border-border/60 px-6">
            <h2 className="text-[15px] font-semibold tracking-tight">
              {SECTIONS.find((s) => s.id === active)?.label}
            </h2>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="mx-auto max-w-2xl px-6 py-4">
            <SectionContent id={active} />
          </div>
        </main>
      </div>
    </div>
  );
}
