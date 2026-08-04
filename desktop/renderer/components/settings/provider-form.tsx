import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { X, Plus, Trash2, Key, Server, Globe, RefreshCw, Check } from "lucide-react";
import type { Provider, Model, CustomHeader } from "../../stores/model-store";
import { useModelStore } from "../../stores/model-store";
import { cn } from "../../lib/utils";

interface ProviderFormProps {
  provider: Provider;
  isAdding: boolean;
  /** 内联模式:嵌入提供商卡片内,无覆盖层/头部。 */
  embedded?: boolean;
}

/** 表单类型预设:不同格式填不同字段。 */
type FormKind = "openai" | "anthropic" | "custom";

const KINDS: { id: FormKind; label: string; desc: string; api: string }[] = [
  { id: "openai", label: "OpenAI 兼容", desc: "标准 /v1/chat/completions", api: "openai-completions" },
  { id: "anthropic", label: "Anthropic", desc: "Messages API", api: "anthropic-messages" },
  { id: "custom", label: "自定义", desc: "自定义 endpoint + headers", api: "openai-completions" },
];

/** 字段:label + hint + 输入。 */
function Field({ label, hint, icon: Icon, children }: { label: string; hint?: string; icon?: typeof Key; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5">
        {Icon ? <Icon className="h-3 w-3 text-muted-foreground" /> : null}
        <span className="text-[12px] font-medium">{label}</span>
        {hint ? <span className="text-[11px] text-muted-foreground/70">· {hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

/** 表单主体(供 embedded 与覆盖层复用)。 */
function FormBody({
  form, kind, isAdding, update, onKindChange, addModel, updateModel, removeModel, addHeader, updateHeader, removeHeader, handleFetch, fetching,
}: {
  form: Provider;
  kind: FormKind;
  isAdding: boolean;
  update: (patch: Partial<Provider>) => void;
  onKindChange: (k: FormKind) => void;
  addModel: () => void;
  updateModel: (i: number, patch: Partial<Model>) => void;
  removeModel: (i: number) => void;
  addHeader: () => void;
  updateHeader: (i: number, patch: Partial<CustomHeader>) => void;
  removeHeader: (i: number) => void;
  handleFetch: () => void;
  fetching: boolean;
}) {
  return (
    <div className="space-y-5">
      {/* 格式类型(仅新增时选) */}
      {isAdding ? (
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">接口格式</div>
          <div className="grid grid-cols-3 gap-2">
            {KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => onKindChange(k.id)}
                className={cn(
                  "rounded-lg border p-3 text-left transition-colors",
                  (kind === k.id) ? "border-accent bg-accent/5" : "border-border/60 hover:bg-muted/40",
                )}
              >
                <div className={cn("text-[13px] font-medium", kind === k.id && "text-accent")}>{k.label}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">{k.desc}</div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* 基本信息 */}
      <div className="space-y-3">
        <Field label="提供商 ID" hint="唯一标识,小写字母数字">
          <Input className="h-8 font-mono text-[12px]" placeholder="my-provider" value={form.id} disabled={!isAdding} onChange={(e) => update({ id: e.target.value })} />
        </Field>
        <Field label="显示名称">
          <Input className="h-8 text-[13px]" placeholder="我的提供商" value={form.name} onChange={(e) => update({ name: e.target.value })} />
        </Field>
        <Field label="Base URL" icon={Globe}>
          <Input className="h-8 font-mono text-[12px]" placeholder="https://api.example.com/v1" value={form.baseURL} onChange={(e) => update({ baseURL: e.target.value })} />
        </Field>
        <Field label="API Key" icon={Key}>
          <Input type="password" className="h-8 font-mono text-[12px]" placeholder="sk-... 或 {env:VAR}" value={form.apiKey} onChange={(e) => update({ apiKey: e.target.value })} />
        </Field>
      </div>

      {/* 自定义 headers(仅 custom 格式) */}
      {kind === "custom" ? (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">自定义请求头</span>
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={addHeader}><Plus className="h-3 w-3" /> 添加</Button>
          </div>
          {form.headers.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/60 py-4 text-center text-[12px] text-muted-foreground">无自定义请求头</div>
          ) : (
            <div className="space-y-2">
              {form.headers.map((h, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input className="h-8 flex-1 font-mono text-[12px]" placeholder="Header-Name" value={h.key} onChange={(e) => updateHeader(i, { key: e.target.value })} />
                  <Input className="h-8 flex-1 font-mono text-[12px]" placeholder="value" value={h.value} onChange={(e) => updateHeader(i, { value: e.target.value })} />
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeHeader(i)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* 模型列表 */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">模型</span>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={handleFetch} disabled={fetching}>
              <RefreshCw className={cn("h-3 w-3", fetching && "animate-spin")} />
              {fetching ? "获取中…" : "自动获取"}
            </Button>
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={addModel}><Plus className="h-3 w-3" /> 手动添加</Button>
          </div>
        </div>
        {form.models.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/60 py-6 text-center">
            <Server className="mx-auto mb-1.5 h-5 w-5 text-muted-foreground/40" />
            <div className="text-[12px] text-muted-foreground">暂无模型,自动获取或手动添加</div>
          </div>
        ) : (
          <div className="space-y-1.5">
            {form.models.map((m, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border border-border/60 px-2.5 py-1.5">
                <Input className="h-7 flex-1 font-mono text-[12px]" placeholder="model-id" value={m.id} onChange={(e) => updateModel(i, { id: e.target.value })} />
                <Input className="h-7 flex-1 text-[12px]" placeholder="显示名称" value={m.name} onChange={(e) => updateModel(i, { name: e.target.value })} />
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeModel(i)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 提供商新增/编辑表单。支持 OpenAI 兼容 / Anthropic / 自定义 三种格式。
 * embedded:内联嵌入卡片,无覆盖层。
 */
export function ProviderForm({ provider, isAdding, embedded }: ProviderFormProps) {
  const saveForm = useModelStore((s) => s.saveForm);
  const closeForm = useModelStore((s) => s.closeForm);
  const fetchModels = useModelStore((s) => s.fetchModels);

  const [form, setForm] = useState<Provider>(provider);
  const [kind, setKind] = useState<FormKind>(
    provider.kind === "preset" ? (provider.id === "anthropic" ? "anthropic" : "openai") : "custom",
  );
  const handleKindChange = (k: FormKind) => {
    setKind(k);
    // 同步更新 form.api,这样切换 kind 后 api 立即变,不必等保存
    const apiFromKind = KINDS.find((x) => x.id === k)?.api ?? "openai-completions";
    update({ api: apiFromKind });
  };
  const [fetching, setFetching] = useState(false);

  const update = (patch: Partial<Provider>) => setForm((f) => ({ ...f, ...patch }));
  const addModel = () => update({ models: [...form.models, { id: "", name: "", enabled: true }] });
  const updateModel = (i: number, patch: Partial<Model>) => update({ models: form.models.map((m, idx) => (idx === i ? { ...m, ...patch } : m)) });
  const removeModel = (i: number) => update({ models: form.models.filter((_, idx) => idx !== i) });
  const addHeader = () => update({ headers: [...form.headers, { key: "", value: "" }] });
  const updateHeader = (i: number, patch: Partial<CustomHeader>) => update({ headers: form.headers.map((h, idx) => (idx === i ? { ...h, ...patch } : h)) });
  const removeHeader = (i: number) => update({ headers: form.headers.filter((_, idx) => idx !== i) });

  const handleFetch = async () => {
    setFetching(true);
    try {
      await fetchModels(form.id || "custom", form.baseURL, form.apiKey, form.api);
    } finally {
      setFetching(false);
    }
  };
  const handleSave = () => {
    const apiFromKind = KINDS.find((k) => k.id === kind)?.api ?? "openai-completions";
    // 始终用当前 kind 对应的 api(切换 kind 后立即生效)
    saveForm({ ...form, api: apiFromKind, kind: isAdding ? (kind === "custom" ? "custom" : "preset") : form.kind, connected: !!form.apiKey });
  };

  const body = (
    <FormBody
      form={form}
      kind={kind}
      isAdding={isAdding}
      update={update}
      onKindChange={handleKindChange}
      addModel={addModel}
      updateModel={updateModel}
      removeModel={removeModel}
      addHeader={addHeader}
      updateHeader={updateHeader}
      removeHeader={removeHeader}
      handleFetch={handleFetch}
      fetching={fetching}
    />
  );

  // 内联模式:嵌入卡片内,纯内容 + 底部按钮
  if (embedded) {
    return (
      <div className="space-y-4 px-3 py-3">
        {body}
        <div className="flex justify-end gap-2 border-t border-border/60 pt-3">
          <Button variant="ghost" size="sm" onClick={closeForm}>取消</Button>
          <Button size="sm" onClick={handleSave} disabled={!form.id || !form.name}>
            <Check className="h-4 w-4" /> 保存
          </Button>
        </div>
      </div>
    );
  }

  // 覆盖层模式(独立新增)
  return (
    <div className="surface absolute inset-2 z-50 flex flex-col overflow-hidden rounded-lg">
      <div className="flex h-12 items-center justify-between border-b border-border/60 px-4">
        <h2 className="text-[15px] font-semibold tracking-tight">{isAdding ? "新增提供商" : `编辑 ${form.name}`}</h2>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={closeForm}><X className="h-4 w-4" /></Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-5 px-6 py-5">{body}</div>
      </div>
      <div className="flex h-12 items-center justify-end gap-2 border-t border-border/60 px-4">
        <Button variant="ghost" onClick={closeForm}>取消</Button>
        <Button onClick={handleSave} disabled={!form.id || !form.name}><Check className="h-4 w-4" /> 保存</Button>
      </div>
    </div>
  );
}
