import { useEffect, useRef, useState } from "react";
import { useSessionStore } from "../../stores/session-store";
import { useChatStore } from "../../stores/chat-store";
import { useSettingsStore } from "../../stores/settings-store";
import { ScrollArea } from "../ui/scroll-area";
import { Separator } from "../ui/separator";
import { cn } from "../../lib/utils";
import {
  Plus, MessageSquare, Settings, ChevronRight, Folder, FolderPlus,
  MoreHorizontal, Pencil, Trash2, Archive,
} from "lucide-react";

/** 相对时间格式化。 */
function relTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "刚刚";
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  return `${Math.floor(h / 24)} 天前`;
}

/** 操作菜单项。 */
function MenuItem({ icon: Icon, label, onClick, danger }: { icon: typeof Pencil; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] transition-colors hover:bg-muted/60",
        danger && "text-destructive hover:bg-destructive/10",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

/** 操作菜单(hover ⋯ 触发,点外侧关闭)。 */
function ActionMenu({ items }: { items: { icon: typeof Pencil; label: string; onClick: () => void; danger?: boolean }[] }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setPos({ top: r.bottom + 2, left: r.right - 144 });
          setOpen(!open);
        }}
        className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/60 transition hover:bg-muted/60 hover:text-foreground"
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </button>
      {open ? (
        <div
          style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 50 }}
          className="w-36 rounded-lg border border-border/60 bg-popover p-1 shadow-lg"
        >
          {items.map((it, i) => (
            <MenuItem key={i} {...it} onClick={() => { it.onClick(); setOpen(false); }} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * 左侧会话栏:按项目(文件夹)分组,项目下挂会话。
 * 项目和会话都支持改名/删除/归档(⋯ 菜单)。
 */
export function SessionSidebar() {
  const projects = useSessionStore((s) => s.projects);
  const activeId = useSessionStore((s) => s.activeId);
  const generatingBySession = useChatStore((s) => s.generatingBySession);
  const create = useSessionStore((s) => s.create);
  const addProject = useSessionStore((s) => s.addProject);
  const select = useSessionStore((s) => s.select);
  const toggleProject = useSessionStore((s) => s.toggleProject);
  const renameProject = useSessionStore((s) => s.renameProject);
  const removeProject = useSessionStore((s) => s.removeProject);
  const archiveProject = useSessionStore((s) => s.archiveProject);
  const rename = useSessionStore((s) => s.rename);
  const archiveSession = useSessionStore((s) => s.archiveSession);
  const openSettings = useSettingsStore((s) => s.setOpen);

  // 内联编辑状态(项目名/会话名改名,Electron 禁用 window.prompt)
  const [editing, setEditing] = useState<{ kind: "project" | "session"; id: string; value: string } | null>(null);
  const editRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) editRef.current?.select(); }, [editing]);
  const commitEdit = () => {
    if (!editing) return;
    const v = editing.value.trim();
    if (v) {
      if (editing.kind === "project") renameProject(editing.id, v);
      else rename(editing.id, v);
    }
    setEditing(null);
  };

  const handleRenameProject = (id: string, cur: string) => setEditing({ kind: "project", id, value: cur });
  const handleRenameSession = (id: string, cur: string) => setEditing({ kind: "session", id, value: cur });

  return (
    <div className="flex h-full flex-col bg-muted/25">
      {/* 侧栏头部:项目标题 + 新建项目按钮 */}
      <div className="flex items-center justify-between px-3 pb-1 pt-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">项目</span>
        <button
          type="button"
          onClick={() => void addProject()}
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="新建项目(选择文件夹)"
        >
          <FolderPlus className="h-3.5 w-3.5" />
          新建
        </button>
      </div>
      {/* 项目列表 */}
      <ScrollArea className="flex-1">
        <div className="px-1.5 pb-2 pt-2.5">
          {projects.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-3 py-12 text-center text-muted-foreground">
              <Folder className="h-8 w-8 opacity-30" />
              <div className="text-[12px]">还没有项目</div>
              <button
                type="button"
                onClick={() => void addProject()}
                className="flex items-center gap-1 rounded-md border border-border/60 px-2.5 py-1 text-[12px] text-foreground transition-colors hover:bg-muted/60"
              >
                <FolderPlus className="h-3.5 w-3.5" /> 新建项目
              </button>
            </div>
          ) : projects.map((p) => {
            const collapsed = p.collapsed;
            const visibleSessions = p.sessions.filter((s) => !s.archived);
            const projectRunning = visibleSessions.some((s) => generatingBySession[s.id]);
            return (
              <div key={p.id} className="mb-1">
                {/* 项目头 */}
                <div className="group flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-background/40">
                  <button
                    type="button"
                    onClick={() => toggleProject(p.id)}
                    className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                  >
                    <ChevronRight
                      className={cn(
                        "h-3.5 w-3.5 shrink-0 text-muted-foreground/60 transition-transform",
                        !collapsed && "rotate-90",
                      )}
                    />
                    {projectRunning ? (
                      <span className="relative flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                        <span className="signal-dot signal-dot-live" aria-hidden />
                      </span>
                    ) : (
                      <Folder className={cn("h-3.5 w-3.5 shrink-0", p.archived ? "text-muted-foreground/40" : "text-muted-foreground")} />
                    )}
                    {editing?.kind === "project" && editing.id === p.id ? (
                      <input
                        ref={editRef}
                        value={editing.value}
                        onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                        onBlur={commitEdit}
                        onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditing(null); }}
                        className="min-w-0 flex-1 rounded border border-accent/50 bg-background px-1 py-0.5 text-[12px] font-medium outline-none"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className={cn("truncate text-[12px] font-medium", p.archived && "text-muted-foreground/60 line-through")}>
                        {p.name}
                      </span>
                    )}
                    <span className="shrink-0 text-[10px] text-muted-foreground/50">
                      {visibleSessions.length}
                    </span>
                  </button>
                  {/* 项目级新建 + 操作菜单 */}
                  <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => void create(p.id)}
                      className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/60 hover:bg-muted/60 hover:text-foreground"
                      title="新建会话"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                    <ActionMenu
                      items={[
                        { icon: Pencil, label: "改名", onClick: () => handleRenameProject(p.id, p.name) },
                        { icon: Archive, label: p.archived ? "取消归档" : "归档", onClick: () => archiveProject(p.id) },
                        { icon: Trash2, label: "删除", onClick: () => removeProject(p.id), danger: true },
                      ]}
                    />
                  </div>
                </div>

                {/* 会话列表(grid 高度过渡展开,折叠 0fr/展开 1fr) */}
                <div
                  className="grid transition-all duration-200 ease-out"
                  style={{ gridTemplateRows: collapsed ? "0fr" : "1fr" }}
                >
                  <div className="overflow-hidden">
                    <div className="ml-3 space-y-0.5 border-l border-border/40 pl-1 py-1">
                      {visibleSessions.map((s) => {
                      const active = s.id === activeId;
                      return (
                        <div
                          key={s.id}
                          className={cn(
                            "group relative flex items-center rounded-lg px-2 py-1.5 transition-colors",
                            active ? "bg-background shadow-sm" : "hover:bg-background/60",
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => select(s.id)}
                            className="flex min-w-0 flex-1 items-center gap-2 text-left"
                          >
                            {active ? (
                              <span className="absolute -left-[5px] top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-accent" />
                            ) : null}
                            {generatingBySession[s.id] ? (
                              <span className="signal-dot signal-dot-live shrink-0" aria-hidden />
                            ) : (
                              <MessageSquare className={cn("h-3 w-3 shrink-0", active ? "text-accent" : "text-muted-foreground")} />
                            )}
                            <div className="min-w-0 flex-1">
                              {editing?.kind === "session" && editing.id === s.id ? (
                                <input
                                  ref={editRef}
                                  value={editing.value}
                                  onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                                  onBlur={commitEdit}
                                  onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditing(null); }}
                                  className="w-full rounded border border-accent/50 bg-background px-1 py-0.5 text-[12px] outline-none"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              ) : (
                                <div className={cn("truncate text-[12px]", active ? "font-medium text-foreground" : "text-foreground/85")}>
                                  {s.title}
                                </div>
                              )}
                              <div className="text-[10px] text-muted-foreground/70">{relTime(s.updatedAt)}</div>
                            </div>
                          </button>
                          {/* 会话操作菜单 */}
                          <div className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
                            <ActionMenu
                              items={[
                                { icon: Pencil, label: "改名", onClick: () => handleRenameSession(s.id, s.title) },
                                { icon: Archive, label: "归档", onClick: () => archiveSession(s.id) },
                              ]}
                            />
                          </div>
                        </div>
                      );
                    })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <Separator className="bg-border/60" />

      {/* 底部:设置入口 */}
      <div className="p-1.5">
        <button
          type="button"
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-muted-foreground transition-colors hover:bg-background/60"
          onClick={() => openSettings(true)}
        >
          <div className="flex h-5 w-5 items-center justify-center">
            <Settings className="h-4 w-4" />
          </div>
          设置
        </button>
      </div>
    </div>
  );
}
