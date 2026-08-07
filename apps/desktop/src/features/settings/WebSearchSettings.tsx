import { useEffect, useState } from "react";
import { Globe, KeyRound, ExternalLink } from "lucide-react";
import { SectionHeader } from "../../components/SectionHeader";
import { Select } from "../../components/Select";
import { Switch } from "../../components/Switch";
import { useT } from "../../lib/i18n/use-t";
import { useAppStore } from "../../lib/stores/app-store";
import {
  readWebSearchConfig,
  patchWebSearchConfig,
  type WebSearchConfig,
} from "../../lib/desktop-file-access";

/** provider key 配置项定义。 */
type ProviderField = {
  key: keyof WebSearchConfig;
  label: string;
  desc: string;
  link?: string;
  type: "apiKey" | "baseUrl";
};

const PROVIDER_FIELDS: ProviderField[] = [
  { key: "exaApiKey", label: "Exa", desc: "零配置可用(50次/天);填 key 解除限制(免费 2800 次)", link: "https://dashboard.exa.ai/api-keys", type: "apiKey" },
  { key: "openaiApiKey", label: "OpenAI", desc: "原生搜索(Responses API);也用 Codex 订阅", link: "https://platform.openai.com/api-keys", type: "apiKey" },
  { key: "braveApiKey", label: "Brave", desc: "Brave Search API", link: "https://brave.com/search/api/", type: "apiKey" },
  { key: "tavilyApiKey", label: "Tavily", desc: "Tavily AI 搜索", link: "https://tavily.com/", type: "apiKey" },
  { key: "kagiApiKey", label: "Kagi", desc: "Kagi Search API", link: "https://kagi.com/api", type: "apiKey" },
  { key: "perplexityApiKey", label: "Perplexity", desc: "Perplexity AI", link: "https://www.perplexity.ai/settings/api", type: "apiKey" },
  { key: "geminiApiKey", label: "Gemini", desc: "Google Gemini API(原生 Grounding 搜索)", link: "https://aistudio.google.com/apikey", type: "apiKey" },
  { key: "searxngBaseUrl", label: "SearXNG", desc: "自建实例 baseUrl(本地/私有搜索,优先于其他)", type: "baseUrl" },
];

export function WebSearchSettings() {
  const t = useT();
  const [config, setConfig] = useState<WebSearchConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const pushNotification = useAppStore((s) => s.pushNotification);

  // 拉配置
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const c = await readWebSearchConfig();
      if (!cancelled) setConfig(c);
    })();
    return () => { cancelled = true; };
  }, []);

  // patch 单字段(乐观更新:立即反映到 UI,失败回滚)
  async function update(patch: Partial<WebSearchConfig>) {
    if (!config) return;
    const prev = config;
    setConfig({ ...prev, ...patch });
    setSaving(true);
    try {
      const next = await patchWebSearchConfig(patch);
      setConfig(next);
    } catch (e) {
      setConfig(prev);
      pushNotification(t("webSearchSaveFail") + (e instanceof Error ? `: ${e.message}` : ""), "error");
    } finally {
      setSaving(false);
    }
  }

  if (!config) {
    return (
      <div className="min-h-0 flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-2xl">
          <SectionHeader title={t("navWebSearch")} subtitle={t("webSearchSubtitle")} />
          <div className="py-8 text-center text-sm text-muted">{t("providersLoading")}</div>
        </div>
      </div>
    );
  }

  const provider = config.provider ?? "auto";
  const workflow = config.workflow ?? "none";
  const allowCookies = config.allowBrowserCookies === true;

  return (
    <div className="min-h-0 flex-1 overflow-auto p-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <SectionHeader title={t("navWebSearch")} subtitle={t("webSearchSubtitle")} />

      {/* 说明 */}
      <div className="rounded-lg border border-border bg-surface-overlay/30 px-4 py-3 text-xs text-muted">
        {t("webSearchZeroConfigHint")}
      </div>

      {/* 搜索 provider 模式 */}
      <div className="rounded-lg border border-border p-4">
        <div className="mb-3 text-sm font-medium">{t("webSearchProvider")}</div>
        <p className="mb-3 text-xs text-muted">{t("webSearchProviderDesc")}</p>
        <Select
          value={provider}
          onChange={(v) => update({ provider: v })}
          options={[
            { value: "auto", label: t("webSearchProviderAuto") },
            { value: "exa", label: "Exa" },
            { value: "openai", label: "OpenAI" },
            { value: "brave", label: "Brave" },
            { value: "tavily", label: "Tavily" },
            { value: "kagi", label: "Kagi" },
            { value: "perplexity", label: "Perplexity" },
            { value: "gemini", label: "Gemini" },
            { value: "searxng", label: "SearXNG" },
          ]}
          className="w-full"
        />
      </div>

      {/* curator 策展开关 */}
      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">{t("webSearchCurator")}</div>
            <div className="mt-1 text-xs text-muted">{t("webSearchCuratorDesc")}</div>
          </div>
          <Switch checked={workflow === "summary-review"} onChange={(on) => {
            // 关闭策展时联动关闭 autoApprove(幂等,避免残留)
            const patch: Partial<WebSearchConfig> = { workflow: on ? "summary-review" : "none" };
            if (!on) patch.autoApprove = false;
            update(patch);
          }} label={t("webSearchCurator")} />
        </div>
      </div>

      {/* 弹出搜索网页开关(在内置浏览器开 curator 策展页,开启即自动确认返回) */}
      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">{t("webSearchOpenPage")}</div>
            <div className="mt-1 text-xs text-muted">{t("webSearchOpenPageDesc")}</div>
          </div>
          <Switch checked={config.openCuratorPage === true} onChange={(on) => {
            // autoApprove 跟随弹出网页:开启自动确认(不等人工),关闭同时关掉
            update({ openCuratorPage: on, autoApprove: on });
          }} label={t("webSearchOpenPage")} />
        </div>
      </div>

      {/* API Keys 分组 */}
      <div className="rounded-lg border border-border p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium">
          <KeyRound size={14} className="text-accent" />
          {t("webSearchApiKeys")}
        </div>
        <div className="flex flex-col gap-4">
          {PROVIDER_FIELDS.map((f) => (
            <div key={f.key} className="flex flex-col gap-1.5">
              <label className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">{f.label}</span>
                {f.link && (
                  <a
                    href={f.link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline"
                  >
                    {t("webSearchGetKey")}
                    <ExternalLink size={10} />
                  </a>
                )}
              </label>
              <input
                type="password"
                value={String(config[f.key] ?? "")}
                placeholder={f.type === "baseUrl" ? "https://search.example.com" : "sk-... / exa-..."}
                onChange={(e) => {
                  const v = e.target.value;
                  setConfig({ ...config, [f.key]: v });
                }}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v !== (config[f.key] ?? "")) {
                    update(v ? { [f.key]: v } : { [f.key]: null as unknown as string });
                  }
                }}
                className="h-8 w-full rounded-md border border-border bg-surface px-2.5 text-xs text-foreground outline-none transition-[border-color,box-shadow] duration-150 hover:border-accent/45 focus:border-accent focus:ring-[3px] focus:ring-accent/15"
              />
              <p className="text-[11px] text-muted">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 高级 */}
      <div className="rounded-lg border border-border p-4">
        <div className="mb-3 text-sm font-medium">{t("webSearchAdvanced")}</div>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium">{t("webSearchAllowCookies")}</div>
            <div className="mt-1 text-[11px] text-muted">{t("webSearchAllowCookiesDesc")}</div>
          </div>
          <Switch checked={allowCookies} onChange={(on) => update({ allowBrowserCookies: on })} label={t("webSearchAllowCookies")} />
        </div>
      </div>

      {/* 重启提示 */}
      {saving && (
        <div className="text-center text-[11px] text-muted">{t("webSearchSaving")}</div>
      )}
      <div className="text-center text-[11px] text-muted">{t("webSearchRestartHint")}</div>
      </div>
    </div>
  );
}
