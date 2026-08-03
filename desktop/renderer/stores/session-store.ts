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
}));
