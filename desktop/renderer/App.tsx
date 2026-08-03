import { useEffect } from "react";
import { AppShell } from "./components/shell/app-shell";
import { useModelStore } from "./stores/model-store";
import { useSessionStore } from "./stores/session-store";

/**
 * LXCode 真实桌面应用根。
 */
export default function App() {
  const reloadModels = useModelStore((s) => s.reloadFromPi);
  const reloadSessions = useSessionStore((s) => s.reloadFromPi);

  // 启动时从 pi-core 加载真实 providers + models + 已有会话
  useEffect(() => {
    void reloadModels();
    // 工作目录先用电项目根(后续接选目录)
    void reloadSessions("C:/Users/xzy/Desktop/my/lx-code");
  }, [reloadModels, reloadSessions]);

  return (
    <div className="h-screen w-screen bg-background p-2">
      <AppShell />
    </div>
  );
}
