import { AppShell } from "./components/shell/app-shell";

/**
 * LXCode 真实桌面应用根。
 * 真实 agent 后端(Electron 主进程 pi-core),非设计原型。
 */
export default function App() {
  return (
    <div className="h-screen w-screen bg-background p-2">
      <AppShell />
    </div>
  );
}
