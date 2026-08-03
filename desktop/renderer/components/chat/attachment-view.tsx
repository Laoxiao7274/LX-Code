import { FileCode, FileText, FileJson, Image as ImageIcon, FileSpreadsheet, FileArchive, Terminal, Type, X } from "lucide-react";
import type { Attachment } from "../../stores/chat-store";
import { cn } from "../../lib/utils";

type View = "message" | "pending";

interface AttachmentViewProps {
  attachments: Attachment[];
  view?: View;
  onRemove?: (id: string) => void;
  onClick?: (a: Attachment) => void;
}

/** 文件类型信息:图标 + 颜色 + 类型名。按扩展名区分。 */
function fileInfo(name: string): { Icon: typeof FileText; color: string; type: string } {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, { Icon: typeof FileText; color: string; type: string }> = {
    ts: { Icon: FileCode, color: "text-sky-500", type: "TS" },
    tsx: { Icon: FileCode, color: "text-sky-500", type: "TSX" },
    js: { Icon: FileCode, color: "text-amber-500", type: "JS" },
    jsx: { Icon: FileCode, color: "text-amber-500", type: "JSX" },
    json: { Icon: FileJson, color: "text-yellow-500", type: "JSON" },
    md: { Icon: FileText, color: "text-slate-500", type: "MD" },
    py: { Icon: FileCode, color: "text-blue-500", type: "PY" },
    css: { Icon: Type, color: "text-fuchsia-500", type: "CSS" },
    html: { Icon: FileCode, color: "text-orange-500", type: "HTML" },
    sh: { Icon: Terminal, color: "text-emerald-500", type: "SH" },
    zip: { Icon: FileArchive, color: "text-amber-500", type: "ZIP" },
    xlsx: { Icon: FileSpreadsheet, color: "text-green-500", type: "表格" },
    png: { Icon: ImageIcon, color: "text-purple-500", type: "图片" },
    jpg: { Icon: ImageIcon, color: "text-purple-500", type: "图片" },
    jpeg: { Icon: ImageIcon, color: "text-purple-500", type: "图片" },
    gif: { Icon: ImageIcon, color: "text-purple-500", type: "图片" },
    webp: { Icon: ImageIcon, color: "text-purple-500", type: "图片" },
  };
  return map[ext] ?? { Icon: FileText, color: "text-muted-foreground", type: ext.toUpperCase() || "文件" };
}

const basename = (name: string) => name.split("/").pop() ?? name;

/** 图片缩略图:优先用真实 url(附件的 url),否则渐变占位。 */
function ImageThumb({ a }: { a: Attachment }) {
  if (a.url) {
    return <img src={a.url} alt={a.name} className="h-full w-full object-cover" />;
  }
  const pale = [
    "from-sky-400/70 to-indigo-500/70",
    "from-fuchsia-400/70 to-purple-500/70",
    "from-amber-400/70 to-rose-500/70",
    "from-emerald-400/70 to-teal-500/70",
  ];
  const idx = a.name.split("").reduce((s, c) => s + c.charCodeAt(0), 0) % pale.length;
  return (
    <div className={cn("flex h-full w-full items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br", pale[idx])}>
      <span className="text-white opacity-90">
        <ImageIcon className="h-6 w-6" />
      </span>
    </div>
  );
}

/**
 * 附件渲染。
 * - pending 视图:输入区上方小尺寸,可移除
 * - message 视图:气泡内完整尺寸,图片网格 + 文件卡片
 *
 * 文件卡片(opencode file-chip 风格):
 * - 按扩展名区分图标 + 颜色(code/文档/图片各自配色)
 * - 文件名粗体 + 类型 chip
 * - 圆角 + 边框 + hover 状态
 */
export function AttachmentView({ attachments, view = "message", onRemove, onClick }: AttachmentViewProps) {
  if (!attachments.length) return null;
  const pending = view === "pending";
  const images = attachments.filter((a) => a.kind === "image");
  const files = attachments.filter((a) => a.kind === "file");
  const gridCols = images.length === 1 ? "grid-cols-2" : images.length === 2 ? "grid-cols-3" : "grid-cols-4";

  return (
    <div className={cn("flex flex-wrap gap-2", pending && "mb-1.5")}>
      {/* 图片网格 */}
      {images.length ? (
        <div className={cn("grid gap-1.5", pending ? "grid-cols-4" : gridCols)}>
          {images.map((img) => (
            <div key={img.id} className="relative">
              <button type="button" onClick={() => !pending && onClick?.(img)} className="block">
                <div className="h-14 w-14 md:h-16 md:w-16">
                  <ImageThumb a={img} />
                </div>
              </button>
              {pending ? (
                <button
                  type="button"
                  onClick={() => onRemove?.(img.id)}
                  className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-foreground text-background shadow-sm hover:bg-destructive"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {/* 文件卡片:单色中性,图标灰 + 文件名 + 大小(opencode 克制风格) */}
      {files.map((f) => {
        const { Icon } = fileInfo(f.name);
        return (
          <div
            key={f.id}
            className="flex w-full items-center gap-2.5 rounded-lg border border-border/60 bg-background px-3 py-2 transition-colors hover:bg-muted/40"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium text-foreground">{basename(f.name)}</div>
              <div className="truncate text-[11px] text-muted-foreground">{f.size ?? "文档"}</div>
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
        );
      })}
    </div>
  );
}
