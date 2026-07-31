import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { Button } from "@/components/ui/button";

gsap.registerPlugin(useGSAP);

/**
 * 淡入上移(入场动画)。
 * 多元素用 stagger 依次出现 —— 列表/卡片入场最常用。
 */
export function EntranceFadeDemo() {
  const container = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.from(".fade-item", {
        y: 24,
        opacity: 0,
        duration: 0.6,
        ease: "power3.out",
        stagger: 0.08,
      });
    },
    { scope: container },
  );

  // 重新播放
  const replay = () => {
    gsap.killTweensOf(".fade-item");
    gsap.fromTo(
      ".fade-item",
      { y: 24, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6, ease: "power3.out", stagger: 0.08 },
    );
  };

  return (
    <div ref={container} className="space-y-4">
      <Button size="sm" variant="outline" onClick={replay}>
        重新播放
      </Button>
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="fade-item surface flex h-20 items-center justify-center rounded-xl text-sm font-medium text-muted-foreground"
          >
            {i + 1}
          </div>
        ))}
      </div>
    </div>
  );
}
