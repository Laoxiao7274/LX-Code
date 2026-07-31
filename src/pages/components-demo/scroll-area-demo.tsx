import { ScrollArea } from "@/components/ui/scroll-area";

/** ScrollArea 滚动区调试:展示长内容滚动 + 自定义滚动条。 */
export function ScrollAreaDemo() {
  const items = Array.from({ length: 30 }, (_, i) => `第 ${i + 1} 行内容`.repeat(3));
  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">纵向滚动(固定 240px 高)</h3>
        <ScrollArea className="h-[240px] w-full rounded-md border border-border p-4">
          <div className="space-y-2">
            {items.map((t, i) => (
              <div key={i} className="rounded-md bg-muted/50 px-3 py-2 text-sm">
                {t}
              </div>
            ))}
          </div>
        </ScrollArea>
      </section>
    </div>
  );
}
