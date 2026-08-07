import { useEffect, useMemo, useState } from "react";
import { FlaskConical } from "lucide-react";
import { SectionHeader } from "../../components/SectionHeader";
import { Select } from "../../components/Select";
import { Switch } from "../../components/Switch";
import { useT } from "../../lib/i18n/use-t";
import { useAppStore } from "../../lib/stores/app-store";

/** chrome-devtools server 配置(mcp.json 里的 chrome-devtools 条目)。 */
type ChromeDevtoolsConfig = {
  command: string;
  args: string[];
  env?: Record<string, string>;
};

/** 连接模式。 */
type ConnectMode = "launch" | "browserUrl" | "autoConnect";

/** 从 args 解析出 UI 用的设置。 */
function parseConfig(cfg: ChromeDevtoolsConfig | null) {
  const args = cfg?.args ?? [];
  const headless = args.includes("--headless");
  const isolated = args.includes("--isolated");
  const channelArg = args.find((a) => a.startsWith("--channel="))?.split("=")[1];
  const channel = (channelArg ?? "stable") as "stable" | "canary" | "beta";
  const browserUrl = args.find((a) => a.startsWith("--browser-url="))?.split("=")[1] ?? "";
  const executablePath = args.find((a) => a.startsWith("--executable-path="))?.split("=")[1] ?? "";
  const hasAutoConnect = args.includes("--auto-connect");
  const connectMode: ConnectMode = hasAutoConnect ? "autoConnect" : browserUrl ? "browserUrl" : "launch";
  return { headless, isolated, channel, browserUrl, executablePath, connectMode };
}

/** 从 UI 设置生成 args。 */
function buildArgs(opts: {
  headless: boolean;
  isolated: boolean;
  channel: "stable" | "canary" | "beta";
  browserUrl: string;
  executablePath: string;
  connectMode: ConnectMode;
}): string[] {
  const args: string[] = [];
  if (opts.connectMode === "launch") {
    if (opts.headless) args.push("--headless");
    if (opts.isolated) args.push("--isolated");
    if (opts.channel !== "stable") args.push(`--channel=${opts.channel}`);
    if (opts.executablePath.trim()) args.push(`--executable-path=${opts.executablePath.trim()}`);
  } else if (opts.connectMode === "browserUrl") {
    if (opts.browserUrl.trim()) args.push(`--browser-url=${opts.browserUrl.trim()}`);
  } else if (opts.connectMode === "autoConnect") {
    args.push("--auto-connect");
    if (opts.channel !== "stable") args.push(`--channel=${opts.channel}`);
  }
  return args;
}

export function AutomationTestSettings() {
  const t = useT();
  const pushNotification = useAppStore((s) => s.pushNotification);
  const [enabled, setEnabled] = useState<boolean>(true);
  const [opts, setOpts] = useState(() => parseConfig(null));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function readConfig() {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const raw = await invoke<string>("automation_test_config_get");
      const cfg = raw && raw !== "{}" ? (JSON.parse(raw) as ChromeDevtoolsConfig) : null;
      setEnabled(Boolean(cfg));
      setOpts(parseConfig(cfg));
    } catch {
      // 静默
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void readConfig();
  }, []);

  async function persist(next: { enabled: boolean; opts: ReturnType<typeof parseConfig> }) {
    setSaving(true);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      if (!next.enabled) {
        // 禁用:传空对象删除 chrome-devtools 条目
        await invoke("automation_test_config_set", { config: "{}" });
      } else {
        const config: ChromeDevtoolsConfig = {
          command: "npx",
          args: ["-y", "chrome-devtools-mcp@latest", ...buildArgs(next.opts)],
        };
        await invoke("automation_test_config_set", { config: JSON.stringify(config) });
      }
      setEnabled(next.enabled);
      setOpts(next.opts);
    } catch (e) {
      pushNotification(t("automationTestSaveFail") + (e instanceof Error ? `: ${e.message}` : ""), "error");
    } finally {
      setSaving(false);
    }
  }

  const connectModeOpts = useMemo(
    () => [
      { value: "launch", label: t("automationTestModeLaunch") },
      { value: "browserUrl", label: t("automationTestModeBrowserUrl") },
      { value: "autoConnect", label: t("automationTestModeAutoConnect") },
    ],
    [t],
  );

  const channelOpts = useMemo(
    () => [
      { value: "stable", label: t("automationTestChannelStable") },
      { value: "canary", label: t("automationTestChannelCanary") },
      { value: "beta", label: t("automationTestChannelBeta") },
    ],
    [t],
  );

  if (loading) {
    return (
      <div className="min-h-0 flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-2xl">
          <SectionHeader title={t("navAutomationTest")} subtitle={t("automationTestSubtitle")} />
          <div className="py-8 text-center text-sm text-muted">{t("providersLoading")}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto p-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <SectionHeader title={t("navAutomationTest")} subtitle={t("automationTestSubtitle")} />

        <div className="rounded-lg border border-border bg-surface-overlay/30 px-4 py-3 text-xs text-muted">
          {t("automationTestHint")}
        </div>
        <div className="rounded-lg border border-border bg-surface-overlay/30 px-4 py-3 text-xs text-muted">
          {t("automationTestUniversalHint")}
        </div>

        {/* 启用开关 */}
        <div className="rounded-lg border border-border p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <FlaskConical size={14} className="text-accent" />
                {t("automationTestEnable")}
              </div>
              <div className="mt-1 text-xs text-muted">{t("automationTestEnableDesc")}</div>
            </div>
            <Switch
              checked={enabled}
              disabled={saving}
              onChange={(on) => void persist({ enabled: on, opts })}
              label={t("automationTestEnable")}
            />
          </div>
        </div>

        {enabled && (
          <>
            {/* 连接模式 */}
            <div className="rounded-lg border border-border p-4">
              <div className="mb-3 text-sm font-medium">{t("automationTestConnectMode")}</div>
              <Select
                value={opts.connectMode}
                onChange={(v) => void persist({ enabled, opts: { ...opts, connectMode: v as ConnectMode } })}
                options={connectModeOpts}
                className="w-full"
              />
              <p className="mt-2 text-xs text-muted">
                {opts.connectMode === "launch"
                  ? t("automationTestModeLaunchDesc")
                  : opts.connectMode === "browserUrl"
                    ? t("automationTestModeBrowserUrlDesc")
                    : t("automationTestModeAutoConnectDesc")}
              </p>

              {opts.connectMode === "browserUrl" && (
                <input
                  className="mt-3 h-8 w-full rounded-md border border-border bg-surface px-2 text-xs text-foreground placeholder:text-muted focus:border-accent"
                  placeholder={t("automationTestBrowserUrlPlaceholder")}
                  value={opts.browserUrl}
                  onChange={(e) => setOpts({ ...opts, browserUrl: e.target.value })}
                  onBlur={() => void persist({ enabled, opts })}
                />
              )}
            </div>

            {/* 启动模式选项 */}
            {opts.connectMode === "launch" && (
              <div className="rounded-lg border border-border p-4">
                <div className="mb-3 text-sm font-medium">{t("automationTestLaunchOptions")}</div>
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{t("automationTestHeadless")}</div>
                      <div className="mt-1 text-xs text-muted">{t("automationTestHeadlessDesc")}</div>
                    </div>
                    <Switch
                      checked={opts.headless}
                      disabled={saving}
                      onChange={(on) => void persist({ enabled, opts: { ...opts, headless: on } })}
                      label={t("automationTestHeadless")}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{t("automationTestIsolated")}</div>
                      <div className="mt-1 text-xs text-muted">{t("automationTestIsolatedDesc")}</div>
                    </div>
                    <Switch
                      checked={opts.isolated}
                      disabled={saving}
                      onChange={(on) => void persist({ enabled, opts: { ...opts, isolated: on } })}
                      label={t("automationTestIsolated")}
                    />
                  </div>
                  <div>
                    <div className="mb-1.5 text-sm font-medium">{t("automationTestChannel")}</div>
                    <Select
                      value={opts.channel}
                      onChange={(v) => void persist({ enabled, opts: { ...opts, channel: v as "stable" | "canary" | "beta" } })}
                      options={channelOpts}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <div className="mb-1.5 text-sm font-medium">{t("automationTestExecutablePath")}</div>
                    <input
                      className="h-8 w-full rounded-md border border-border bg-surface px-2 text-xs text-foreground placeholder:text-muted focus:border-accent"
                      placeholder={t("automationTestExecutablePathPlaceholder")}
                      value={opts.executablePath}
                      onChange={(e) => setOpts({ ...opts, executablePath: e.target.value })}
                      onBlur={() => void persist({ enabled, opts })}
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        <p className="text-xs text-muted">{t("automationTestNote")}</p>
      </div>
    </div>
  );
}
