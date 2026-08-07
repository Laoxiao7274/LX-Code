import { useEffect, useState } from "react";
import { Boxes } from "lucide-react";
import { SectionHeader } from "../../components/SectionHeader";
import { Switch } from "../../components/Switch";
import { useT } from "../../lib/i18n/use-t";
import { useAppStore } from "../../lib/stores/app-store";
import { hostClient } from "../../lib/bridge/host-client";
import { hostContext } from "../../lib/bridge/host-context";
import type { BuiltinExtensionInfo } from "@lxcode/protocol";

export function BuiltinExtensionsSettings() {
  const t = useT();
  const host = useAppStore((s) => s.host);
  const [extensions, setExtensions] = useState<BuiltinExtensionInfo[]>([]);
  const [toggling, setToggling] = useState<string | null>(null);

  // 拉内置扩展列表
  useEffect(() => {
    if (!host) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await hostClient.request("builtinExtensions.list", hostContext(host), null);
        if (!cancelled && res.ok) setExtensions(res.result.extensions);
      } catch {
        // 静默
      }
    })();
    return () => { cancelled = true; };
  }, [host]);

  async function toggle(ext: BuiltinExtensionInfo, enabled: boolean) {
    if (!host || toggling) return;
    setToggling(ext.id);
    try {
      const res = await hostClient.request(
        "builtinExtensions.setEnabled",
        hostContext(host),
        { extensionId: ext.id, enabled },
      );
      if (res.ok) {
        setExtensions((list) => list.map((e) => (e.id === ext.id ? { ...e, enabled } : e)));
      }
    } catch {
      // 静默
    } finally {
      setToggling(null);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SectionHeader title={t("navBuiltinExtensions")} subtitle={t("builtinExtensionsSubtitle")} />
      <div className="min-h-0 flex-1 overflow-auto p-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-6">
          {extensions.length === 0 ? (
            <p className="text-sm text-muted">{t("builtinExtensionsSubtitle")}</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              {extensions.map((ext, i) => (
                <div
                  key={ext.id}
                  className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-border" : ""}`}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-overlay text-muted">
                    <Boxes size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{ext.name}</div>
                    <div className="text-xs text-muted">
                      {ext.enabled ? t("builtinExtensionsEnabled") : t("builtinExtensionsDisabled")}
                    </div>
                  </div>
                  <Switch
                    checked={ext.enabled}
                    onChange={(v) => void toggle(ext, v)}
                    label={ext.name}
                    disabled={toggling === ext.id}
                  />
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted">
            {t("builtinExtensionsSubtitle")}
          </p>
        </div>
      </div>
    </div>
  );
}
