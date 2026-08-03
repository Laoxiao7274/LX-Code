import { useEffect, useRef, useState } from "react";
import { ScrollArea } from "../../components/ui/scroll-area";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { cn } from "../../lib/utils";
import { useChatStore } from "../../stores/chat-store";
import type { Attachment } from "../../stores/chat-store";
import { useSessionStore } from "../../stores/session-store";
import { ChatMessage } from "./chat-message";
import { AttachmentView } from "./attachment-view";
import { ImageLightbox } from "./image-lightbox";
import { SlashMenu } from "./slash-menu";
import { FileText, ImageIcon } from "lucide-react";

/** 对话主区:消息流 + 输入区(附件/斜杠/放大)。对接真实 agent。 */
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
  const pending = useChatStore((s) => s.pendingAttachments);
  const addAttachment = useChatStore((s) => s.addAttachment);
  const removeAttachment = useChatStore((s) => s.removeAttachment);

  const bottomRef = useRef<HTMLDivElement>(null);
  const [lightbox, setLightbox] = useState<Attachment | null>(null);

  // 斜杠命令:输入以 / 开头且非生成中时显示
  const slashOpen = input.startsWith("/") && !isGenerating;
  const slashQuery = input.slice(1).split(" ")[0] ?? "";

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
              <div className="text-xs text-muted-foreground/70">在下方输入消息,输入 / 唤出命令</div>
            </div>
          ) : (
            messages.map((m) => <ChatMessage key={m.id} message={m} onImageClick={setLightbox} />)
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* 输入区 */}
      <div className="border-t border-border/60 p-3">
        {/* 斜杠命令菜单 */}
        <div className="mx-auto max-w-3xl">
          <SlashMenu
            open={slashOpen}
            query={slashQuery}
            onSelect={(insert) => setInput(insert)}
            onClose={() => setInput(input.replace(/^\/[a-z]*/, ""))}
          />
          {/* 待发送附件 */}
          <AttachmentView attachments={pending} view="pending" onRemove={removeAttachment} />
        </div>

        <div className="mx-auto flex max-w-3xl gap-2">
          <Input
            placeholder={isGenerating ? "生成中…" : "输入消息,回车发送(/ 唤出命令)"}
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
          <Button
            variant="outline"
            className="h-10 w-10 shrink-0 px-0"
            onClick={() => addAttachment({ id: `att${Date.now()}`, kind: "image", name: "截图.svg", url: "/img/ide-screenshot.svg" })}
            title="添加图片"
          >
            <ImageIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="h-10 w-10 shrink-0 px-0"
            onClick={() => addAttachment({ id: `att${Date.now()}`, kind: "file", name: "requirements.md", size: "4.2 KB" })}
            title="添加文件"
          >
            <FileText className="h-4 w-4" />
          </Button>
          {isGenerating ? (
            <Button variant="destructive" className="h-10" onClick={() => void abort(cwd)}>
              中断
            </Button>
          ) : (
            <Button
              className="h-10 px-5 shadow-sm"
              disabled={!input.trim() && pending.length === 0}
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

      {/* 图片放大预览 */}
      <ImageLightbox image={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}
