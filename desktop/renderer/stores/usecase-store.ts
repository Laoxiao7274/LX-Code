import { create } from "zustand";
import { useModelStore } from "./model-store";

/** 用途:功能场景,可指定专用模型。 */
export interface UseCase {
  id: string;
  label: string;
  desc: string;
  /** 图标标识(emoji 或 lucide 名)。 */
  icon: string;
  /** 该用途选定的模型 key "providerId/modelId",空=跟随默认。 */
  modelKey: string;
  /** 是否支持自定义模型(嵌入用途一般固定,不给选)。 */
  selectable: boolean;
}

interface UseCaseState {
  cases: UseCase[];
  /** 设置某用途的模型(自动持久化)。 */
  setModel: (id: string, modelKey: string) => void;
  /** 从 ~/.lxcode/usecases.json 加载(合并到 DEFAULTS)。 */
  reload: () => Promise<void>;
}

/** 所有可用模型扁平列表(来自已连接提供商的启用模型)。 */
export function allModels(): { key: string; label: string; provider: string }[] {
  const providers = useModelStore.getState().providers;
  const out: { key: string; label: string; provider: string }[] = [];
  for (const p of providers) {
    for (const m of p.models) {
      if (m.enabled) out.push({ key: `${p.id}/${m.id}`, label: m.name, provider: p.name });
    }
  }
  return out;
}

/** 用途固定结构(8 个预设),只 modelKey 持久化。 */
const DEFAULTS: UseCase[] = [
  { id: "codegen", label: "代码生成", desc: "生成与修改代码", icon: "code", modelKey: "", selectable: true },
  { id: "completion", label: "代码补全", desc: "行内自动补全", icon: "complete", modelKey: "", selectable: true },
  { id: "fileread", label: "文件读取", desc: "读取与总结文件内容", icon: "file", modelKey: "", selectable: true },
  { id: "vision", label: "视觉理解", desc: "识别图片内容", icon: "image", modelKey: "", selectable: true },
  { id: "planning", label: "任务规划", desc: "拆解复杂任务", icon: "plan", modelKey: "", selectable: true },
  { id: "embed", label: "嵌入向量化", desc: "语义检索与索引", icon: "embed", modelKey: "", selectable: false },
  { id: "commit", label: "提交信息", desc: "生成 commit message", icon: "git", modelKey: "", selectable: true },
  { id: "review", label: "代码审查", desc: "审查 diff 与改动", icon: "review", modelKey: "", selectable: true },
];

/** 持久化当前 cases 的 modelKey 到 ~/.lxcode/usecases.json。 */
function persist(cases: UseCase[]) {
  if (typeof window === "undefined" || !window.lxcode?.data) return;
  const data = cases.map((c) => ({ id: c.id, label: c.label, modelKey: c.modelKey }));
  void window.lxcode.data.writeUseCases(data);
}

export const useUseCaseStore = create<UseCaseState>((set, get) => ({
  cases: DEFAULTS,

  setModel: (id, modelKey) => {
    const cases = get().cases.map((c) => (c.id === id ? { ...c, modelKey } : c));
    set({ cases });
    persist(cases);
  },

  reload: async () => {
    if (typeof window === "undefined" || !window.lxcode?.data) return;
    try {
      const res = await window.lxcode.data.readUseCases();
      if (!res.ok) return;
      const saved = res.cases as { id: string; modelKey?: string }[];
      // 合并:用持久化的 modelKey 覆盖 DEFAULTS
      const map = new Map(saved.map((c) => [c.id, c.modelKey ?? ""]));
      set({ cases: DEFAULTS.map((c) => ({ ...c, modelKey: map.get(c.id) ?? "" })) });
    } catch {
      // 静默,用 DEFAULTS
    }
  },
}));
