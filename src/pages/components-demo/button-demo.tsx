import { Button } from "@/components/ui/button";

/** Button 组件调试:展示所有 variant 与 size 组合。 */
export function ButtonDemo() {
  const variants = [
    "default",
    "secondary",
    "outline",
    "ghost",
    "destructive",
    "link",
  ] as const;
  const sizes = ["sm", "default", "lg", "icon"] as const;

  return (
    <div className="space-y-8">
      <section>
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">Variants</h3>
        <div className="flex flex-wrap gap-2">
          {variants.map((v) => (
            <Button key={v} variant={v}>
              {v}
            </Button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">Sizes</h3>
        <div className="flex flex-wrap items-center gap-2">
          {sizes.map((s) => (
            <Button key={s} size={s}>
              {s === "icon" ? "●" : s}
            </Button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">禁用态</h3>
        <div className="flex gap-2">
          <Button disabled>禁用</Button>
          <Button variant="outline" disabled>
            禁用描边
          </Button>
        </div>
      </section>
    </div>
  );
}
