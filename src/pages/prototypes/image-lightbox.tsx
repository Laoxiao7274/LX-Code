import { useEffect } from "react";
import { X } from "lucide-react";
import type { Attachment } from "./chat-store";

interface ImageLightboxProps {
  /** 当前展示的图片,null 表示关闭。 */
  image: Attachment | null;
  onClose: () => void;
}

/**
 * 图片放大预览:全屏遮罩 + 居中大图 + 右上关闭。
 * 点遮罩或按 Esc 关闭。图片按 object-contain 适应窗口。
 */
export function ImageLightbox({ image, onClose }: ImageLightboxProps) {
  // Esc 关闭
  useEffect(() => {
    if (!image) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [image, onClose]);

  if (!image) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* 关闭按钮 */}
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
        aria-label="关闭"
      >
        <X className="h-5 w-5" />
      </button>

      {/* 大图(点击不冒泡) */}
      <img
        src={image.url}
        alt={image.name}
        onClick={(e) => e.stopPropagation()}
        className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
      />

      {/* 图片名 */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs text-white/90 font-mono">
        {image.name}
      </div>
    </div>
  );
}
