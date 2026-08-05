import { useEffect, useState } from "react";
import { AppShell } from "./components/shell/app-shell";
import { useModelStore } from "./stores/model-store";
import { useSessionStore } from "./stores/session-store";
import { useSettingsStore } from "./stores/settings-store";
import { useUseCaseStore } from "./stores/usecase-store";
import { Logo } from "./components/ui/logo";

/**
 * LXCode 真实桌面应用根。
 * 启动时加载真实数据(设置/模型/用途/项目/会话),完成后再进主界面。
 */
export default function App() {
  const reloadModels = useModelStore((s) => s.reloadFromPi);
  const reloadSessions = useSessionStore((s) => s.reloadFromPi);
  const reloadSettings = useSettingsStore((s) => s.reload);
  const reloadUseCases = useUseCaseStore((s) => s.reload);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // 并行加载所有数据,全部完成才进主界面
    Promise.all([
      reloadSettings(),
      reloadModels(),
      reloadUseCases(),
      reloadSessions(),
    ])
      .catch(() => {})
      .finally(() => setReady(true));
  }, [reloadModels, reloadSessions, reloadSettings, reloadUseCases]);

  if (!ready) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-background">
        <Logo size={48} className="es-logo text-accent/80" />
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <span className="signal-dot signal-dot-live" aria-hidden />
          正在加载会话…
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-background p-2">
      <AppShell />
    </div>
  );
}
