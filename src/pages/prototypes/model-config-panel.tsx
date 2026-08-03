import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Plus, Trash2, Server, Check } from "lucide-react";
import { useModelStore } from "./model-store";
import { ProviderForm } from "./provider-form";
import { cn } from "@/lib/utils";

/** 提供商图标:预设用首字母,自定义用 Server 图标。 */
function ProviderIcon({ p }: { p: { icon?: string; color: string; kind: string } }) {
  return (
    <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted font-semibold", p.color)}>
      {p.kind === "custom" ? <Server className="h-4 w-4" /> : (p.icon ?? "?")}
    </span>
  );
}

/**
 * 模型配置面板:提供商列表,点卡片直接展开内联表单。
 * 表单内含模型管理(自动获取/手动添加)。
 */
export function ModelConfigPanel() {
  const providers = useModelStore((s) => s.providers);
  const defaultModel = useModelStore((s) => s.defaultModel);
  const setDefault = useModelStore((s) => s.setDefault);
  const toggleModel = useModelStore((s) => s.toggleModel);
  const openAdd = useModelStore((s) => s.openAdd);
  const removeProvider = useModelStore((s) => s.removeProvider);
  const editing = useModelStore((s) => s.editing);
  const isAdding = useModelStore((s) => s.isAdding);
  const closeForm = useModelStore((s) => s.closeForm);

  // 当前展开(编辑表单)的提供商 id;null = 收起
  const [expanded, setExpanded] = useState<string | null>(null);

  // 编辑中的提供商来自 store(editing),展开 id 对应它
  const editingId = editing?.id ?? null;

  const handleEdit = (providerId: string) => {
    // 切换:已展开则收起,否则打开编辑
    if (expanded === providerId && !isAdding) {
      setExpanded(null);
      closeForm();
    } else {
      useModelStore.getState().openEdit(providerId);
      setExpanded(providerId);
    }
  };

  const handleAdd = () => {
    openAdd();
    setExpanded("__new__");
  };

  return (
    <div className="space-y-2">
      {providers.map((p) => {
        const isOpen = expanded === p.id;
        const activeModel = defaultModel.startsWith(`${p.id}/`);
        return (
          <div key={p.id} className="overflow-hidden rounded-lg border border-border/60">
            {/* 提供商头:点击直接展开内联表单 */}
            <div className="flex items-center gap-2.5 px-3 py-2.5">
              <button
                type="button"
                onClick={() => handleEdit(p.id)}
                className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
              >
                <ProviderIcon p={p} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-medium">{p.name}</span>
                    {activeModel ? <Badge variant="outline" className="h-4 px-1 text-[9px] text-accent">默认</Badge> : null}
                    {p.kind === "custom" ? <Badge variant="outline" className="h-4 px-1 text-[9px] text-muted-foreground">自定义</Badge> : null}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className={cn("h-1.5 w-1.5 rounded-full", p.connected ? "bg-emerald-500" : "bg-muted-foreground/40")} />
                    <span className="text-muted-foreground">{p.connected ? "已连接" : "未连接"}</span>
                    <span className="text-muted-foreground/50">·</span>
                    <span className="font-mono text-muted-foreground/70">{p.models.length} 个模型</span>
                  </div>
                </div>
              </button>
              {p.kind === "custom" ? (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeProvider(p.id)} title="删除">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              ) : null}
              <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform", isOpen && "rotate-180")} />
            </div>

            {/* 展开内容:内联编辑表单(含模型管理) */}
            {isOpen && editingId === p.id && editing ? (
              <div className="border-t border-border/60 bg-muted/20">
                <ProviderForm provider={editing} isAdding={false} embedded />
                {/* 模型快捷选择(设默认/启用) */}
                {editing.models.length > 0 ? (
                  <div className="border-t border-border/60 px-3 py-2.5">
                    <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">模型</div>
                    <div className="space-y-1">
                      {p.models.map((m) => {
                        const key = `${p.id}/${m.id}`;
                        const isDefault = defaultModel === key;
                        return (
                          <div key={m.id} className={cn("flex items-center gap-2.5 rounded-md px-2.5 py-1.5", m.enabled ? "bg-background/60" : "opacity-50")}>
                            <button
                              type="button"
                              onClick={() => setDefault(key)}
                              className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded-full border", isDefault ? "border-accent bg-accent" : "border-muted-foreground/30")}
                            >
                              {isDefault ? <Check className="h-2.5 w-2.5 text-white" /> : null}
                            </button>
                            <span className="truncate text-[13px] font-medium">{m.name}</span>
                            <span className="shrink-0 font-mono text-[10px] text-muted-foreground/60">{m.id}</span>
                            <Button variant="ghost" size="sm" className="ml-auto h-6 text-[11px] text-muted-foreground" onClick={() => toggleModel(p.id, m.id)}>
                              {m.enabled ? "禁用" : "启用"}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}

      {/* 新增中:内联展示新增表单 */}
      {isAdding && expanded === "__new__" && editing ? (
        <div className="overflow-hidden rounded-lg border border-accent/40">
          <div className="flex items-center gap-2.5 bg-accent/5 px-3 py-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground"><Plus className="h-4 w-4" /></span>
            <span className="text-[13px] font-medium text-accent">新增提供商</span>
          </div>
          <div className="bg-muted/20">
            <ProviderForm provider={editing} isAdding embedded />
          </div>
        </div>
      ) : null}

      {/* 添加提供商 */}
      {expanded !== "__new__" ? (
        <button
          type="button"
          onClick={handleAdd}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/60 py-2.5 text-[12px] text-muted-foreground transition-colors hover:bg-muted/40"
        >
          <Plus className="h-3.5 w-3.5" /> 添加提供商
        </button>
      ) : null}
    </div>
  );
}
