import { create } from "zustand";

/**
 * 会话按项目(工作目录)分组。
 * 项目 = 文件夹,下面挂多个会话。
 */

export interface SessionMeta {
  id: string;
  title: string;
  updatedAt: number;
}

export interface Project {
  id: string;
  /** 文件夹名。 */
  name: string;
  /** 完整路径(显示用)。 */
  path: string;
  sessions: SessionMeta[];
  collapsed?: boolean;
}

interface SessionListState {
  projects: Project[];
  activeId: string;
  /** 新建会话:加到指定项目下并选中。 */
  create: (projectId: string) => void;
  select: (id: string) => void;
  remove: (id: string) => void;
  rename: (id: string, title: string) => void;
  /** 折叠/展开项目。 */
  toggleProject: (projectId: string) => void;
}

let seed = 0;
const nextId = () => `s${++seed}`;
const now = Date.now();

const DEMO_PROJECTS: Project[] = [
  {
    id: "lx-code",
    name: "lx-code",
    path: "C:/Users/xzy/Desktop/my/lx-code",
    collapsed: false,
    sessions: [
      { id: nextId(), title: "重构认证模块", updatedAt: now - 60_000 },
      { id: nextId(), title: "修复滚动抖动 bug", updatedAt: now - 3_600_000 },
      { id: nextId(), title: "调研 pi-core 集成", updatedAt: now - 86_400_000 },
    ],
  },
  {
    id: "mimo",
    name: "mimo-server",
    path: "C:/Users/xzy/Desktop/my/mimo-server",
    collapsed: true,
    sessions: [
      { id: nextId(), title: "部署脚本优化", updatedAt: now - 7_200_000 },
      { id: nextId(), title: "数据库迁移", updatedAt: now - 172_800_000 },
    ],
  },
  {
    id: "blog",
    name: "blog",
    path: "C:/Users/xzy/Desktop/my/blog",
    collapsed: true,
    sessions: [
      { id: nextId(), title: "新文章草稿", updatedAt: now - 43_200_000 },
    ],
  },
];

export const useSessionStore = create<SessionListState>((set) => ({
  projects: DEMO_PROJECTS,
  activeId: "",

  create: (projectId) => {
    const id = nextId();
    const s: SessionMeta = { id, title: "新会话", updatedAt: Date.now() };
    set((st) => ({
      projects: st.projects.map((p) =>
        p.id === projectId
          ? { ...p, collapsed: false, sessions: [s, ...p.sessions] }
          : p,
      ),
      activeId: id,
    }));
  },

  select: (id) => set({ activeId: id }),

  remove: (id) =>
    set((st) => ({
      projects: st.projects.map((p) => ({
        ...p,
        sessions: p.sessions.filter((x) => x.id !== id),
      })),
      activeId: st.activeId === id ? "" : st.activeId,
    })),

  rename: (id, title) =>
    set((st) => ({
      projects: st.projects.map((p) => ({
        ...p,
        sessions: p.sessions.map((x) => (x.id === id ? { ...x, title, updatedAt: Date.now() } : x)),
      })),
    })),

  toggleProject: (projectId) =>
    set((st) => ({
      projects: st.projects.map((p) =>
        p.id === projectId ? { ...p, collapsed: !p.collapsed } : p,
      ),
    })),
}));
