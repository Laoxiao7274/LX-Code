import { Input } from "@/components/ui/input";

/** Input 输入框调试。 */
export function InputDemo() {
  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">基础</h3>
        <Input placeholder="请输入..." />
      </section>

      <section>
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">带默认值</h3>
        <Input defaultValue="已有内容" />
      </section>

      <section>
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">禁用</h3>
        <Input placeholder="禁用态" disabled />
      </section>

      <section>
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">不同类型</h3>
        <div className="grid max-w-sm gap-2">
          <Input type="email" placeholder="邮箱" />
          <Input type="password" placeholder="密码" defaultValue="secret" />
          <Input type="number" placeholder="数字" />
        </div>
      </section>
    </div>
  );
}
