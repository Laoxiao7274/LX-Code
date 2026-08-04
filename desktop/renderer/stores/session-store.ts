import { create } from "zustand";

/**
 * 会话按项目(工作目录)分组。
 * 项目 = 文件夹,下面挂多个会话。
 */

export interface SessionMeta {
  id: string;
  title: string;
  updatedAt: number;
  /** 会话文件路径(读历史消息用)。 */
  path?: string;
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
  create: (projectId: string) => Promise<void>;
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
  reloadFromPi: () => Promise<void>;
  /** 打开目录选一个项目文件夹,加到项目列表。 */
  addProject: () => Promise<void>;
}

let seed = 0;
const nextId = () => `s${++seed}`;

export const useSessionStore = create<SessionListState>((set, get) => ({
  projects: [],
  activeId: "",

  create: async (projectId) => {
    const p = get().projects.find((x) => x.id === projectId);
    if (!p) return;
    let id = nextId();
    let title = "新会话";
    // 调真实 agent 创建持久化会话(存到 ~/.lxcode/sessions/)
    if (typeof window !== "undefined" && window.lxcode?.agent) {
      try {
        const res = await window.lxcode.agent.createSession(p.path, title);
        if (res.ok && res.id) { id = res.id; title = res.name ?? title; }
      } catch {
        // 静默,用本地 id
      }
    }
    const s: SessionMeta = { id, title, updatedAt: Date.now() };
    set((st) => ({
      projects: st.projects.map((p2) =>
        p2.id === projectId
          ? { ...p2, collapsed: false, sessions: [s, ...p2.sessions] }
          : p2,
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

  reloadFromPi: async () => {
    if (typeof window === "undefined" || !window.lxcode?.data || !window.lxcode?.agent) return;
    try {
      // 1. 从 LXCode 自己的 projects.json 读项目列表
      const res = await window.lxcode.data.listProjects();
      if (!res.ok) return;
      const projs = res.projects as { id: string; name: string; path: string }[];
      if (!projs.length) { set({ projects: [] }); return; }
      // 2. 并行加载每个项目的真实会话(agent.listSessions)
      const withSessions = await Promise.all(
        projs.map(async (p) => {
          let sessions: SessionMeta[] = [];
          try {
            const sr = await window.lxcode!.agent.listSessions(p.path);
            if (sr.ok) {
              sessions = (sr.sessions as { id: string; name?: string; path?: string }[]).map((s) => ({
                id: s.id,
                title: s.name ?? "未命名会话",
                updatedAt: 0,
                path: s.path,
              }));
            }
          } catch {
            // 静默
          }
          return { id: p.id, name: p.name, path: p.path, sessions, collapsed: false } as Project;
        }),
      );
      set({ projects: withSessions });
      // 默认选第一个项目的第一个会话
      if (withSessions[0]?.sessions.length && !get().activeId) {
        set({ activeId: withSessions[0].sessions[0].id });
      }
    } catch {
      // 静默失败保留 mock
    }
  },

  addProject: async () => {
    if (typeof window === "undefined" || !window.lxcode?.data) return;
    try {
      const res = await window.lxcode.data.openProject();
      if (!res.ok || !res.path) return;
      const path = res.path as string;
      const name = res.name as string;
      const projectId = path.replace(/[\\/:]/g, "_");
      // 已存在不重复加
      if (get().projects.some((p) => p.id === projectId)) return;
      const proj: Project = { id: projectId, name, path, sessions: [], collapsed: false };
      set((st) => ({ projects: [proj, ...st.projects] }));
      // 持久化到 ~/.lxcode/projects.json
      const all = get().projects.map((p) => ({ id: p.id, name: p.name, path: p.path, createdAt: Date.now(), lastUsedAt: Date.now() }));
      void window.lxcode.data.saveProjects(all);
    } catch {
      // 静默失败
    }
  },
}));
