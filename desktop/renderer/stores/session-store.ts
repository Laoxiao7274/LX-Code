import { create } from "zustand";

/**
 * 会话按项目(工作目录)分组。
 * 项目 = 文件夹,下面挂多个会话。
 */

export interface SessionMeta {
  id: string;
  title: string;
  updatedAt: number;
  /** 已归档(不显示在主列表)。 */
  archived?: boolean;
}

export interface Project {
  id: string;
  /** 文件夹名。 */
  name: string;
  /** 完整路径(显示用)。 */
  path: string;
  sessions: SessionMeta[];
  collapsed?: boolean;
  /** 项目已归档。 */
  archived?: boolean;
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
  /** 项目改名。 */
  renameProject: (projectId: string, name: string) => void;
  /** 删除项目(连同会话)。 */
  removeProject: (projectId: string) => void;
  /** 归档项目。 */
  archiveProject: (projectId: string) => void;
  /** 归档会话。 */
  archiveSession: (id: string) => void;
  /** 恢复会话(取消归档)。 */
  unarchiveSession: (id: string) => void;
  /** 从 pi-core 加载某 cwd 的已有会话(按项目分组)。 */
  reloadFromPi: (cwd: string) => Promise<void>;
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

export const useSessionStore = create<SessionListState>((set, get) => ({
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

  renameProject: (projectId, name) =>
    set((st) => ({
      projects: st.projects.map((p) => (p.id === projectId ? { ...p, name } : p)),
    })),

  removeProject: (projectId) =>
    set((st) => {
      const proj = st.projects.find((p) => p.id === projectId);
      const activeGone = proj?.sessions.some((s) => s.id === st.activeId);
      return {
        projects: st.projects.filter((p) => p.id !== projectId),
        activeId: activeGone ? "" : st.activeId,
      };
    }),

  archiveProject: (projectId) =>
    set((st) => ({
      projects: st.projects.map((p) => (p.id === projectId ? { ...p, archived: !p.archived } : p)),
    })),

  archiveSession: (id) =>
    set((st) => ({
      projects: st.projects.map((p) => ({
        ...p,
        sessions: p.sessions.map((x) => (x.id === id ? { ...x, archived: !x.archived } : x)),
      })),
      activeId: st.activeId === id ? "" : st.activeId,
    })),

  unarchiveSession: (id) =>
    set((st) => ({
      projects: st.projects.map((p) => ({
        ...p,
        sessions: p.sessions.map((x) => (x.id === id ? { ...x, archived: false } : x)),
      })),
    })),

  reloadFromPi: async (cwd) => {
    if (typeof window === "undefined" || !window.lxcode?.agent) return;
    try {
      const res = await window.lxcode.agent.listSessions(cwd);
      if (!res.ok) return;
      const real: SessionMeta[] = res.sessions.map((si) => ({
        id: si.id,
        title: si.name ?? "未命名会话",
        updatedAt: 0,
      }));
      // 把该 cwd 的会话挂到一个项目下(用 cwd 的文件夹名做项目名)
      const projectName = cwd.split(/[\\/]/).filter(Boolean).pop() ?? "项目";
      const projectId = cwd.replace(/[\\/:]/g, "_");
      const existing = get().projects.find((p) => p.id === projectId);
      if (existing) {
        // 更新该项目的会话(合并,保留本地新建)
        set((st) => ({
          projects: st.projects.map((p) =>
            p.id === projectId ? { ...p, sessions: [...real, ...p.sessions.filter((s) => !real.some((r) => r.id === s.id))] } : p,
          ),
        }));
      } else {
        // 新建项目
        const proj: Project = { id: projectId, name: projectName, path: cwd, sessions: real, collapsed: false };
        set((st) => ({ projects: [proj, ...st.projects] }));
      }
      if (real.length && !get().activeId) set({ activeId: real[0].id });
    } catch {
      // 静默失败保留 mock
    }
  },
}));
