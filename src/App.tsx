import { Button } from "@/components/ui/button";

export default function App() {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-2xl font-semibold text-foreground">LXCode</h1>
        <p className="text-sm text-muted-foreground">组件库地基已就绪</p>
        <div className="flex gap-2">
          <Button>默认按钮</Button>
          <Button variant="secondary">次要</Button>
          <Button variant="outline">描边</Button>
          <Button variant="ghost">幽灵</Button>
          <Button variant="destructive">危险</Button>
        </div>
        <div className="flex gap-2">
          <Button size="sm">小</Button>
          <Button size="lg">大</Button>
          <Button size="icon">●</Button>
        </div>
      </div>
    </div>
  );
}
