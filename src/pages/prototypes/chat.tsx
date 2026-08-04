import { useRef, useState } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { useChatStore } from "./chat-store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Logo } from "@/components/ui/logo";
import { FileCode, Bug, Sparkles, FileText, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThinkingBlock } from "./thinking-block";
import { ToolCallRow } from "./tool-call-row";
import { AttachmentView } from "./attachment-view";
import { ImageLightbox } from "./image-lightbox";
import { SlashMenu } from "./slash-menu";
import { ChatToolbar } from "./chat-toolbar";
import type { Attachment, MessagePart } from "./chat-store";

gsap.registerPlugin(useGSAP);

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
  const pending = useChatStore((s) => s.pendingAttachments);
  const addAttachment = useChatStore((s) => s.addAttachment);
  const removeAttachment = useChatStore((s) => s.removeAttachment);

  // 图片放大预览状态
  const [lightbox, setLightbox] = useState<Attachment | null>(null);
  // 斜杠命令菜单
  const slashOpen = input.startsWith("/") && !isGenerating;
  const slashQuery = input.slice(1).split(" ")[0] ?? "";

  // 新消息时自动滚到底
  const bottomRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const prevCount = useRef(0);

  useGSAP(
    () => {
      // 空状态入场:Logo + 标题 + 建议卡时间轴(仅空状态时触发)
      if (messages.length === 0) {
        const tl = gsap.timeline();
        tl.from(".es-logo", { scale: 0.6, opacity: 0, duration: 0.5, ease: "back.out(1.6)" })
          .from(".es-title", { y: 16, opacity: 0, duration: 0.4, ease: "power2.out" }, "-=0.2")
          .from(".es-sub", { y: 12, opacity: 0, duration: 0.4, ease: "power2.out" }, "-=0.3")
          .from(
            ".es-card",
            { y: 24, opacity: 0, scale: 0.95, duration: 0.5, ease: "power3.out", stagger: 0.1 },
            "-=0.2",
          );
      }
    },
    { scope: rootRef, dependencies: [messages.length === 0] },
  );

  // 新消息入场动画 + 滚到底
  useGSAP(
    () => {
      if (messages.length > 0) {
        const added = messages.length - prevCount.current;
        const bubbles = rootRef.current?.querySelectorAll(".bubble");
        if (!bubbles || bubbles.length === 0) {
          prevCount.current = messages.length;
          bottomRef.current?.scrollIntoView({ block: "end" });
          return;
        }
        if (added > 1) {
          // 批量注入(如长任务场景):所有 bubble stagger 入场
          gsap.fromTo(
            ".bubble",
            { y: 16, opacity: 0, scale: 0.96 },
            { y: 0, opacity: 1, scale: 1, duration: 0.45, ease: "power3.out", stagger: 0.06 },
          );
        } else if (added === 1) {
          // 单条新增:只动画最后一条
          gsap.fromTo(
            ".bubble:last-child",
            { y: 16, opacity: 0, scale: 0.96 },
            { y: 0, opacity: 1, scale: 1, duration: 0.5, ease: "back.out(1.4)" },
          );
        }
      }
      prevCount.current = messages.length;
      bottomRef.current?.scrollIntoView({ block: "end" });
    },
    { scope: rootRef, dependencies: [messages.length] },
  );

  return (
    <div ref={rootRef} className="flex h-full flex-col">
      {/* 消息流 */}
      <ScrollArea className="flex-1 rounded-xl border border-border/50 bg-card/30">
        <div className="space-y-4 p-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-6 py-20 text-center">
              <Logo size={56} className="es-logo text-accent/80" />
              <div className="space-y-1.5">
                <h2 className="es-title text-2xl font-semibold tracking-tight">开始构建</h2>
                <p className="es-sub text-sm text-muted-foreground font-mono">lxcode_workspace</p>
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
                    className="es-card surface group rounded-xl p-3.5 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
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
                {m.role === "user" ? (
                  <div className="max-w-[72%] rounded-2xl rounded-tr-sm border border-border/50 bg-card px-3.5 py-2 text-[13px] leading-relaxed text-foreground">
                    {m.attachments?.length ? (
                      <div className="mb-2">
                        <AttachmentView
                          attachments={m.attachments}
                          onClick={(a) => a.kind === "image" && setLightbox(a)}
                        />
                      </div>
                    ) : null}
                    {m.text ? <div>{m.text}</div> : null}
                  </div>
                ) : (
                  <div className="max-w-[80%] min-w-0 rounded-2xl rounded-tl-sm border border-border/50 bg-card px-3.5 py-2.5">
                    {m.parts?.map((part: MessagePart) => {
                      if (part.type === "thinking") return <ThinkingBlock key={part.id} part={part} />;
                      if (part.type === "tool") return <ToolCallRow key={part.id} part={part} />;
                      return (
                        <div key={part.id} className="py-1 text-[13px] leading-relaxed">
                          {part.text}
                          {part.streaming ? (
                            <span className="ml-0.5 inline-block h-3.5 w-px animate-pulse bg-foreground/50 align-middle" />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* 输入区 */}
      <div className="mt-3">
        <Separator className="mb-3 bg-border/50" />
        {/* 斜杠命令菜单(输入 / 时显示) */}
        <SlashMenu
          open={slashOpen}
          query={slashQuery}
          onSelect={(insert) => setInput(insert)}
          onClose={() => setInput(input.replace(/^\/[a-z]*/, ""))}
        />
        <AttachmentView attachments={pending} view="pending" onRemove={removeAttachment} />
        <div className="flex items-center gap-2">
          {/* 一体化输入框:输入 + 内嵌上传按钮 */}
          <div className="relative flex-1">
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
            {/* 内嵌上传按钮组(输入框右侧) */}
            <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
              <button
                type="button"
                onClick={() => addAttachment({ id: `att${Date.now()}`, kind: "image", name: "截图.svg", url: "/img/ide-screenshot.svg" })}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
                title="添加图片"
              >
                <ImageIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => addAttachment({ id: `att${Date.now()}`, kind: "file", name: "requirements.md", size: "4.2 KB" })}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
                title="添加文件"
              >
                <FileText className="h-4 w-4" />
              </button>
            </div>
          </div>
          {isGenerating ? (
            <Button variant="destructive" className="h-10 shrink-0" onClick={abort}>
              中断
            </Button>
          ) : (
            <Button className="h-10 shrink-0 px-5 shadow-sm" disabled={!input.trim() && pending.length === 0} onClick={send}>
              发送
            </Button>
          )}
        </div>
        {/* 会话工具条:输入框下方,模型/思考/上下文 */}
        <ChatToolbar />
      </div>

      {/* 图片放大预览 */}
      <ImageLightbox image={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}
