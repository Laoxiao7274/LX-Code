import { Badge } from "@/components/ui/badge";

/** Badge 徽标调试:4 种 variant。 */
export function BadgeDemo() {
  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">Variants</h3>
        <div className="flex flex-wrap gap-2">
          <Badge>默认</Badge>
          <Badge variant="secondary">次要</Badge>
          <Badge variant="destructive">危险</Badge>
          <Badge variant="outline">描边</Badge>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">用途示例</h3>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>任务状态:</span>
          <Badge variant="secondary">进行中</Badge>
          <Badge variant="default">已完成</Badge>
          <Badge variant="destructive">失败</Badge>
          <Badge variant="outline">待处理</Badge>
        </div>
      </section>
    </div>
  );
}
