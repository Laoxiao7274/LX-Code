import { create } from "zustand";

/** 真实会话:对应一个工作目录 + 一段对话。 */
export interface Session {
  id: string;
  title: string;
  cwd: string;
  updatedAt: number;
}

interface SessionState {
  sessions: Session[];
  activeId: string | null;
  create: (cwd?: string) => string;
  select: (id: string) => void;
  remove: (id: string) => void;
  setTitle: (id: string, title: string) => void;
  /** 从 pi-core 加载某 cwd 的已有会话(替换 mock)。 */
  reloadFromPi: (cwd: string) => Promise<void>;
}

let seed = 0;
const nid = () => `s${++seed}`;

const DEFAULT_CWD =
  typeof process !== "undefined" && process.cwd ? process.cwd() : ".";

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [
    { id: nid(), title: "新会话", cwd: DEFAULT_CWD, updatedAt: Date.now() },
  ],
  activeId: null,

  create: (cwd = DEFAULT_CWD) => {
    const id = nid();
    const s: Session = { id, title: "新会话", cwd, updatedAt: Date.now() };
    set({ sessions: [s, ...get().sessions], activeId: id });
    // 真实创建持久化会话(异步,失败则保留本地)
    if (typeof window !== "undefined" && window.lxcode?.agent) {
      void window.lxcode.agent.createSession(cwd).then((res) => {
        if (res.ok && res.id) {
          set((st) => ({
            sessions: st.sessions.map((x) => (x.id === id ? { ...x, id: res.id!, title: res.name ?? x.title } : x)),
          }));
        }
      });
    }
    return id;
  },

  select: (id) => set({ activeId: id }),

  remove: (id) =>
    set((s) => {
      const sessions = s.sessions.filter((x) => x.id !== id);
      return {
        sessions,
        activeId: s.activeId === id ? sessions[0]?.id ?? null : s.activeId,
      };
    }),

  setTitle: (id, title) =>
    set((s) => ({
      sessions: s.sessions.map((x) => (x.id === id ? { ...x, title, updatedAt: Date.now() } : x)),
    })),

  reloadFromPi: async (cwd) => {
    if (typeof window === "undefined" || !window.lxcode?.agent) return;
    try {
      const res = await window.lxcode.agent.listSessions(cwd);
      if (!res.ok) return;
      const real: Session[] = res.sessions.map((si) => ({
        id: si.id,
        title: si.name ?? "未命名会话",
        cwd: si.cwd || cwd,
        updatedAt: 0,
      }));
      if (real.length) {
        set({ sessions: real, activeId: real[0].id });
      } else {
        // 无已有会话,创建一个
        get().create(cwd);
      }
    } catch {
      // 静默失败保留 mock
    }
  },
}));
