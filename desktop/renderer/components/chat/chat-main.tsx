import { useEffect, useRef, useState } from "react";
import { ScrollArea } from "../../components/ui/scroll-area";
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
import { FileText, ImageIcon, ArrowUp, Square } from "lucide-react";

/** 对话主区:消息流 + 输入区(附件/斜杠/放大/工具条)。对接真实 agent。 */
export function ChatMain() {
  const projects = useSessionStore((s) => s.projects);
  const activeId = useSessionStore((s) => s.activeId);

  // 从 projects 找当前会话 + 所属项目(拿 cwd)
  let active: { id: string; title: string; cwd: string; projectName: string; sessionPath?: string } | undefined;
  for (const p of projects) {
    const s = p.sessions.find((x) => x.id === activeId && !x.archived);
    if (s) { active = { id: s.id, title: s.title, cwd: p.path, projectName: p.name, sessionPath: s.path }; break; }
  }

  const sessionId = active?.id ?? "";
  const cwd = active?.cwd ?? ".";
  const sessionPath = active?.sessionPath;
  const allMessages = useChatStore((s) => s.messagesBySession);
  const loadHistory = useChatStore((s) => s.loadHistory);
  const messages = allMessages[sessionId] ?? [];
  const input = useChatStore((s) => s.input);
  const isGenerating = useChatStore((s) => !!s.generatingBySession[sessionId]);
  const loadingHistory = useChatStore((s) => !!s.loadingHistoryBySession[sessionId]);
  const setInput = useChatStore((s) => s.setInput);
  const send = useChatStore((s) => s.send);
  const abort = useChatStore((s) => s.abort);
  const pending = useChatStore((s) => s.pendingAttachments);
  const addAttachment = useChatStore((s) => s.addAttachment);
  const removeAttachment = useChatStore((s) => s.removeAttachment);

  const bottomRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  // textarea 自动增高(单行保持 h-10,多行才扩展)
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    // 单行:重置为默认高度(让 h-10 生效),不设 inline height
    ta.style.height = "";
    // 多行:按 scrollHeight 扩展
    if (ta.scrollHeight > 40) ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  }, [input]);
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
        path: f.path,
        ...(f.kind === "image" ? { url: `file://${f.path}` } : { size: "" }),
      });
    }
  };

  // 流式回复时持续滚到底(依赖最后一条消息的 parts 数量+文本长度,工具调用也算)
  const lastMsg = messages.length ? messages[messages.length - 1] : null;
  const lastSig = lastMsg ? (lastMsg.parts ?? []).length * 1000 + (lastMsg.parts ?? []).reduce((n, p) => n + (p.type === "text" || p.type === "thinking" ? (p.text?.length ?? 0) : p.type === "tool" ? (p.arg?.length ?? 0) + (p.output?.length ?? 0) * 50 : 0), 0) + (lastMsg.text?.length ?? 0) : 0;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, lastSig]);

  // 切会话时滚到底(sessionId 变化)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [sessionId]);

  // 选中会话时加载历史消息(首次 + 路径有效)
  useEffect(() => {
    if (sessionId && sessionPath) void loadHistory(sessionId, sessionPath);
  }, [sessionId, sessionPath, loadHistory]);

  return (
    <div className="relative flex h-full flex-col bg-background">
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
      {/* 消息流:占满,底部留空给悬浮输入框 */}
      <ScrollArea className="flex-1">
        <div className="mx-auto max-w-3xl space-y-4 p-4 pb-32">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 py-20 text-center text-muted-foreground">
              {loadingHistory ? (
                <>
                  <span className="signal-dot signal-dot-live" aria-hidden />
                  <div className="text-sm">加载历史消息…</div>
                </>
              ) : (
                <>
                  <div className="text-sm">开始和 LXCode 对话</div>
                  <div className="text-xs text-muted-foreground/70">在下方输入消息,输入 / 唤出命令</div>
                </>
              )}
            </div>
          ) : (
            messages.map((m) => <ChatMessage key={m.id} message={m} onImageClick={setLightbox} />)
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* 悬浮输入区(Codex 风格:浮在消息区底部,不占文档流) */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10">
        {/* 渐变遮罩:消息滚动到底部时不被输入框盖死 */}
        <div className="h-8 bg-gradient-to-t from-background to-transparent" />
        <div className="pointer-events-auto bg-background/80 px-3 pb-3 backdrop-blur-sm">
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

          {/* 单行圆角输入条 */}
          <div className="mx-auto max-w-3xl">
            <div className="flex h-10 items-center gap-1 rounded-2xl border border-border/60 bg-card px-1.5 shadow-sm focus-within:border-accent/40 transition-colors">
              <button
                type="button"
                onClick={selectAndAdd}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="添加图片"
              >
                <ImageIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={selectAndAdd}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="添加文件"
              >
                <FileText className="h-4 w-4" />
              </button>
              <textarea
                ref={taRef}
                placeholder={isGenerating ? "生成中…" : "输入消息,回车发送(/ 唤出命令)"}
                value={input}
                disabled={isGenerating}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send(sessionId, cwd, sessionPath);
                  }
                }}
                rows={1}
                className="block h-10 w-full resize-none border-0 bg-transparent px-1 py-2.5 text-[13px] leading-tight text-foreground outline-none placeholder:text-muted-foreground/60 disabled:opacity-60"
                style={{ maxHeight: 120 }}
              />
              {isGenerating ? (
                <button
                  type="button"
                  onClick={() => void abort(sessionId)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-destructive text-destructive-foreground transition-opacity hover:opacity-90"
                  title="中断"
                >
                  <Square className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!input.trim() && pending.length === 0}
                  onClick={() => void send(sessionId, cwd, sessionPath)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
                  title="发送"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* 会话工具条:输入框下方,模型/思考/上下文 */}
          <div className="mx-auto mt-1.5 max-w-3xl">
            <ChatToolbar sessionId={sessionId} />
          </div>
        </div>
      </div>

      {/* 图片放大预览 */}
      <ImageLightbox image={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}
