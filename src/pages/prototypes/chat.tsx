import { useEffect, useRef } from "react";
import { useChatStore } from "./chat-store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/**
 * 对话页原型 —— 全部用调试场组件拼装。
 * 消息流(ScrollArea)+ 角色头像(Avatar)+ 输入框(Input)
 * + 发送/中断按钮(Button)+ 生成状态(Badge)+ 分隔(Separator)。
 * 气泡外层圆角/背景为聊天页特有样式,用 Tailwind 组合(非基础原语)。
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
      <div className="flex items-center gap-2 px-1 pb-2">
        <Badge variant={isGenerating ? "default" : "secondary"}>
          {isGenerating ? "生成中" : "空闲"}
        </Badge>
        <span className="text-xs text-muted-foreground">共 {messages.length} 条消息</span>
      </div>

      {/* 消息流 */}
      <ScrollArea className="flex-1 rounded-md border border-border">
        <div className="space-y-3 p-3">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center py-12 text-sm text-muted-foreground">
              暂无消息,在右栏点击「发送消息」或在下方输入
            </div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "flex items-start gap-2",
                  m.role === "user" ? "flex-row-reverse" : "flex-row",
                )}
              >
                <Avatar className="h-7 w-7">
                  <AvatarFallback
                    className={cn(
                      "text-xs",
                      m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted",
                    )}
                  >
                    {m.role === "user" ? "我" : "AI"}
                  </AvatarFallback>
                </Avatar>
                <div
                  className={cn(
                    "max-w-[70%] rounded-lg px-3 py-2 text-sm",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground",
                  )}
                >
                  {m.text}
                  {m.streaming ? (
                    <span className="ml-1 inline-block h-3 w-px animate-pulse bg-foreground/60 align-middle" />
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
        <Separator className="mb-3" />
        <div className="flex gap-2">
          <Input
            placeholder={isGenerating ? "生成中..." : "输入消息,回车发送"}
            value={input}
            disabled={isGenerating}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          {isGenerating ? (
            <Button variant="destructive" onClick={abort}>
              中断
            </Button>
          ) : (
            <Button disabled={!input.trim()} onClick={send}>
              发送
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
