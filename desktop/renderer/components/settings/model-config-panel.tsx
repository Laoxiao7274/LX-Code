import { useRef, useState } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { ChevronDown, Plus, Pencil, Trash2, RefreshCw, Server, Check } from "lucide-react";
import { useModelStore } from "../../stores/model-store";
import { ProviderForm } from "./provider-form";
import { cn } from "../../lib/utils";

gsap.registerPlugin(useGSAP);

/** 提供商图标:预设用首字母,自定义用 Server 图标。 */
function ProviderIcon({ p }: { p: { icon?: string; color: string; kind: string } }) {
  return (
    <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted font-semibold", p.color)}>
      {p.kind === "custom" ? <Server className="h-4 w-4" /> : (p.icon ?? "?")}
    </span>
  );
}

/**
 * 模型配置面板:提供商列表(可折叠)。
 * 点卡片 → 展开模型列表(设默认/启禁用 + 获取/添加)。
 * 「编辑配置」→ 覆盖层表单(URL/Key/headers 等,按需)。
 */
export function ModelConfigPanel() {
  const providers = useModelStore((s) => s.providers);
  const defaultModel = useModelStore((s) => s.defaultModel);
  const setDefault = useModelStore((s) => s.setDefault);
  const toggleModel = useModelStore((s) => s.toggleModel);
  const openAdd = useModelStore((s) => s.openAdd);
  const openEdit = useModelStore((s) => s.openEdit);
  const removeProvider = useModelStore((s) => s.removeProvider);
  const fetchModels = useModelStore((s) => s.fetchModels);
  const editing = useModelStore((s) => s.editing);
  const isAdding = useModelStore((s) => s.isAdding);

  const [expanded, setExpanded] = useState<string | null>(providers[0]?.id ?? null);
  const [fetching, setFetching] = useState<string | null>(null);

  const handleFetch = (providerId: string) => {
    setFetching(providerId);
    setTimeout(() => { fetchModels(providerId); setFetching(null); }, 800);
  };

  return (
    <div className="space-y-2">
      {providers.map((p) => {
        const isOpen = expanded === p.id;
        const activeModel = defaultModel.startsWith(`${p.id}/`);
        return (
          <div key={p.id} className="overflow-hidden rounded-lg border border-border/60">
            {/* 提供商头:点展开模型列表 */}
            <div className="flex items-center gap-2.5 px-3 py-2.5">
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : p.id)}
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
              {/* 编辑配置(单独弹表单) */}
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => openEdit(p.id)} title="编辑配置">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              {p.kind === "custom" ? (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeProvider(p.id)} title="删除">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              ) : null}
              <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform", isOpen && "rotate-180")} />
            </div>

            {/* 展开:模型列表(轻量) */}
            {isOpen ? (
              <div className="border-t border-border/60 bg-muted/20 p-2.5">
                <div className="mb-2 flex gap-1.5">
                  <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => handleFetch(p.id)} disabled={fetching === p.id}>
                    <RefreshCw className={cn("h-3 w-3", fetching === p.id && "animate-spin")} />
                    {fetching === p.id ? "获取中…" : "自动获取"}
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => openEdit(p.id)}>
                    <Plus className="h-3 w-3" /> 手动添加
                  </Button>
                </div>

                {p.models.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border/60 py-4 text-center text-[12px] text-muted-foreground">
                    暂无模型
                  </div>
                ) : (
                  <div className="space-y-1">
                    {p.models.map((m) => {
                      const key = `${p.id}/${m.id}`;
                      const isDefault = defaultModel === key;
                      return (
                        <div key={m.id} className={cn("flex items-center gap-2.5 rounded-md px-2.5 py-1.5", m.enabled ? "bg-background/60" : "opacity-50")}>
                          <button
                            type="button"
                            onClick={() => setDefault(key)}
                            className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded-full border", isDefault ? "border-accent bg-accent" : "border-muted-foreground/30 hover:border-foreground/50")}
                            title={isDefault ? "默认" : "设为默认"}
                          >
                            {isDefault ? <Check className="h-2.5 w-2.5 text-white" /> : null}
                          </button>
                          <span className={cn("truncate text-[13px]", isDefault ? "font-medium" : "text-foreground/85")}>{m.name}</span>
                          <span className="shrink-0 font-mono text-[10px] text-muted-foreground/60">{m.id}</span>
                          <Button variant="ghost" size="sm" className="ml-auto h-6 text-[11px] text-muted-foreground" onClick={() => toggleModel(p.id, m.id)}>
                            {m.enabled ? "禁用" : "启用"}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        );
      })}

      {/* 添加提供商 */}
      <button
        type="button"
        onClick={openAdd}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/60 py-2.5 text-[12px] text-muted-foreground transition-colors hover:bg-muted/40"
      >
        <Plus className="h-3.5 w-3.5" /> 添加提供商
      </button>

      {/* 配置表单(覆盖层,编辑/新增共用) */}
      {editing ? <ProviderForm provider={editing} isAdding={isAdding} /> : null}
    </div>
  );
}
