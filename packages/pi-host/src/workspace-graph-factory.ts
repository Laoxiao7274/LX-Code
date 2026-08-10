import { resolve as pathResolve } from "node:path";
import type { AgentSession, ExtensionCommandContextActions } from "@earendil-works/pi-coding-agent";
import {
  createHostError,
  type HostError,
  type HostIdentity,
  type SessionSnapshot,
  type SessionRuntimeState,
  type WorkspaceSnapshot,
} from "@lxcode/protocol";
import type { PiHostServer } from "./server.js";
import { activateOnce } from "./extension-ui-lifecycle.js";
import { createExtensionCommandContextActions } from "./extension-command-actions.js";
import { SessionRuntimeCache, type ActiveSessionState } from "./session-runtime-cache.js";
import type { AgentOperationLock } from "./locks.js";
import { WorkspaceLifecycle } from "./workspace-lifecycle.js";
export * from "./workspace-graph-types.js";
import {
  type BackgroundSessionRuntime,
  type GraphFactoryDeps,
  type WorkspaceGraph,
} from "./workspace-graph-types.js";
import {
  archiveSession,
  cleanupArchivedSessions,
  createSession,
  deleteSession,
  listSessions,
  openSession,
  refineActiveSessionName,
  reloadSession,
  renameSession,
  restoreSession,
  setActiveSessionName,
} from "./session-lifecycle.js";

export class WorkspaceGraphFactory {
  /** @internal — session-lifecycle module
   *  当前 active graph。语义已变:它是注册表的派生引用,由 activeCwd + graphs Map 决定。
   *  不要直接赋值(会绕过注册表),用 setActiveGraph()。保留公开字段是为了不改动大量 factory.graph 读取点。 */
  graph: WorkspaceGraph | null = null;
  /** @internal — session-lifecycle module */
  server: PiHostServer | null = null;
  readonly deps: GraphFactoryDeps;
  onModelHealthChanged?: () => void;
  /** Active run id for agent events */
  currentRunId: string | null = null;
  private readonly sessionRuntimeCache: SessionRuntimeCache;
  private readonly workspaceLifecycle: WorkspaceLifecycle;

  /** graph 注册表:多个 workspace graph 常驻内存,切换=原子改 active 指针,无需 rebuild。
   *  key=canonicalCwd(经 workspaceIdentityKey 归一化,win32 不区分大小写)。 */
  private readonly graphs = new Map<string, WorkspaceGraph>();
  /** 当前 active workspace 的 canonicalCwd,null 表示无 active workspace。 */
  private activeCwd: string | null = null;
  /** LRU 顺序:最近访问的 cwd 在末尾。超 MAX_WORKSPACE_GRAPHS 时淘汰最久未用。
   *  内存安全:每个 idle session ~42MB RSS + extension/MCP 资源,不能无限常驻。 */
  private readonly lruOrder: string[] = [];
  private static readonly MAX_WORKSPACE_GRAPHS = 5;

  constructor(deps: GraphFactoryDeps) {
    this.deps = deps;
    this.sessionRuntimeCache = new SessionRuntimeCache({
      getGraph: () => this.graph,
      getServer: () => this.server,
      getCurrentRunId: () => this.currentRunId,
      sessionPathsEqual: (left, right) => this.sessionPathsEqual(left, right),
    });
    this.workspaceLifecycle = new WorkspaceLifecycle(
      {
        deps: this.deps,
        getGraph: () => this.graph,
        setGraph: (graph) => {
          // setGraph 语义已变:不再直接赋值,而是走注册表(注册或切换 active)。
          // 传 null=清空 active(用于失败回滚);传 graph=把它设为 active。
          if (graph === null) {
            this.clearActiveGraph();
          } else {
            this.setActiveGraph(graph);
          }
        },
        setGraphRaw: (graph) => this.setActiveGraphRaw(graph),
        getRegisteredGraph: (cwd) => this.getRegisteredGraph(cwd),
        getServer: () => this.server,
        onModelHealthChanged: () => this.onModelHealthChanged?.(),
        getCommandContextActions: (session) => this.extensionCommandContextActions(session),
      },
      this.sessionRuntimeCache,
    );
  }

  /** ctx.newSession()/fork()/navigateTree()/switchSession()/reload() for one bound session. */
  extensionCommandContextActions(session: AgentSession): ExtensionCommandContextActions {
    return createExtensionCommandContextActions({ factory: this, session });
  }

  bindServer(server: PiHostServer): void {
    this.server = server;
  }

  getGraph(): WorkspaceGraph | null {
    return this.graph;
  }

  getServer(): PiHostServer | null {
    return this.server;
  }

  /** 注册表 key 归一化(与 workspaceIdentityKey 一致,win32 不区分大小写)。 */
  private graphKey(canonicalCwd: string): string {
    return process.platform === "win32"
      ? canonicalCwd.toLowerCase()
      : canonicalCwd;
  }

  /** 把一个 graph 注册进表并设为 active(原子切换)。
   *  - 若该 cwd 已有 graph:复用旧 graph(命中缓存),仅切换 active 指针。
   *  - 否则:注册新 graph,切换 active,LRU 淘汰超限的最久未用 graph(dispose)。
   *  这是“切换无感”的核心:切回已访问工作区=零 build。 */
  private setActiveGraph(graph: WorkspaceGraph): void {
    const key = this.graphKey(graph.canonicalCwd);
    const existing = this.graphs.get(key);
    if (existing && existing !== graph) {
      // 同 cwd 已有常驻 graph:丢弃传入的重复 graph,复用常驻的(命中缓存)
      try {
        void this.workspaceLifecycle.disposeGraph(graph);
      } catch {
        /* ignore */
      }
      graph = existing;
    } else if (!existing) {
      this.graphs.set(key, graph);
    }
    this.activeCwd = graph.canonicalCwd;
    this.graph = graph;
    this.touchLru(key);
    this.evictIfNeeded();
  }

  /** 清空 active(失败回滚用):active 指针置空,但保留已注册 graph 在表里(可后续重试)。 */
  private clearActiveGraph(): void {
    this.activeCwd = null;
    this.graph = null;
  }

  /** 直接设 active 指针但不进注册表(失败 graph 专用:不污染注册表/LRU)。
   *  @internal — workspace-lifecycle.commitWorkspaceFailure 用 */
  setActiveGraphRaw(graph: WorkspaceGraph | null): void {
    if (graph === null) {
      this.clearActiveGraph();
    } else {
      this.activeCwd = graph.canonicalCwd;
      this.graph = graph;
    }
  }

  /** LRU:把 key 移到末尾(最近用)。 */
  private touchLru(key: string): void {
    const idx = this.lruOrder.indexOf(key);
    if (idx >= 0) this.lruOrder.splice(idx, 1);
    this.lruOrder.push(key);
  }

  /** LRU 淘汰:超 MAX_WORKSPACE_GRAPHS 时 dispose 并移除最久未用的 graph。
   *  注意:不淘汰当前 active。 */
  private evictIfNeeded(): void {
    while (this.lruOrder.length > WorkspaceGraphFactory.MAX_WORKSPACE_GRAPHS) {
      const oldestKey = this.lruOrder[0];
      if (oldestKey === undefined) break;
      if (oldestKey === this.graphKey(this.activeCwd ?? "")) {
        // 跳过 active,从第二老开始
        const nextIdx = 1;
        if (nextIdx >= this.lruOrder.length) break;
        const nextKey = this.lruOrder[nextIdx];
        if (nextKey === undefined) break;
        const evicted = this.graphs.get(nextKey);
        this.graphs.delete(nextKey);
        this.lruOrder.splice(nextIdx, 1);
        if (evicted) {
          try {
            void this.workspaceLifecycle.disposeGraph(evicted);
          } catch {
            /* ignore */
          }
        }
        continue;
      }
      const evicted = this.graphs.get(oldestKey);
      this.graphs.delete(oldestKey);
      this.lruOrder.shift();
      if (evicted) {
        try {
          void this.workspaceLifecycle.disposeGraph(evicted);
        } catch {
          /* ignore */
        }
      }
    }
  }

  /** 查注册表里是否已有该 cwd 的 graph(命中缓存=切回零 build)。 */
  getRegisteredGraph(canonicalCwd: string): WorkspaceGraph | null {
    return this.graphs.get(this.graphKey(canonicalCwd)) ?? null;
  }

  /** 从注册表移除并 dispose 一个 graph(文件操作如 archive/delete 后清理用)。 */
  private removeRegisteredGraph(canonicalCwd: string): void {
    const key = this.graphKey(canonicalCwd);
    const g = this.graphs.get(key);
    if (!g) return;
    this.graphs.delete(key);
    const idx = this.lruOrder.indexOf(key);
    if (idx >= 0) this.lruOrder.splice(idx, 1);
    if (this.activeCwd && this.graphKey(this.activeCwd) === key) {
      this.clearActiveGraph();
    }
    try {
      void this.workspaceLifecycle.disposeGraph(g);
    } catch {
      /* ignore */
    }
  }

  getSessionOperationLock(session: AgentSession): AgentOperationLock {
    return this.sessionRuntimeCache.getSessionOperationLock(session);
  }

  isSessionBusy(session: AgentSession): boolean {
    return this.sessionRuntimeCache.isSessionBusy(session);
  }

  beginQueueTransaction(session: AgentSession) {
    return this.sessionRuntimeCache.beginQueueTransaction(session);
  }

  finishQueueTransaction(session: AgentSession) {
    return this.sessionRuntimeCache.finishQueueTransaction(session);
  }

  syncQueueState(session: AgentSession, force = false) {
    return this.sessionRuntimeCache.syncQueueState(session, force);
  }

  setSessionRunId(session: AgentSession, runId: string): void {
    this.sessionRuntimeCache.setSessionRunId(session, runId);
  }

  clearSessionRunId(session: AgentSession): void {
    this.sessionRuntimeCache.clearSessionRunId(session);
  }

  hasBusySessions(): boolean {
    return this.sessionRuntimeCache.hasBusySessions();
  }

  getSessionRuntimeInfo(
    sessionId: string,
    sessionPath: string,
  ): { runtimeState: SessionRuntimeState; sessionRevision: number } | null {
    return this.sessionRuntimeCache.getSessionRuntimeInfo(sessionId, sessionPath);
  }

  resolveSessionIdentity(sessionId: unknown, sessionRevision: unknown): HostIdentity | null {
    return this.sessionRuntimeCache.resolveSessionIdentity(sessionId, sessionRevision);
  }

  canonicalizeCwd(cwd: string): string {
    return this.workspaceLifecycle.canonicalizeCwd(cwd);
  }

  buildWorkspaceSnapshot(g: WorkspaceGraph): WorkspaceSnapshot {
    return this.workspaceLifecycle.buildWorkspaceSnapshot(g);
  }

  /**
   * Dispose agent session and optionally entire graph services.
   */
  async disposeAgentSession(g: WorkspaceGraph): Promise<void> {
    return this.sessionRuntimeCache.disposeAgentSession(g);
  }

  /**
   * Dispose a session instance without mutating graph slots (candidate discard/commit).
   * @internal — session-lifecycle module
   */
  async disposeAgentSessionOnly(session: AgentSession): Promise<void> {
    return this.sessionRuntimeCache.disposeAgentSessionOnly(session);
  }

  /** @internal — session-lifecycle module */
  retainBusySession(
    graph: WorkspaceGraph,
    previous: ActiveSessionState,
  ): BackgroundSessionRuntime | null {
    return this.sessionRuntimeCache.retainBusySession(graph, previous);
  }

  /** @internal - session lifecycle file mutations */
  async disposeBackgroundSessionRuntimeIfIdle(
    graph: WorkspaceGraph,
    sessionId: string,
    sessionPath: string,
  ): Promise<"none" | "busy" | "disposed"> {
    return this.sessionRuntimeCache.disposeBackgroundSessionRuntimeIfIdle(
      graph,
      sessionId,
      sessionPath,
    );
  }

  async disposeSettledBackgroundRuntime(
    graph: WorkspaceGraph,
    runtime: BackgroundSessionRuntime,
  ): Promise<void> {
    return this.sessionRuntimeCache.disposeSettledBackgroundRuntime(graph, runtime);
  }

  /** @internal — session-lifecycle module */
  announceRetainedRuntime(runtime: BackgroundSessionRuntime): void {
    this.sessionRuntimeCache.announceRetainedRuntime(runtime);
  }

  /** @internal — session-lifecycle module */
  async promoteBackgroundRuntime(
    graph: WorkspaceGraph,
    runtime: BackgroundSessionRuntime,
  ): Promise<SessionSnapshot | { error: HostError }> {
    return this.sessionRuntimeCache.promoteBackgroundRuntime(graph, runtime);
  }

  async disposeGraph(g: WorkspaceGraph): Promise<void> {
    return this.workspaceLifecycle.disposeGraph(g);
  }

  /** Dispose every idle Workspace graph retained by the lifecycle owner.
   *  语义改为:清空整个注册表(host 关闭/重置用)。 */
  async disposeRetainedGraphs(): Promise<void> {
    const all = [...this.graphs.values()];
    this.graphs.clear();
    this.lruOrder.length = 0;
    this.clearActiveGraph();
    for (const g of all) {
      try {
        await this.workspaceLifecycle.disposeGraph(g);
      } catch {
        /* ignore */
      }
    }
  }

  /** Dispose the idle Workspace graph that shares a Session storage namespace.
   *  语义改为:从注册表移除并 dispose 该 cwd 的 graph(archive/delete/restore 后清理)。 */
  async invalidateRetainedWorkspaceGraph(canonicalCwd: string): Promise<void> {
    this.removeRegisteredGraph(canonicalCwd);
  }

  /** Drop every idle runtime that may have captured old settings or resources.
   *  语义改为:清空注册表(provider/config 变更要重来)。 */
  async invalidateRetainedRuntimeCaches(): Promise<void> {
    await this.disposeRetainedGraphs();
  }

  /** @internal — session-lifecycle module */
  async activateExtensionUi(g: WorkspaceGraph): Promise<() => void> {
    return activateOnce(g);
  }

  /** Atomic Workspace switch facade. */
  async setCurrent(
    cwd: string,
    requestId: string,
  ): Promise<
    | {
        workspace: WorkspaceSnapshot;
        session?: SessionSnapshot;
      }
    | { error: HostError }
  > {
    return this.workspaceLifecycle.setCurrent(cwd, requestId);
  }

  /** @internal — session-lifecycle module */
  handleAgentEvent(graph: WorkspaceGraph, sourceSession: AgentSession, event: unknown): void {
    this.sessionRuntimeCache.handleAgentEvent(graph, sourceSession, event);
  }

  async listSessions() {
    return listSessions(this);
  }

  async archiveSession(requestId: string, sessionId: string, sessionPath: string) {
    return archiveSession(this, requestId, sessionId, sessionPath);
  }

  async restoreSession(requestId: string, sessionId: string, sessionPath: string) {
    return restoreSession(this, requestId, sessionId, sessionPath);
  }

  async deleteSession(requestId: string, sessionId: string, sessionPath: string) {
    return deleteSession(this, requestId, sessionId, sessionPath);
  }

  async cleanupArchivedSessions(requestId: string) {
    return cleanupArchivedSessions(this, requestId);
  }

  async renameSession(requestId: string, sessionId: string, sessionPath: string, name: string) {
    return renameSession(this, requestId, sessionId, sessionPath, name);
  }

  setActiveSessionName(name: string) {
    return setActiveSessionName(this, name);
  }

  async refineActiveSessionName(args: {
    session: AgentSession;
    sessionId: string;
    provisionalTitle: string;
    userPrompt: string;
  }) {
    return refineActiveSessionName(this, args);
  }

  /** @internal — session-lifecycle module */
  sessionPathsEqual(left: string | undefined, right: string): boolean {
    if (!left) return false;
    const resolvedLeft = pathResolve(left);
    const resolvedRight = pathResolve(right);
    return process.platform === "win32"
      ? resolvedLeft.toLowerCase() === resolvedRight.toLowerCase()
      : resolvedLeft === resolvedRight;
  }

  async createSession(requestId: string, name?: string) {
    return createSession(this, requestId, name);
  }

  async openSession(
    requestId: string,
    sessionPath: string,
    options: { forceReload?: boolean } = {},
  ) {
    return openSession(this, requestId, sessionPath, options);
  }

  async reloadSession(requestId: string) {
    return reloadSession(this, requestId);
  }

  checkIdentity(
    context: Record<string, unknown>,
    opts: {
      requireWorkspace?: boolean;
      requireSession?: boolean;
      allowNullSession?: boolean;
      requirePackage?: boolean;
      requireTool?: boolean;
    } = {},
  ): HostError | null {
    const server = this.server;
    if (!server) return createHostError("HOST_NOT_READY", "Host not ready");

    if (
      typeof context.expectedHostInstanceId === "string" &&
      context.expectedHostInstanceId !== server.identity.hostInstanceId
    ) {
      return createHostError("STALE_REVISION", "Host instance mismatch");
    }

    if (opts.requireWorkspace) {
      if (context.expectedWorkspaceId !== server.identity.workspaceId) {
        return createHostError("STALE_REVISION", "Workspace id mismatch");
      }
      if (context.expectedWorkspaceRevision !== server.identity.workspaceRevision) {
        return createHostError("STALE_REVISION", "Workspace revision mismatch");
      }
    }

    if (opts.requireSession || opts.allowNullSession) {
      if (context.expectedSessionId !== server.identity.sessionId) {
        return createHostError("STALE_REVISION", "Session id mismatch");
      }
      if (context.expectedSessionRevision !== server.identity.sessionRevision) {
        return createHostError("STALE_REVISION", "Session revision mismatch");
      }
    }

    if (opts.requirePackage) {
      if (context.expectedPackageRevision !== server.identity.packageRevision) {
        return createHostError("STALE_REVISION", "Package revision mismatch");
      }
    }

    if (opts.requireTool) {
      const g = this.graph;
      if (!g || context.expectedToolRevision !== g.toolRevision) {
        return createHostError("STALE_REVISION", "Tool revision mismatch");
      }
    }

    return null;
  }
}
