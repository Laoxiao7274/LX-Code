import { create } from "zustand";

/**
 * 会话列表状态 —— 驱动 AppShell 左侧栏。
 * 与 chat-store(单条会话的消息流)分离:这里只管"有哪些会话、选中哪个"。
 */

export interface SessionMeta {
  id: string;
  title: string;
  /** 相对时间显示用 */
  updatedAt: number;
}

interface SessionListState {
  sessions: SessionMeta[];
  activeId: string;
  /** 新建会话:加入列表并选中 */
  create: () => void;
  select: (id: string) => void;
  remove: (id: string) => void;
  rename: (id: string, title: string) => void;
}

let seed = 0;
const nextId = () => `s${++seed}`;

const now = Date.now();

export const useSessionStore = create<SessionListState>((set) => ({
  sessions: [
    { id: nextId(), title: "重构认证模块", updatedAt: now - 60_000 },
    { id: nextId(), title: "修复滚动抖动 bug", updatedAt: now - 3_600_000 },
    { id: nextId(), title: "调研 pi-core 集成", updatedAt: now - 86_400_000 },
  ],
  activeId: "",

  create: () => {
    const id = nextId();
    set((s) => ({
      sessions: [{ id, title: "新会话", updatedAt: Date.now() }, ...s.sessions],
      activeId: id,
    }));
  },

  select: (id) => set({ activeId: id }),

  remove: (id) =>
    set((s) => {
      const sessions = s.sessions.filter((x) => x.id !== id);
      const activeId = s.activeId === id ? (sessions[0]?.id ?? "") : s.activeId;
      return { sessions, activeId };
    }),

  rename: (id, title) =>
    set((s) => ({
      sessions: s.sessions.map((x) =>
        x.id === id ? { ...x, title, updatedAt: Date.now() } : x,
      ),
    })),
}));

// 初始选中第一条
useSessionStore.setState({ activeId: useSessionStore.getState().sessions[0]?.id ?? "" });
