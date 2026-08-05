import { cn } from "../../lib/utils";

interface LogoProps {
  className?: string;
  /** 尺寸(px),默认 32 */
  size?: number;
}

/**
 * LXCode 标志:六边形 + LX 字母几何化(代码符号感)。
 * L 横竖线 + X 交叉,内嵌六边形,accent 渐变。
 * 参照 CodeX 几何风格,LXCode 专属识别。
 */
export function Logo({ className, size = 32 }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={cn("text-accent", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id="lx-logo-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="currentColor" stopOpacity={0.9} />
          <stop offset="1" stopColor="currentColor" stopOpacity={0.6} />
        </linearGradient>
      </defs>
      {/* 六边形外框(圆角) */}
      <path
        d="M16 2.5l11.5 6.5v14L16 29.5 4.5 23V9L16 2.5z"
        fill="url(#lx-logo-grad)"
        fillOpacity={0.14}
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      {/* LX 几何字母:L 的竖+横, X 的两条交叉线 */}
      {/* L:竖线 + 底横 */}
      <path
        d="M10 10.5v9.5h5.5"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* X:两条交叉线(代码括号感) */}
      <path
        d="M18.5 10.5l6 9.5M24.5 10.5l-6 9.5"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* 底部小点(代码光标感) */}
      <circle cx="16" cy="24.5" r="1.1" fill="currentColor" />
    </svg>
  );
}
