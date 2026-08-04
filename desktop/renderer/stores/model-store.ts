import { create } from "zustand";

/** 模型定义。 */
export interface Model {
  id: string;
  name: string;
  /** 是否启用(在模型选择器显示)。 */
  enabled: boolean;
}

/** 自定义请求头。 */
export interface CustomHeader {
  key: string;
  value: string;
}

/** 提供商类型。 */
export type ProviderKind = "preset" | "custom";

/** 提供商。 */
export type ApiProtocol = "openai-completions" | "anthropic-messages" | "openai-responses" | (string & {});

export interface Provider {
  id: string;
  name: string;
  /** preset 或 custom。 */
  kind: ProviderKind;
  /** 协议:openai-completions(通用)/anthropic-messages/openai-responses。 */
  api: ApiProtocol;
  /** 图标标识:预设用 id,自定义用 emoji 或字母。 */
  icon?: string;
  color: string;
  baseURL?: string;
  apiKey?: string;
  headers: CustomHeader[];
  models: Model[];
  /** 是否已连接(有有效 apiKey)。 */
  connected: boolean;
}

interface ModelStore {
  providers: Provider[];
  /** 当前默认模型 "providerId/modelId"。 */
  defaultModel: string;
  /** 正在编辑/新增的提供商表单(null 关闭)。 */
  editing: Provider | null;
  /** 是否新增(区分编辑/新增)。 */
  isAdding: boolean;

  setDefault: (key: string) => void;
  toggleModel: (providerId: string, modelId: string) => void;
  /** 打开新增表单。 */
  openAdd: () => void;
  /** 打开编辑表单。 */
  openEdit: (providerId: string) => void;
  closeForm: () => void;
  /** 保存表单(新增或更新)。 */
  saveForm: (p: Provider) => void;
  /** 删除提供商。 */
  removeProvider: (providerId: string) => void;
  /** 持久化当前状态到 ~/.lxcode/models.json。 */
  persist: () => void;
  /** 模拟自动获取模型(根据 baseURL + key)。 */
  fetchModels: (providerId: string, baseUrl?: string, apiKey?: string, api?: string) => Promise<void>;
  /** 从 pi-core 重新加载真实 providers + models。 */
  reloadFromPi: () => Promise<void>;
}

export const useModelStore = create<ModelStore>((set, get) => ({
  providers: [],
  defaultModel: "",
  editing: null,
  isAdding: false,

  /** 持久化到 ~/.lxcode/models.json。 */
  persist: () => {
    if (typeof window === "undefined" || !window.lxcode?.data) return;
    const { providers, defaultModel } = get();
    const cfg = {
      defaultModel,
      thinkingLevel: "medium",
      providers: providers.map((p) => ({
        id: p.id,
        name: p.name,
        api: p.api,
        baseUrl: p.baseURL,
        apiKey: p.apiKey,
        headers: p.headers,
        models: p.models.map((m) => ({
          id: m.id,
          name: m.name,
          reasoning: false,
          vision: false,
          contextWindow: 128000,
          maxTokens: 8192,
          enabled: m.enabled,
        })),
      })),
    };
    void window.lxcode.data.writeModels(cfg);
  },

  setDefault: (key) => {
    set({ defaultModel: key });
    get().persist();
    // 默认模型已持久化到 ~/.lxcode/models.json,
    // 新建会话时 getOrCreateSession 会读取并 setModel
  },
  toggleModel: (providerId, modelId) => {
    set({
      providers: get().providers.map((p) =>
        p.id === providerId
          ? { ...p, models: p.models.map((m) => (m.id === modelId ? { ...m, enabled: !m.enabled } : m)) }
          : p,
      ),
    });
    get().persist();
  },

  openAdd: () => set({
    isAdding: true,
    editing: {
      id: "",
      name: "",
      kind: "custom",
      icon: "",
      color: "text-muted-foreground",
      api: "openai-completions",
      baseURL: "",
      apiKey: "",
      headers: [],
      connected: false,
      models: [],
    },
  }),
  openEdit: (providerId) => {
    const p = get().providers.find((x) => x.id === providerId);
    if (p) set({ isAdding: false, editing: { ...p } });
  },
  closeForm: () => set({ editing: null, isAdding: false }),
  saveForm: (p) => {
    const exists = get().providers.some((x) => x.id === p.id);
    set({
      providers: exists
        ? get().providers.map((x) => (x.id === p.id ? p : x))
        : [...get().providers, p],
      editing: null,
      isAdding: false,
    });
    get().persist();
  },
  removeProvider: (providerId) => {
    set({ providers: get().providers.filter((p) => p.id !== providerId) });
    get().persist();
  },

  fetchModels: async (providerId, baseUrl, apiKey, api) => {
    // 调真实 provider 的 /v1/models 拿模型列表
    const p = get().providers.find((x) => x.id === providerId) ?? get().editing;
    const url = baseUrl ?? p?.baseURL ?? "";
    const key = apiKey ?? p?.apiKey ?? "";
    const proto = api ?? p?.api ?? "openai-completions";
    if (!url) return;
    try {
      const res = await window.lxcode?.data?.fetchModels?.(url, key, proto);
      if (!res?.ok || !res.models?.length) return;
      const fetched: Model[] = res.models.map((m) => ({ id: m.id, name: m.name, enabled: true }));
      // 合并到对应 provider(去重)
      const cur = get().editing;
      set({
        providers: get().providers.map((x) =>
          x.id === providerId
            ? { ...x, models: [...fetched, ...x.models.filter((m) => !fetched.some((f) => f.id === m.id))] }
            : x,
        ),
        // 如果正在编辑这个 provider,同步到 editing
        editing: cur && cur.id === providerId
          ? { ...cur, models: [...fetched, ...cur.models.filter((m) => !fetched.some((f) => f.id === m.id))] }
          : cur,
      });
      get().persist();
    } catch {
      // 静默失败
    }
  },

  /** 从 pi-core 重新加载真实 providers + models(替换 mock)。 */
  reloadFromPi: async () => {
    if (typeof window === "undefined" || !window.lxcode?.data) return;
    try {
      const res = await window.lxcode.data.readModels();
      if (!res.ok || !res.config) return;
      const cfg = res.config as { defaultModel: string; thinkingLevel: string; providers: unknown[] };
      if (!cfg.providers?.length) return;
      const real: Provider[] = (cfg.providers as Record<string, unknown>[]).map((p) => ({
        id: String(p.id),
        name: String(p.name),
        kind: "preset",
        api: (p.api as string) || "openai-completions",
        icon: String(p.name).slice(0, 1).toUpperCase(),
        color: "text-accent",
        baseURL: String(p.baseUrl ?? ""),
        apiKey: String(p.apiKey ?? ""),
        headers: (p.headers as { key: string; value: string }[]) ?? [],
        connected: !!p.apiKey,
        models: ((p.models as Record<string, unknown>[]) ?? []).map((m) => ({
          id: String(m.id),
          name: String(m.name),
          enabled: m.enabled !== false,
        })),
      }));
      set({ providers: real, defaultModel: cfg.defaultModel || (real.length && real[0].models.length ? `${real[0].id}/${real[0].models[0].id}` : "") });
    } catch {
      // 非 Electron 环境静默失败,保留 mock
    }
  },
}));
