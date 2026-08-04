import { useEffect, useRef, useState, memo } from "react";

/**
 * 流式文本:逐字显示 + 每字 fade-in,丝滑打字效果。
 * 接收完整 content(流式累加),内部按字符数追赶显示,
 * 每帧加 1-2 字,新字符带 opacity 0→1 过渡。
 */
export const StreamingText = memo(function StreamingText({ content, streaming }: { content: string; streaming?: boolean }) {
  const [shown, setShown] = useState("");
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);

  useEffect(() => {
    // 已显示长度
    let cur = lastRef.current;
    if (cur > content.length) { cur = content.length; lastRef.current = cur; setShown(content); return; }
    // 立即追赶(每帧加 1-3 字,平滑)
    const step = () => {
      if (cur >= content.length) return;
      cur = Math.min(content.length, cur + 2);
      lastRef.current = cur;
      setShown(content.slice(0, cur));
      rafRef.current = requestAnimationFrame(step);
    };
    if (cur < content.length) rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [content]);

  // 结束时立即显示全部
  useEffect(() => {
    if (!streaming && shown.length < content.length) { setShown(content); lastRef.current = content.length; }
  }, [streaming, content, shown.length]);

  return (
    <div className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-foreground">
      {shown}
    </div>
  );
});
