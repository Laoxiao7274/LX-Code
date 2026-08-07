/**
 * LXCode 品牌标:直接用应用图标 PNG(从 goal.png 生成),保证应用内 logo
 * 和软件图标完全一致。支持 className 控制尺寸。
 * 用法:<LxMark className="size-8" />
 */
import logoUrl from "../assets/lx-logo.png";

export function LxMark({ className = "" }: { className?: string }) {
  return (
    <img
      src={logoUrl}
      alt="LXCode"
      aria-hidden="true"
      className={`shrink-0 object-contain ${className}`}
      draggable={false}
    />
  );
}
