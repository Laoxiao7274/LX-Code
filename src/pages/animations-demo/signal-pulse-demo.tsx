import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { Button } from "@/components/ui/button";

gsap.registerPlugin(useGSAP);

/**
 * 信号点脉冲(GSAP 版):无限循环的扩散光圈。
 * 用 repeat: -1,可随时 killTweensOf 停止。
 * 对比 CSS 版本,GSAP 版更易受控(暂停/恢复/速度)。
 */
export function SignalPulseDemo() {
  const container = useRef<HTMLDivElement>(null);
  const { contextSafe } = useGSAP({ scope: container });

  const start = contextSafe(() => {
    gsap.killTweensOf(".pulse-ring");
    gsap.fromTo(
      ".pulse-ring",
      { scale: 0.6, opacity: 0.7 },
      { scale: 1.8, opacity: 0, duration: 1.8, ease: "power1.out", repeat: -1, stagger: 0.6 },
    );
  });

  const stop = contextSafe(() => {
    gsap.killTweensOf(".pulse-ring");
    gsap.set(".pulse-ring", { scale: 0.6, opacity: 0 });
  });

  useGSAP(
    () => {
      start();
    },
    { scope: container },
  );

  return (
    <div ref={container} className="space-y-4">
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={start}>
          播放
        </Button>
        <Button size="sm" variant="ghost" onClick={stop}>
          停止
        </Button>
      </div>
      <div className="flex items-center gap-8 rounded-xl border border-border/50 bg-muted/20 p-8">
        {[0, 1, 2].map((i) => (
          <div key={i} className="relative flex items-center justify-center">
            <span className="pulse-ring absolute h-3 w-3 rounded-full bg-accent" />
            <span className="pulse-ring absolute h-3 w-3 rounded-full bg-accent" />
            <span className="relative h-3 w-3 rounded-full bg-accent" />
            <span className="ml-4 text-sm text-muted-foreground">
              {["就绪", "生成中", "思考中"][i]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
