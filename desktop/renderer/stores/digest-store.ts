import { create } from "zustand";
import type { DigestConfig, DigestFile } from "../types";

/** digest 项目功能地图前端状态。 */
interface DigestState {
  /** 面板是否打开。 */
  open: boolean;
  /** 当前 digest 数据(展开用)。 */
  digest: DigestFile | null;
  /** 运行配置(开关)。 */
  config: DigestConfig | null;
  /** 加载/刷新中。 */
  loading: boolean;
  /** 错误信息。 */
  error: string | null;
  /** 当前绑定的项目 cwd。 */
  cwd: string | null;
  /** 打开面板(传 cwd,自动加载)。 */
  openPanel: (cwd: string) => void;
  /** 关闭面板。 */
  closePanel: () => void;
  /** 重新加载 digest.json + config。 */
  reload: () => Promise<void>;
  /** 手动触发全量刷新(调 buildDigest)。 */
  refresh: () => Promise<void>;
  /** 更新开关(写配置 + 热插拔)。 */
  updateConfig: (patch: Partial<DigestConfig>) => Promise<void>;
}

export const useDigestStore = create<DigestState>((set, get) => ({
  open: false,
  digest: null,
  config: null,
  loading: false,
  error: null,
  cwd: null,

  openPanel: (cwd) => {
    set({ open: true, cwd, digest: null, error: null });
    void get().reload();
  },

  closePanel: () => set({ open: false }),

  reload: async () => {
    const cwd = get().cwd;
    if (!cwd || typeof window === "undefined" || !window.lxcode?.data) return;
    set({ loading: true, error: null });
    try {
      const [dRes, cRes] = await Promise.all([
        window.lxcode.data.getDigest(cwd),
        window.lxcode.data.getDigestConfig(cwd),
      ]);
      set({
        digest: dRes.ok ? (dRes.digest ?? null) : null,
        config: cRes.ok ? cRes.config : null,
        error: dRes.ok ? null : dRes.error ?? null,
        loading: false,
      });
    } catch (e) {
      set({ loading: false, error: String(e) });
    }
  },

  refresh: async () => {
    const cwd = get().cwd;
    if (!cwd || typeof window === "undefined" || !window.lxcode?.data) return;
    set({ loading: true, error: null });
    try {
      const res = await window.lxcode.data.refreshDigest(cwd);
      if (res.ok) {
        await get().reload();
      } else {
        set({ loading: false, error: res.error ?? "刷新失败" });
      }
    } catch (e) {
      set({ loading: false, error: String(e) });
    }
  },

  updateConfig: async (patch) => {
    const cwd = get().cwd;
    if (!cwd || typeof window === "undefined" || !window.lxcode?.data) return;
    const merged = { ...(get().config ?? { enabled: true, autoUpdate: true, injectContext: true }), ...patch };
    set({ config: merged });
    try {
      await window.lxcode.data.setDigestConfig(cwd, patch);
    } catch {
      // 静默,乐观更新
    }
  },
}));
