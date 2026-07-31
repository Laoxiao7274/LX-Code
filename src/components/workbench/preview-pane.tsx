import type { ReactNode } from "react";

interface PreviewPaneProps {
  title: string;
  description?: string;
  children: ReactNode;
}

/** 预览区:顶部标题 + 说明,下方为原型/组件渲染区。 */
export function PreviewPane({ title, description, children }: PreviewPaneProps) {
  return (
    <main className="flex h-full flex-col bg-background">
      <header className="border-b border-border px-4 py-2.5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </header>
      <div className="flex-1 overflow-auto p-4">{children}</div>
    </main>
  );
}
