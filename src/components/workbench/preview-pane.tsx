import type { ReactNode } from "react";

interface PreviewPaneProps {
  title: string;
  description?: string;
  children: ReactNode;
}

/** 预览区:顶部标题 + 说明,下方为原型/组件渲染区(带内边距与留白)。 */
export function PreviewPane({ title, description, children }: PreviewPaneProps) {
  return (
    <main className="flex h-full flex-col bg-background">
      <header className="flex h-10 items-center gap-2 border-b border-border/60 px-4">
        <h2 className="text-[13px] font-medium tracking-tight">{title}</h2>
        {description ? (
          <>
            <span className="text-xs text-muted-foreground/60">·</span>
            <span className="text-xs text-muted-foreground">{description}</span>
          </>
        ) : null}
      </header>
      <div className="flex-1 overflow-auto p-4">{children}</div>
    </main>
  );
}
