import { useEffect, useRef, useState } from "react";
import { ScrollArea } from "../../components/ui/scroll-area";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { cn } from "../../lib/utils";
import { useChatStore } from "../../stores/chat-store";
import type { Attachment } from "../../stores/chat-store";
import { useSessionStore } from "../../stores/session-store";
import { ChatMessage } from "./chat-message";
import { AttachmentView } from "./attachment-view";
import { ImageLightbox } from "./image-lightbox";
import { SlashMenu } from "./slash-menu";
import { ChatToolbar } from "./chat-toolbar";
import { FileText, ImageIcon } from "lucide-react";

/** 对话主区:消息流 + 输入区(附件/斜杠/放大/工具条)。对接真实 agent。 */
export function ChatMain() {
  const projects = useSessionStore((s) => s.projects);
  const activeId = useSessionStore((s) => s.activeId);

  // 从 projects 找当前会话 + 所属项目(拿 cwd)
  let active: { id: string; title: string; cwd: string; projectName: string } | undefined;
  for (const p of projects) {
    const s = p.sessions.find((x) => x.id === activeId && !x.archived);
    if (s) { active = { id: s.id, title: s.title, cwd: p.path, projectName: p.name }; break; }
  }

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

  // 真实选择附件文件(系统对话框,区分图片/文件)
  const selectAndAdd = async () => {
    if (typeof window === "undefined" || !window.lxcode?.data) return;
    const res = await window.lxcode.data.selectFiles();
    if (!res.ok || !res.files) return;
    for (const f of res.files) {
      addAttachment({
        id: `att${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        kind: f.kind,
        name: f.name,
        ...(f.kind === "image" ? { url: `file://${f.path}` } : { size: "" }),
      });
    }
  };

  // 新消息滚到底
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  return (
    <div className="flex h-full flex-col bg-background">
      {/* 顶栏:会话标题 + 项目名 */}
      <div className="flex h-11 items-center gap-2.5 border-b border-border/60 px-3">
        <span className="text-[13px] font-medium tracking-tight">
          {active?.title ?? "未选择会话"}
        </span>
        {active ? (
          <Badge variant="outline" className="h-4 px-1.5 text-[10px] font-normal text-muted-foreground">
            {active.projectName}
          </Badge>
        ) : null}
      </div>

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

        {/* 输入框 + 内嵌上传按钮 + 发送 */}
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <div className="relative flex-1">
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
            {/* 内嵌上传按钮组(输入框右侧) */}
            <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
              <button
                type="button"
                onClick={selectAndAdd}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
                title="添加图片"
              >
                <ImageIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={selectAndAdd}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
                title="添加文件"
              >
                <FileText className="h-4 w-4" />
              </button>
            </div>
          </div>
          {isGenerating ? (
            <Button variant="destructive" className="h-10 shrink-0" onClick={() => void abort(sessionId)}>
              中断
            </Button>
          ) : (
            <Button
              className="h-10 shrink-0 px-5 shadow-sm"
              disabled={!input.trim() && pending.length === 0}
              onClick={() => void send(sessionId, cwd)}
            >
              发送
            </Button>
          )}
        </div>

        {/* 会话工具条:输入框下方,模型/思考/上下文 */}
        <div className="mx-auto mt-1.5 max-w-3xl">
          <ChatToolbar sessionId={sessionId} />
        </div>
      </div>

      {/* 图片放大预览 */}
      <ImageLightbox image={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}
