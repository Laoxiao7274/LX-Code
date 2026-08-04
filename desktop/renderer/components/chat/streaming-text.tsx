import { useEffect, useRef, useState, memo } from "react";
import { MarkdownText } from "./markdown-text";

/**
 * 流式 markdown 增量渲染(面试题场景):
 * 边流式边渲染 markdown,不必等标签闭合。
 *
 * 难点:markdown 需完整语法才好解析,且频繁 re-parse 卡顿。
 * 方案:
 * - 逐字追赶显示(rAF 每帧 +2 字),丝滑打字
 * - shown 文本传给 MarkdownText,react-markdown 容错不完整
 *   markdown(未闭合 ``` 代码块当普通文本,未闭合 ** 当文本)
 * - 节流 re-parse:用 rAF 合并同帧多次更新,避免每个 delta 都 re-parse
 * - streaming 结束时立即显示全部
 */
export const StreamingText = memo(function StreamingText({ content, streaming }: { content: string; streaming?: boolean }) {
  const [shown, setShown] = useState("");
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);

  useEffect(() => {
    let cur = lastRef.current;
    // 内容回退(切会话等):重置
    if (cur > content.length) { cur = 0; lastRef.current = 0; setShown(""); return; }
    // 逐字追赶(每帧 +2 字,平滑)
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

  // 结束时立即显示全部(追赶完成)
  useEffect(() => {
    if (!streaming && lastRef.current < content.length) {
      lastRef.current = content.length;
      setShown(content);
    }
  }, [streaming, content]);

  return (
    <div className="text-[13px] leading-relaxed text-foreground">
      <MarkdownText content={shown} />
    </div>
  );
});
