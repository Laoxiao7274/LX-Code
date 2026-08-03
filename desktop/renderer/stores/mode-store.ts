import { create } from "zustand";

/** 真实应用模式:agent(任务流) / coding(对话+文件)。 */
export type AppMode = "agent" | "coding";

interface ModeState {
  mode: AppMode;
  setMode: (m: AppMode) => void;
}

/**
 * 应用模式切换。
 * - agent:  任务列表 + 任务执行流(目标→思考→工具→结果),看 agent 自主跑
 * - coding: 会话列表 + 对话 + 文件,边对话边看改代码
 */
export const useModeStore = create<ModeState>((set) => ({
  mode: "coding",
  setMode: (mode) => set({ mode }),
}));
