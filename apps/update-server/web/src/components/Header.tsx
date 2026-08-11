import { LxMark } from "./LxMark";

export function Header({
  right,
}: {
  right?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <a href="#/" className="flex items-center gap-2 text-slate-900">
          <LxMark className="h-6 w-6 text-brand-600" />
          <span className="font-semibold tracking-tight">LXCode</span>
          <span className="text-xs font-normal text-slate-400">更新服务</span>
        </a>
        <div className="flex items-center gap-3">{right}</div>
      </div>
    </header>
  );
}
