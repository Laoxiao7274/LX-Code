import { useEffect } from "react";
import { AppShell } from "./components/shell/app-shell";
import { useModelStore } from "./stores/model-store";
import { useSessionStore } from "./stores/session-store";
import { useSettingsStore } from "./stores/settings-store";
import { useUseCaseStore } from "./stores/usecase-store";

/**
 * LXCode 真实桌面应用根。
 */
export default function App() {
  const reloadModels = useModelStore((s) => s.reloadFromPi);
  const reloadSessions = useSessionStore((s) => s.reloadFromPi);
  const reloadSettings = useSettingsStore((s) => s.reload);
  const reloadUseCases = useUseCaseStore((s) => s.reload);

  // 启动时加载真实数据:设置 + 模型 + 用途 + 项目/会话
  useEffect(() => {
    void reloadSettings();
    void reloadModels();
    void reloadUseCases();
    void reloadSessions();
  }, [reloadModels, reloadSessions, reloadSettings, reloadUseCases]);

  return (
    <div className="h-screen w-screen bg-background p-2">
      <AppShell />
    </div>
  );
}
