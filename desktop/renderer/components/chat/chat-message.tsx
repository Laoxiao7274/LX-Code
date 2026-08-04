import { Avatar, AvatarFallback } from "../../components/ui/avatar";
import { cn } from "../../lib/utils";
import type { Message, MessagePart, Attachment } from "../../stores/chat-store";
import { ThinkingBlock } from "./thinking-block";
import { ToolCallRow } from "./tool-call-row";
import { AttachmentView } from "./attachment-view";
import { MarkdownText } from "./markdown-text";

interface ChatMessageProps {
  message: Message;
  /** 图片点击放大回调。 */
  onImageClick?: (a: Attachment) => void;
}

/** 单条消息渲染:用户气泡 / 助手分段(思考+工具+文本)。照抄设计原型样式。 */
export function ChatMessage({ message, onImageClick }: ChatMessageProps) {
  const isUser = message.role === "user";
  return (
    <div className={cn("bubble flex items-start gap-2.5", isUser ? "flex-row-reverse" : "flex-row")}>
      <Avatar className="h-7 w-7 shrink-0">
        <AvatarFallback
          className={cn(
            "text-[11px] font-medium",
            isUser ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          {isUser ? "我" : "AI"}
        </AvatarFallback>
      </Avatar>

      {isUser ? (
        <div className="max-w-[72%] rounded-2xl rounded-tr-sm border border-border/50 bg-card px-3.5 py-2 text-[13px] leading-relaxed text-foreground">
          {message.attachments?.length ? (
            <div className="mb-2">
              <AttachmentView
                attachments={message.attachments}
                onClick={(a) => a.kind === "image" && onImageClick?.(a)}
              />
            </div>
          ) : null}
          {message.text ? <div className="whitespace-pre-wrap">{message.text}</div> : null}
        </div>
      ) : (
        <div className="max-w-[80%] min-w-0 rounded-2xl rounded-tl-sm border border-border/50 bg-card px-3.5 py-2.5">
          {message.parts?.length === 0 && message.streaming ? (
            <div className="py-1 text-[13px] text-muted-foreground">
              <span className="signal-dot signal-dot-live mr-1.5" aria-hidden />
              思考中…
            </div>
          ) : null}
          {message.parts?.map((part: MessagePart) => {
            if (part.type === "thinking") return <ThinkingBlock key={part.id} part={part} />;
            if (part.type === "tool") return <ToolCallRow key={part.id} part={part} />;
            if (part.type === "image") {
              const src = part.data.startsWith("data:") ? part.data : `data:${part.mimeType};base64,${part.data}`;
              return (
                <div key={part.id} className="py-1">
                  <img src={src} alt="生成图片" className="max-w-full rounded-lg border border-border/50" />
                </div>
              );
            }
            return (
              <div key={part.id} className="py-1">
                <MarkdownText content={part.text} />
                {part.streaming ? <span className="ml-0.5 inline-block h-3.5 w-px animate-pulse bg-foreground/50 align-middle" /> : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
