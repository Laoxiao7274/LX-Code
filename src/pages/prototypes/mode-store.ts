import { create } from "zustand";

/** 应用运行时模式:三种视角看同一个会话的工作。 */
export type AppMode = "agent" | "coding" | "design";

interface ModeState {
  mode: AppMode;
  setMode: (m: AppMode) => void;
}

/**
 * 应用模式切换。
 * 三种模式共享同一会话状态(chat/session stores),只是中间主区呈现不同视角:
 * - agent:  对话流(思考块 + 工具调用 + 正文)+ 输入区,看 agent 自主跑
 * - coding: 文件树 + 对话 + 代码编辑器/diff,直接看改代码改动
 * - design: 左中右工作台布局(导航/预览/事件),设计调试视角
 */
export const useModeStore = create<ModeState>((set) => ({
  mode: "agent",
  setMode: (mode) => set({ mode }),
}));
