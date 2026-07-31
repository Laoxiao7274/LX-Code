import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { Button } from "@/components/ui/button";

gsap.registerPlugin(useGSAP);

/**
 * 按钮交互微动画:hover 抬升 + 点击弹性缩放。
 * useGSAP 返回的 contextSafe 包装事件回调,卸载后自动失效。
 */
export function ButtonInteractionDemo() {
  const container = useRef<HTMLDivElement>(null);
  const { contextSafe } = useGSAP({ scope: container });

  const onEnter = contextSafe((el: gsap.TweenTarget) => {
    gsap.to(el, { y: -2, scale: 1.02, duration: 0.2, ease: "power2.out" });
  });

  const onLeave = contextSafe((el: gsap.TweenTarget) => {
    gsap.to(el, { y: 0, scale: 1, duration: 0.25, ease: "power2.out" });
  });

  const onClick = contextSafe((el: gsap.TweenTarget) => {
    gsap.fromTo(
      el,
      { scale: 0.94 },
      { scale: 1, duration: 0.5, ease: "elastic.out(1, 0.4)" },
    );
  });

  return (
    <div ref={container} className="space-y-4">
      <p className="text-sm text-muted-foreground">悬停按钮看抬升效果,点击看弹性回弹。</p>
      <div className="flex flex-wrap items-center gap-3">
        {[
          { label: "新建会话", variant: "default" as const },
          { label: "取消", variant: "outline" as const },
          { label: "删除", variant: "destructive" as const },
          { label: "次要", variant: "secondary" as const },
        ].map((b) => (
          <Button
            key={b.label}
            variant={b.variant}
            onMouseEnter={(e) => onEnter(e.currentTarget)}
            onMouseLeave={(e) => onLeave(e.currentTarget)}
            onClick={(e) => onClick(e.currentTarget)}
          >
            {b.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
