import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { FileCode, Bug, Sparkles } from "lucide-react";

gsap.registerPlugin(useGSAP);

const CARDS = [
  { icon: FileCode, title: "生成功能", desc: "描述需求,自动生成代码" },
  { icon: Bug, title: "修复问题", desc: "粘贴报错,定位并修复" },
  { icon: Sparkles, title: "重构优化", desc: "选区代码,提出改进" },
];

/**
 * 空状态入场:Logo 缩放 + 标题淡入 + 建议卡依次出现。
 * 这是 AppShell 空状态将要使用的真实动画。
 */
export function EmptyStateDemo() {
  const container = useRef<HTMLDivElement>(null);

  const play = () => {
    const tl = gsap.timeline();
    tl.from(".es-logo", { scale: 0.6, opacity: 0, duration: 0.5, ease: "back.out(1.6)" })
      .from(".es-title", { y: 16, opacity: 0, duration: 0.4, ease: "power2.out" }, "-=0.2")
      .from(".es-sub", { y: 12, opacity: 0, duration: 0.4, ease: "power2.out" }, "-=0.3")
      .from(
        ".es-card",
        { y: 24, opacity: 0, scale: 0.95, duration: 0.5, ease: "power3.out", stagger: 0.1 },
        "-=0.2",
      );
  };

  useGSAP(
    () => {
      play();
    },
    { scope: container },
  );

  return (
    <div ref={container} className="space-y-4">
      <Button size="sm" variant="outline" onClick={play}>
        重新播放
      </Button>
      <div className="flex flex-col items-center justify-center gap-6 rounded-xl border border-border/50 bg-muted/20 py-12 text-center">
        <Logo size={56} className="es-logo text-accent/80" />
        <div className="space-y-1.5">
          <h2 className="es-title text-2xl font-semibold tracking-tight">开始构建</h2>
          <p className="es-sub text-sm text-muted-foreground font-mono">lxcode_workspace</p>
        </div>
        <div className="grid w-full max-w-xl grid-cols-1 gap-2.5 px-4 sm:grid-cols-3">
          {CARDS.map((s) => (
            <button
              key={s.title}
              type="button"
              className="es-card surface group rounded-xl p-3.5 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <s.icon className="mb-2 h-5 w-5 text-accent" />
              <div className="text-[13px] font-medium">{s.title}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">{s.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
