import { create } from "zustand";

/** 设置面板是否打开。 */
interface SettingsState {
  open: boolean;
  /** 当前激活的分类 id。 */
  activeSection: string;
  setOpen: (v: boolean) => void;
  toggle: () => void;
  setSection: (id: string) => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  open: false,
  activeSection: "general",
  setOpen: (v) => set({ open: v }),
  toggle: () => set({ open: !get().open }),
  setSection: (id) => set({ activeSection: id }),
}));
