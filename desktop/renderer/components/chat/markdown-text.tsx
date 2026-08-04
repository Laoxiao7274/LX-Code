import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "../../lib/utils";

/**
 * 渲染 markdown 文本(agent 输出)。
 * 支持 GFM:表格/任务列表/删除线/链接。
 * 代码块用终端样式,行内代码用 chip 样式。
 */
export function MarkdownText({ content, className }: { content: string; className?: string }) {
  return (
    <div
      className={cn(
        "text-[13px] leading-relaxed text-foreground [&_p]:my-1.5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
        // 标题
        "[&_h1]:mt-3 [&_h1]:mb-1.5 [&_h1]:text-base [&_h1]:font-semibold",
        "[&_h2]:mt-2.5 [&_h2]:mb-1 [&_h2]:text-[15px] [&_h2]:font-semibold",
        "[&_h3]:mt-2 [&_h3]:mb-1 [&_h3]:text-[14px] [&_h3]:font-semibold",
        // 列表
        "[&_ul]:my-1.5 [&_ul]:pl-4 [&_ul]:list-disc [&_li]:my-0.5",
        "[&_ol]:my-1.5 [&_ol]:pl-4 [&_ol]:list-decimal [&_li]:my-0.5",
        // 链接
        "[&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:opacity-80",
        // 引用
        "[&_blockquote]:my-1.5 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
        // 行内代码
        "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[12px] [&_code]:font-mono",
        // 代码块(react-markdown 用 pre>code)
        "[&_pre]:my-2 [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-border/50 [&_pre]:bg-muted/40 [&_pre]:p-3 [&_pre]:text-[12px] [&_pre]:leading-relaxed [&_pre]:overflow-x-auto",
        "[&_pre_code]:block [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:font-mono",
        // 表格
        "[&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_table]:text-[12px]",
        "[&_th]:border [&_th]:border-border/50 [&_th]:bg-muted/40 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-medium",
        "[&_td]:border [&_td]:border-border/50 [&_td]:px-2 [&_td]:py-1",
        // 分隔线
        "[&_hr]:my-3 [&_hr]:border-border/50",
        // 任务列表
        "[&_li]:[&_input]:mr-1.5",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
