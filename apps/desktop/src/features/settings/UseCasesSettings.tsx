import { useEffect, useMemo, useState } from "react";
import { Boxes, Image, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SectionHeader } from "../../components/SectionHeader";
import { Select } from "../../components/Select";
import { useT, type Translate } from "../../lib/i18n/use-t";
import { useAppStore } from "../../lib/stores/app-store";
import { hostClient } from "../../lib/bridge/host-client";
import { hostContext } from "../../lib/bridge/host-context";
import { requestWithRetry } from "../../lib/bridge/request-retry";
import { persistDesktopSettings } from "../../lib/desktop-settings";
import type { ProviderSnapshot } from "@lxcode/protocol";

/** 预设用途:只保留两个 — 嵌入向量化(语义检索/索引)和视觉理解(图片)。 */
type UseCaseDef = {
  id: string;
  labelKey: Parameters<Translate>[0];
  descKey: Parameters<Translate>[0];
  icon: LucideIcon;
  selectable: boolean;
};

const USE_CASES: UseCaseDef[] = [
  { id: "embed", labelKey: "useCasesEmbedLabel", descKey: "useCasesEmbedDesc", icon: Boxes, selectable: true },
  { id: "vision", labelKey: "useCasesVisionLabel", descKey: "useCasesVisionDesc", icon: Image, selectable: true },
  { id: "summary", labelKey: "useCasesSummaryLabel", descKey: "useCasesSummaryDesc", icon: Sparkles, selectable: true },
];

/** 扁平模型列表项:provider/modelId。 */
/** 扁平模型列表项:provider/modelId + 是否支持视觉。 */
type ModelOption = { key: string; label: string; provider: string; vision: boolean };

export function UseCasesSettings() {
  const t = useT();
  const host = useAppStore((s) => s.host);
  const hostInstanceId = host?.hostInstanceId;
  const providerConfigRevision = useAppStore((s) => s.providerConfigRevision);
  const desktopSettings = useAppStore((s) => s.desktopSettings);
  const session = useAppStore((s) => s.session);
  const [providers, setProviders] = useState<ProviderSnapshot[]>([]);

  // 拉启用的 provider 列表(含 models),用于模型下拉。用 requestWithRetry(host 未就绪自动重试)。
  // 依赖用 hostInstanceId(字符串稳定),不用 host 对象(每次渲染可能新引用导致 effect 疯狂重跑)。
  useEffect(() => {
    if (!hostInstanceId) return;
    const requestHost = useAppStore.getState().host;
    if (!requestHost) return;
    let cancelled = false;
    void requestWithRetry(
      () => hostClient.request("provider.list", hostContext(requestHost), null),
      undefined,
      () => !cancelled,
    ).then((response) => {
      if (cancelled || !response) return;
      if (response.ok) setProviders(response.result.providers);
    });
    return () => { cancelled = true; };
  }, [hostInstanceId, providerConfigRevision]);

  // 扁平可用模型(所有 provider 的所有模型,不限启用状态——用途分配不要求 provider 启用)
  const allModels = useMemo<ModelOption[]>(() => {
    const out: ModelOption[] = [];
    for (const p of providers) {
      for (const m of p.models) {
        out.push({ key: `${p.id}/${m.id}`, label: m.name || m.id, provider: p.name, vision: m.input.includes("image") });
      }
    }
    return out;
  }, [providers]);

  // 视觉用途只显示支持视觉的模型(input 含 image)
  const visionModels = useMemo(() => allModels.filter((m) => m.vision), [allModels]);

  // 当前用途配置:useCase id -> modelKey(空串=跟随默认)
  const useCases = desktopSettings?.useCases ?? {};
  // 默认模型 = 当前会话的主模型(session.model);未指定用途时用这个
  const defaultModelLabel = session?.model ? (session.model.name || session.model.modelId) : "—";

  function setUseCase(id: string, modelKey: string) {
    const next = { ...useCases, [id]: modelKey };
    void persistDesktopSettings({ useCases: next });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SectionHeader title={t("navUseCases")} subtitle={t("useCasesSubtitle")} />
      <div className="min-h-0 flex-1 overflow-auto p-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-6">
          {/* 默认模型提示 */}
          <div className="rounded-lg border border-border bg-surface-overlay/30 px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">{t("useCasesDefaultModel")}</span>
              <span className="font-mono text-muted">{defaultModelLabel}</span>
            </div>
            <p className="mt-1 text-xs text-muted">{t("useCasesSubtitle")}</p>
          </div>

          {/* 用途列表 */}
          <div className="overflow-hidden rounded-lg border border-border">
            {USE_CASES.map((c, i) => {
              const Icon = c.icon;
              const currentKey = useCases[c.id] ?? "";
              const current = allModels.find((m) => m.key === currentKey);
              const label = current ? current.label : currentKey === "" ? t("useCasesFollowDefault") : t("useCasesNotSelected");

              return (
                <div
                  key={c.id}
                  className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-border" : ""}`}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-overlay text-muted">
                    <Icon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{t(c.labelKey)}</div>
                    <div className="truncate text-xs text-muted">{t(c.descKey)}</div>
                  </div>
                  {c.selectable ? (
                    <Select
                      value={currentKey}
                      onChange={(v) => setUseCase(c.id, v)}
                      options={[
                        { value: "", label: t("useCasesFollowDefault") },
                        ...(c.id === "vision" ? visionModels : allModels).map((m) => ({ value: m.key, label: `${m.label} (${m.provider})` })),
                      ]}
                      className="w-56"
                    />
                  ) : (
                    <span className="rounded-md bg-surface-overlay px-2 py-1 text-xs text-muted">
                      {t("useCasesSystemConfig")}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
