import { useEffect, useRef } from "react";
import { ScrollArea } from "../../components/ui/scroll-area";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Separator } from "../../components/ui/separator";
import { cn } from "../../lib/utils";
import { useChatStore } from "../../stores/chat-store";
import { useSessionStore } from "../../stores/session-store";
import { ChatMessage } from "./chat-message";

/** 对话主区:消息流 + 输入区。对接真实 agent。 */
export function ChatMain() {
  const sessions = useSessionStore((s) => s.sessions);
  const activeId = useSessionStore((s) => s.activeId);
  const active = sessions.find((x) => x.id === activeId) ?? sessions[0];

  const sessionId = active?.id ?? "";
  const cwd = active?.cwd ?? ".";
  const allMessages = useChatStore((s) => s.messagesBySession);
  const messages = allMessages[sessionId] ?? [];
  const input = useChatStore((s) => s.input);
  const isGenerating = useChatStore((s) => s.isGenerating);
  const setInput = useChatStore((s) => s.setInput);
  const send = useChatStore((s) => s.send);
  const abort = useChatStore((s) => s.abort);

  const bottomRef = useRef<HTMLDivElement>(null);

  // 新消息滚到底
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  return (
    <div className="flex h-full flex-col bg-background">
      {/* 消息流 */}
      <ScrollArea className="flex-1">
        <div className="mx-auto max-w-3xl space-y-4 p-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 py-20 text-center text-muted-foreground">
              <div className="text-sm">开始和 LXCode 对话</div>
              <div className="text-xs text-muted-foreground/70">在下方输入消息,agent 会真实读写你的项目文件</div>
            </div>
          ) : (
            messages.map((m) => <ChatMessage key={m.id} message={m} />)
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* 输入区 */}
      <div className="border-t border-border/60 p-3">
        <div className="mx-auto flex max-w-3xl gap-2">
          <Input
            placeholder={isGenerating ? "生成中…" : "输入消息,回车发送"}
            value={input}
            disabled={isGenerating}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(sessionId, cwd);
              }
            }}
            className="h-10 shadow-sm"
          />
          {isGenerating ? (
            <Button variant="destructive" className="h-10" onClick={() => void abort(cwd)}>
              中断
            </Button>
          ) : (
            <Button
              className="h-10 px-5 shadow-sm"
              disabled={!input.trim()}
              onClick={() => void send(sessionId, cwd)}
            >
              发送
            </Button>
          )}
        </div>
        <div className="mx-auto mt-1.5 max-w-3xl text-center text-[10px] text-muted-foreground/50">
          {cwd} · {isGenerating ? "agent 运行中" : "就绪"}
        </div>
      </div>
    </div>
  );
}
