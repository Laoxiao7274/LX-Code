import { FileText, ImageIcon, X } from "lucide-react";
import type { Attachment } from "./chat-store";
import { cn } from "@/lib/utils";

type View = "message" | "pending";

interface AttachmentViewProps {
  attachments: Attachment[];
  view?: View;
  /** pending 视图下移除附件。 */
  onRemove?: (id: string) => void;
  /** message 视图下点击图片。 */
  onClick?: (a: Attachment) => void;
}

/** 图片缩略图占位:不同 fileIndex 给不同渐变,模拟真实图片缩略图。 */
function ImageThumb({ a, onClick }: { a: Attachment; onClick?: () => void }) {
  const hues = ["from-sky-400/70 to-indigo-500/70", "from-fuchsia-400/70 to-purple-500/70", "from-amber-400/70 to-rose-500/70"];
  // 用 name 的 hash 稳定选一个渐变
  const idx = a.name.split("").reduce((s, c) => s + c.charCodeAt(0), 0) % hues.length;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "block overflow-hidden rounded-lg border border-border/60 bg-gradient-to-br transition hover:opacity-90",
        hues[idx],
      )}
    >
      <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-white">
        <ImageIcon className="h-5 w-5 opacity-90" />
        <span className="px-1 text-[9px] font-medium leading-tight break-all">{a.name}</span>
      </div>
    </button>
  );
}

/**
 * 附件渲染:
 * - message 视图:嵌在气泡内,图片网格 + 文件卡片(带大小)
 * - pending 视图:嵌在输入区上方,可移除(X)。小尺寸。
 */
export function AttachmentView({ attachments, view = "message", onRemove, onClick }: AttachmentViewProps) {
  if (!attachments.length) return null;
  const images = attachments.filter((a) => a.kind === "image");
  const files = attachments.filter((a) => a.kind === "file");
  const pending = view === "pending";

  return (
    <div className={cn("flex flex-wrap gap-2", pending ? "mb-1.5" : "mt-0")}>
      {/* 图片网格 */}
      {images.length ? (
        <div className={cn("grid gap-1.5", pending ? "grid-cols-4" : images.length > 2 ? "grid-cols-3" : "grid-cols-2")}>
          {images.map((img) => (
            <div key={img.id} className="group relative">
              <ImageThumb
                a={img}
                onClick={() => !pending && onClick?.(img)}
              />
              {pending ? (
                <button
                  type="button"
                  onClick={() => onRemove?.(img.id)}
                  className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-foreground text-background shadow-sm transition hover:bg-destructive"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {/* 文件卡片 */}
      {files.map((f) => (
        <div
          key={f.id}
          className={cn(
            "group relative flex items-center gap-2 rounded-lg border border-border/60 bg-muted/40",
            pending ? "h-9 px-2.5" : "max-w-[220px] px-3 py-2",
          )}
        >
          <FileText className="h-4 w-4 shrink-0 text-foreground/70" />
          <div className="min-w-0">
            <div className="truncate text-[12px] font-medium leading-tight">{f.name}</div>
            {f.size ? <div className="text-[10px] text-muted-foreground font-mono">{f.size}</div> : null}
          </div>
          {pending ? (
            <button
              type="button"
              onClick={() => onRemove?.(f.id)}
              className="flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition hover:bg-destructive hover:text-white"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
