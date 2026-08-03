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
  /** 设置某用途的模型。 */
  setModel: (id: string, modelKey: string) => void;
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

const DEFAULTS: UseCase[] = [
  { id: "codegen", label: "代码生成", desc: "生成与修改代码", icon: "code", modelKey: "anthropic/claude-sonnet-4", selectable: true },
  { id: "completion", label: "代码补全", desc: "行内自动补全", icon: "complete", modelKey: "anthropic/claude-haiku-3.5", selectable: true },
  { id: "fileread", label: "文件读取", desc: "读取与总结文件内容", icon: "file", modelKey: "openai/gpt-4o-mini", selectable: true },
  { id: "vision", label: "视觉理解", desc: "识别图片内容", icon: "image", modelKey: "openai/gpt-4o", selectable: true },
  { id: "planning", label: "任务规划", desc: "拆解复杂任务", icon: "plan", modelKey: "anthropic/claude-opus-4", selectable: true },
  { id: "embed", label: "嵌入向量化", desc: "语义检索与索引", icon: "embed", modelKey: "", selectable: false },
  { id: "commit", label: "提交信息", desc: "生成 commit message", icon: "git", modelKey: "anthropic/claude-haiku-3.5", selectable: true },
  { id: "review", label: "代码审查", desc: "审查 diff 与改动", icon: "review", modelKey: "anthropic/claude-sonnet-4", selectable: true },
];

export const useUseCaseStore = create<UseCaseState>((set, get) => ({
  cases: DEFAULTS,
  setModel: (id, modelKey) =>
    set({ cases: get().cases.map((c) => (c.id === id ? { ...c, modelKey } : c)) }),
}));
