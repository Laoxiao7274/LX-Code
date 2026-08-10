import { ChevronDown, Folder, FolderPlus, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAppStore } from "../../lib/stores/app-store";
import { hostClient } from "../../lib/bridge/host-client";
import {
  notifyDesktopSettingsSaveFailure,
  persistDesktopSettings,
} from "../../lib/desktop-settings";
import { sidebarPref, setSidebarPref } from "../../lib/sidebar-prefs";
import { useT } from "../../lib/i18n/use-t";
import {
  captureRequestGeneration,
  isCurrentRequestGeneration,
  workspaceContext,
} from "../../lib/bridge/host-context";

export function workspaceDisplayName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? "Workspace";
}

/** Renderer path identity uses only Host-canonical strings. */
function samePath(a: string, b: string): boolean {
  return a === b;
}

export function addKnownWorkspace(list: string[], path: string): string[] {
  return list.some((entry) => samePath(entry, path)) ? list : [...list, path];
}

export function removeKnownWorkspace(list: string[], path: string): string[] {
  return list.filter((entry) => !samePath(entry, path));
}

export function replaceKnownWorkspace(
  list: string[],
  requestedPath: string,
  canonicalPath: string,
): string[] {
  const next = list.map((entry) => (samePath(entry, requestedPath) ? canonicalPath : entry));
  if (!next.some((entry) => samePath(entry, canonicalPath))) next.push(canonicalPath);
  return next.filter((entry, index) => next.indexOf(entry) === index);
}

// Stable fallback: a fresh [] per render makes the zustand selector loop.
const NO_WORKSPACES: string[] = [];

export function WorkspacePicker() {
  const t = useT();
  const host = useAppStore((s) => s.host);
  const workspace = useAppStore((s) => s.workspace);
  const knownWorkspaces = useAppStore((s) => s.desktopSettings?.knownWorkspaces ?? NO_WORKSPACES);
  const setWorkspace = useAppStore((s) => s.setWorkspace);
  const setSession = useAppStore((s) => s.setSession);
  const pushNotification = useAppStore((s) => s.pushNotification);
  const [pending, setPending] = useState(false);
  const [collapsed, setCollapsed] = useState(() =>
    sidebarPref("lxcode.sidebar.workspacesCollapsed"),
  );
  const requestRef = useRef(0);

  function toggleCollapsed() {
    setCollapsed((current) => {
      setSidebarPref("lxcode.sidebar.workspacesCollapsed", !current);
      return !current;
    });
  }

  const currentCwd = workspace?.canonicalCwd ?? null;
  const requestedCwd = workspace?.cwd ?? null;

  // Self-heal: whatever workspace is active (restored, picked, or set by the
  // host) always appears in the persistent list.
  useEffect(() => {
    if (!currentCwd) return;
    const next = replaceKnownWorkspace(knownWorkspaces, requestedCwd ?? currentCwd, currentCwd);
    if (
      next.length === knownWorkspaces.length &&
      next.every((entry, index) => entry === knownWorkspaces[index])
    ) {
      return;
    }
    void persistDesktopSettings({
      knownWorkspaces: next,
    }).catch(notifyDesktopSettingsSaveFailure);
  }, [currentCwd, knownWorkspaces, requestedCwd]);

  // 初始化项目:创建本地 git 仓库 + codegraph 建索引,完成后才能对话
  async function initializeWorkspace(cwd: string) {
    // 必须从 store 动态取最新 host/workspace,不能用闭包变量(host/workspace 是组件 render 时的旧值)。
    // switchTo 在 setCurrent 成功后才调本函数,此时 host identity 已是新工作区,但闭包变量还是旧的
    // → workspace.initialize 带 stale expectedWorkspaceId 会触发 'Workspace id mismatch'。
    const store = useAppStore.getState();
    const currentHost = store.host;
    const currentWorkspace = store.workspace;
    if (!currentHost) return;
    store.setWorkspaceInitializing(true, t("workspaceInitializing"));
    try {
      const res = await hostClient.request(
        "workspace.initialize",
        workspaceContext(currentHost, currentWorkspace),
        null,
        120_000,
      );
      if (res.ok) {
        const { git, codegraph, message } = res.result;
        // message 含“已打开索引”=幂等命中(切回已访问工作区,未做事),不弹通知扰用户。
        // 只在首次索引完成 或 部分失败时弹。
        const alreadyIndexed = typeof message === "string" && message.includes("已打开索引");
        if (!git || !codegraph) {
          pushNotification(`${t("workspaceInitPartial")}: ${message}`, "warning");
        } else if (!alreadyIndexed) {
          pushNotification(t("workspaceInitDone"), "info");
        }
        // alreadyIndexed 且都 ok:静默,不弹
      } else {
        pushNotification(res.error?.message ?? t("workspaceInitFail"), "warning");
      }
    } catch {
      // 静默,不阻断对话
    } finally {
      useAppStore.getState().setWorkspaceInitializing(false);
    }
  }

  async function switchTo(cwd: string) {
    if (!host || pending) return;
    if (currentCwd && samePath(currentCwd, cwd)) return;

    const request = ++requestRef.current;
    const generation = captureRequestGeneration(host);
    setPending(true);
    try {
      const res = await hostClient.request(
        "workspace.setCurrent",
        workspaceContext(host, workspace),
        { cwd },
        60_000,
      );

      if (
        request !== requestRef.current ||
        !isCurrentRequestGeneration(useAppStore.getState().host, generation)
      ) {
        return;
      }
      if (!res.ok) {
        const detail = res.error?.details ? ` (占用: ${JSON.stringify(res.error.details)})` : "";
        pushNotification(`${res.error?.message ?? t("notifSetWorkspaceFailed")}${detail}`, "error");
        return;
      }

      const result = res.result;
      // workspace.changed / session.snapshot events land before this response
      // resolves; re-applying identical snapshots re-renders the chat and
      // sidebar a second time. Apply only what the event stream has not.
      const appliedWorkspace = useAppStore.getState().workspace;
      if (
        appliedWorkspace === null ||
        appliedWorkspace.id !== result.workspace.id ||
        appliedWorkspace.revision !== result.workspace.revision
      ) {
        setWorkspace(result.workspace);
      }
      const responseSession = result.session;
      if (responseSession) {
        const appliedSession = useAppStore.getState().session;
        if (
          appliedSession === null ||
          appliedSession.sessionId !== responseSession.sessionId ||
          appliedSession.revision !== responseSession.revision
        ) {
          setSession(responseSession);
        }
      }
      useAppStore.getState().setHost({
        ...host,
        workspaceId: res.workspaceId,
        workspaceRevision: res.workspaceRevision,
        sessionId: res.sessionId,
        sessionRevision: res.sessionRevision,
        packageRevision: res.packageRevision,
      });
      // 初始化新项目:git 仓库 + codegraph 索引(完成后才能对话)
      await initializeWorkspace(cwd);
    } finally {
      if (request === requestRef.current) setPending(false);
    }
  }

  async function pickAndAdd() {
    if (!host || pending) return;
    let cwd: string | null = null;
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({ directory: true, multiple: false });
      if (typeof selected === "string") cwd = selected;
    } catch {
      cwd = window.prompt(t("workspacesEnterPath")) || null;
    }
    if (!cwd) return;
    await switchTo(cwd);
  }

  function removeFromList(path: string) {
    void persistDesktopSettings({
      knownWorkspaces: removeKnownWorkspace(knownWorkspaces, path),
    }).catch(notifyDesktopSettingsSaveFailure);
  }

  // Render the active workspace even before self-heal persists it.
  const listed = currentCwd ? addKnownWorkspace(knownWorkspaces, currentCwd) : knownWorkspaces;

  return (
    <section>
      <div className="mb-1 flex h-7 items-center justify-between px-2">
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          title={collapsed ? t("workspacesExpand") : t("workspacesCollapse")}
          className="group flex min-w-0 items-center gap-1 text-[11px] font-medium text-muted transition-colors hover:text-foreground"
        >
          <span>{t("workspacesTitle")}</span>
          <ChevronDown
            size={12}
            className={`opacity-0 transition-all group-hover:opacity-100 ${
              collapsed ? "-rotate-90" : ""
            }`}
          />
        </button>
        <button
          type="button"
          onClick={() => void pickAndAdd()}
          disabled={!host || pending}
          className="flex size-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-overlay hover:text-foreground disabled:opacity-40"
          title={t("workspacesAdd")}
          aria-label={t("workspacesAdd")}
        >
          <Plus size={15} />
        </button>
      </div>
      {collapsed ? null : listed.length === 0 ? (
        <button
          type="button"
          onClick={() => void pickAndAdd()}
          disabled={!host || pending}
          className="flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-left text-sm text-muted transition-colors hover:bg-surface-overlay hover:text-foreground disabled:opacity-40"
        >
          <FolderPlus size={16} />
          <span>{pending ? t("workspacesOpening") : t("workspacesAdd")}</span>
        </button>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {listed.map((path) => {
            const active = Boolean(currentCwd && samePath(currentCwd, path));
            return (
              <li
                key={path}
                className={`group flex h-9 items-center rounded-md text-[13px] ${
                  active ? "bg-surface-overlay font-medium" : "hover:bg-surface-overlay/70"
                }`}
              >
                <button
                  type="button"
                  onClick={() => void switchTo(path)}
                  disabled={!host || pending || active}
                  className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left disabled:cursor-default"
                  title={`${workspaceDisplayName(path)}\n${path}`}
                  aria-current={active ? "true" : undefined}
                >
                  <Folder
                    size={16}
                    className={`shrink-0 ${active ? "text-accent" : "text-muted"}`}
                  />
                  <span className="min-w-0 flex-1 truncate">{workspaceDisplayName(path)}</span>
                  {active && (
                    <span
                      className={`size-1.5 shrink-0 rounded-full ${
                        workspace?.servicesReady ? "bg-success" : "bg-warning"
                      }`}
                    />
                  )}
                </button>
                {!active && (
                  <button
                    type="button"
                    onClick={() => removeFromList(path)}
                    disabled={pending}
                    className="mr-1 hidden rounded p-1 text-muted hover:bg-surface hover:text-foreground group-hover:block"
                    title={t("workspacesRemoveTitle")}
                    aria-label={t("workspacesRemoveAria", { name: workspaceDisplayName(path) })}
                  >
                    <X size={13} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
