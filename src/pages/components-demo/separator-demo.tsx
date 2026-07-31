import { Separator } from "@/components/ui/separator";

/** Separator 分隔线调试:水平 / 垂直。 */
export function SeparatorDemo() {
  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">水平</h3>
        <div className="text-sm text-muted-foreground">上方内容</div>
        <Separator className="my-3" />
        <div className="text-sm text-muted-foreground">下方内容</div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">垂直(在 flex 中)</h3>
        <div className="flex h-12 items-center gap-4 text-sm">
          <span>左</span>
          <Separator orientation="vertical" />
          <span>中</span>
          <Separator orientation="vertical" />
          <span>右</span>
        </div>
      </section>
    </div>
  );
}
