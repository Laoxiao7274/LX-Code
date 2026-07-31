import { useEffect, useRef } from "react";
import { useChatStore } from "./chat-store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Logo } from "@/components/ui/logo";
import { FileCode, Bug, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 对话页原型 —— 全部用调试场组件拼装。
 * 气泡用卡片层级(阴影/圆角)区分角色:
 * - 用户:强调色渐变背景
 * - AI:muted 卡片 + 微边框
 */
export function ChatPrototype() {
  const messages = useChatStore((s) => s.messages);
  const input = useChatStore((s) => s.input);
  const isGenerating = useChatStore((s) => s.isGenerating);
  const setInput = useChatStore((s) => s.setInput);
  const send = useChatStore((s) => s.send);
  const abort = useChatStore((s) => s.abort);

  // 新消息时自动滚到底
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  return (
    <div className="flex h-full flex-col">
      {/* 顶部状态条 */}
      <div className="flex items-center gap-2 px-1 pb-3 text-xs text-muted-foreground">
        {isGenerating ? (
          <>
            <span className="signal-dot" aria-hidden />
            <span>正在生成回复…</span>
          </>
        ) : (
          <span className="opacity-70">{messages.length} 条消息</span>
        )}
      </div>

      {/* 消息流 */}
      <ScrollArea className="flex-1 rounded-xl border border-border/50 bg-card/30">
        <div className="space-y-4 p-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-6 py-20 text-center">
              <Logo size={56} className="text-accent/80" />
              <div className="space-y-1.5">
                <h2 className="text-2xl font-semibold tracking-tight">开始构建</h2>
                <p className="text-sm text-muted-foreground font-mono">lxcode_workspace</p>
              </div>
              <div className="grid w-full max-w-xl grid-cols-1 gap-2.5 px-4 sm:grid-cols-3">
                {[
                  { icon: FileCode, title: "生成功能", desc: "描述需求,自动生成代码" },
                  { icon: Bug, title: "修复问题", desc: "粘贴报错,定位并修复" },
                  { icon: Sparkles, title: "重构优化", desc: "选区代码,提出改进" },
                ].map((s) => (
                  <button
                    key={s.title}
                    type="button"
                    onClick={() => setInput(s.title + ":")}
                    className="surface group rounded-xl p-3.5 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <s.icon className="mb-2 h-5 w-5 text-accent" />
                    <div className="text-[13px] font-medium">{s.title}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">{s.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "flex items-start gap-2.5",
                  m.role === "user" ? "flex-row-reverse" : "flex-row",
                )}
              >
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback
                    className={cn(
                      "text-[11px] font-medium",
                      m.role === "user"
                        ? "bg-accent text-accent-foreground"
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
                      ? "rounded-tr-sm bg-primary text-primary-foreground"
                      : "rounded-tl-sm border border-border/50 bg-card",
                  )}
                >
                  {m.text}
                  {m.streaming ? (
                    <span className="ml-1 inline-block h-3.5 w-px animate-pulse bg-foreground/50 align-middle" />
                  ) : null}
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* 输入区 */}
      <div className="mt-3">
        <Separator className="mb-3 bg-border/50" />
        <div className="flex gap-2">
          <Input
            placeholder={isGenerating ? "生成中…" : "输入消息,回车发送"}
            value={input}
            disabled={isGenerating}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            className="h-10 shadow-sm"
          />
          {isGenerating ? (
            <Button variant="destructive" className="h-10" onClick={abort}>
              中断
            </Button>
          ) : (
            <Button className="h-10 px-5 shadow-sm" disabled={!input.trim()} onClick={send}>
              发送
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
