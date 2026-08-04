import { create } from "zustand";

/** 真实设置项(持久化到 ~/.lxcode/settings.json)。 */
export interface AppSettings {
  theme: "light" | "dark" | "system";
  density: "compact" | "standard" | "comfortable";
  autoSave: boolean;
  clearInputOnSend: boolean;
  showToolDetails: boolean;
  streaming: boolean;
  autoThinking: boolean;
  animations: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: "system",
  density: "standard",
  autoSave: true,
  clearInputOnSend: true,
  showToolDetails: true,
  streaming: true,
  autoThinking: true,
  animations: true,
};

interface SettingsState {
  /** 面板是否打开。 */
  open: boolean;
  /** 当前激活的分类 id。 */
  activeSection: string;
  /** 真实设置项。 */
  settings: AppSettings;
  setOpen: (v: boolean) => void;
  toggle: () => void;
  setSection: (id: string) => void;
  /** 更新某项设置(自动持久化)。 */
  update: (patch: Partial<AppSettings>) => void;
  /** 从 ~/.lxcode/settings.json 加载。 */
  reload: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  open: false,
  activeSection: "general",
  settings: DEFAULT_SETTINGS,

  setOpen: (v) => set({ open: v }),
  toggle: () => set({ open: !get().open }),
  setSection: (id) => set({ activeSection: id }),

  update: (patch) => {
    set((s) => ({ settings: { ...s.settings, ...patch } }));
    // 持久化到 ~/.lxcode/settings.json
    if (typeof window !== "undefined" && window.lxcode?.data) {
      void window.lxcode.data.writeSettings({ ...get().settings, ...patch });
    }
  },

  reload: async () => {
    if (typeof window === "undefined" || !window.lxcode?.data) return;
    try {
      const res = await window.lxcode.data.readSettings();
      if (res.ok && res.settings) {
        set({ settings: { ...DEFAULT_SETTINGS, ...(res.settings as Partial<AppSettings>) } });
      }
    } catch {
      // 静默,用默认
    }
  },
}));
