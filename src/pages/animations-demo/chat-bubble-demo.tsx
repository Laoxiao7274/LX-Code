import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

interface Msg {
  id: number;
  role: "user" | "ai";
  text: string;
}

const SEED: Msg[] = [
  { id: 1, role: "user", text: "帮我实现一个防抖函数" },
  { id: 2, role: "ai", text: "好的,这是用 TypeScript 实现的防抖函数…" },
  { id: 3, role: "user", text: "支持立即执行吗?" },
  { id: 4, role: "ai", text: "可以,加一个 leading 选项即可。" },
];

/**
 * 对话气泡入场:模拟 AppShell 中消息流的真实动画。
 * 每条消息从下方淡入,按角色分左右排布。
 */
export function ChatBubbleDemo() {
  const container = useRef<HTMLDivElement>(null);

  const play = () => {
    gsap.killTweensOf(".bubble");
    gsap.fromTo(
      ".bubble",
      { y: 16, opacity: 0, scale: 0.96 },
      {
        y: 0,
        opacity: 1,
        scale: 1,
        duration: 0.5,
        ease: "back.out(1.4)",
        stagger: 0.25,
      },
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
      <div className="space-y-3 rounded-xl border border-border/50 bg-muted/20 p-4">
        {SEED.map((m) => (
          <div
            key={m.id}
            className={cn(
              "bubble flex items-start gap-2.5",
              m.role === "user" ? "flex-row-reverse" : "flex-row",
            )}
          >
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarFallback
                className={cn(
                  "text-[11px] font-medium",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {m.role === "user" ? "我" : "AI"}
              </AvatarFallback>
            </Avatar>
            <div
              className={cn(
                "max-w-[72%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed",
                m.role === "user"
                  ? "rounded-tr-sm border border-border/50 bg-card text-foreground"
                  : "rounded-tl-sm border border-border/50 bg-card",
              )}
            >
              {m.text}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
