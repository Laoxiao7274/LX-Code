import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

/** Avatar 头像调试:图片 + 回退文字 + 不同尺寸。 */
export function AvatarDemo() {
  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">图片头像 + 回退</h3>
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarImage src="https://github.com/shadcn.png" alt="头像" />
            <AvatarFallback>U</AvatarFallback>
          </Avatar>
          <Avatar>
            <AvatarFallback>LX</AvatarFallback>
          </Avatar>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">不同尺寸</h3>
        <div className="flex items-end gap-3">
          <Avatar className="h-6 w-6">
            <AvatarFallback className="text-[10px]">S</AvatarFallback>
          </Avatar>
          <Avatar className="h-10 w-10">
            <AvatarFallback>M</AvatarFallback>
          </Avatar>
          <Avatar className="h-14 w-14">
            <AvatarFallback className="text-lg">L</AvatarFallback>
          </Avatar>
        </div>
      </section>
    </div>
  );
}
