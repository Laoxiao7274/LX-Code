import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  /** 尺寸(px),默认 32 */
  size?: number;
}

/**
 * LXCode 几何标志:六边形 + 内嵌 LX 字符。
 * 参照 CodeX 风格——简洁几何形,中性色,可缩放。
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
      {/* 六边形外框 */}
      <path
        d="M16 2.5l11.5 6.5v14L16 29.5 4.5 23V9L16 2.5z"
        fill="currentColor"
        fillOpacity={0.12}
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      {/* 内嵌 LX */}
      <text
        x="16"
        y="20.5"
        textAnchor="middle"
        fontSize="11"
        fontWeight="700"
        fill="currentColor"
        fontFamily="var(--font-sans)"
      >
        LX
      </text>
    </svg>
  );
}
