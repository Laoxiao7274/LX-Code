import { Textarea } from "@/components/ui/textarea";

/** Textarea 多行输入调试。 */
export function TextareaDemo() {
  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">基础</h3>
        <Textarea placeholder="请输入多行内容..." />
      </section>

      <section>
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">带默认值</h3>
        <Textarea defaultValue={"第一行\n第二行\n第三行"} />
      </section>

      <section>
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">禁用</h3>
        <Textarea placeholder="禁用态" disabled />
      </section>

      <section>
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">固定高度</h3>
        <Textarea placeholder="高度 120px" className="h-[120px]" />
      </section>
    </div>
  );
}
