import { useEffect, useState } from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";
import { cn } from "../../lib/utils";
import { useDigestStore } from "../../stores/digest-store";
import type { DigestFile, FeatureCluster, FunctionSummary } from "../../types";
import {
  RefreshCw, Map, ChevronRight, FileCode2,
  CornerDownRight, AlertTriangle, FileWarning, Boxes,
} from "lucide-react";

/** level 对应的 badge 样式。 */
const LEVEL_STYLE: Record<string, string> = {
  core: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  util: "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  ui: "border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-400",
  glue: "border-muted-foreground/30 bg-muted/40 text-muted-foreground",
};

/** 折叠容器:用 state 懒渲染 + CSS max-height 过渡,避免 <details> 大数据卡顿。 */
function Collapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div
      className="overflow-hidden transition-[max-height] duration-200 ease-out"
      style={{ maxHeight: open ? "4000px" : "0px" }}
    >
      {open ? children : null}
    </div>
  );
}

/** 单个函数卡片(点击展开 how/logic/pitfalls/calls)。 */
function FunctionCard({ fn, open, onToggle }: { fn: FunctionSummary; open: boolean; onToggle: () => void }) {
  const hasDetail = (fn.how.length > 0) || (fn.logic?.length ?? 0) > 0 || (fn.pitfalls?.length ?? 0) > 0 || fn.calls;
  return (
    <div className="rounded-md border border-border/40 bg-background/40">
      <button
        type="button"
        onClick={() => hasDetail && onToggle()}
        className={cn("flex w-full items-start gap-1.5 px-2.5 py-1.5 text-left", hasDetail && "hover:bg-muted/30")}
      >
        {hasDetail ? (
          <ChevronRight className={cn("mt-0.5 h-3 w-3 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} />
        ) : <span className="mt-1.5 h-3 w-3 shrink-0" />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-mono text-[11.5px] font-medium">{fn.fn}</span>
            <Badge variant="outline" className={cn("shrink-0 px-1 py-0 text-[9.5px]", LEVEL_STYLE[fn.level])}>{fn.level}</Badge>
            {fn.entry ? <Badge variant="outline" className="shrink-0 px-1 py-0 text-[9.5px] text-accent border-accent/30">entry</Badge> : null}
            <span className="ml-auto shrink truncate pl-2 font-mono text-[10.5px] text-muted-foreground">{fn.file.split("/").pop()} L{fn.startLine}</span>
          </div>
          <div className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
            {fn.what || <span className="italic opacity-60">(白话待生成)</span>}
          </div>
        </div>
      </button>
      <Collapse open={open && hasDetail}>
        <div className="space-y-2 border-t border-border/40 px-2.5 py-2 text-[11.5px]">
          {fn.how.length > 0 ? (
            <div>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">怎么写的</div>
              <ol className="space-y-0.5">
                {fn.how.map((h, i) => <li key={i} className="flex gap-1"><span className="text-muted-foreground/50">{i + 1}.</span><span>{h}</span></li>)}
              </ol>
            </div>
          ) : null}
          {fn.logic?.length ? (
            <div>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">关键逻辑</div>
              <ul className="space-y-0.5">
                {fn.logic.map((l, i) => <li key={i} className="flex gap-1"><CornerDownRight className="mt-0.5 h-2.5 w-2.5 shrink-0 text-muted-foreground/50" /><span>{l}</span></li>)}
              </ul>
            </div>
          ) : null}
          {fn.pitfalls?.length ? (
            <div className="rounded border border-amber-500/30 bg-amber-500/5 p-1.5">
              <div className="mb-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400"><FileWarning className="h-2.5 w-2.5" /> 踩过的坑</div>
              <ul className="space-y-0.5">{fn.pitfalls.map((p, i) => <li key={i} className="flex gap-1 text-amber-700 dark:text-amber-300"><AlertTriangle className="mt-0.5 h-2.5 w-2.5 shrink-0" /><span>{p}</span></li>)}</ul>
            </div>
          ) : null}
          {fn.calls ? (
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[10.5px] text-muted-foreground">
              <span>调用: {fn.calls.calls.length ? fn.calls.calls.join(", ") : "—"}</span>
              <span>被调: {fn.calls.calledBy.length ? fn.calls.calledBy.join(", ") : "—"}</span>
            </div>
          ) : null}
        </div>
      </Collapse>
    </div>
  );
}

/** 功能簇卡片(主视图:点开看跨文件的函数)。 */
function FeatureCard({ cluster, fnsByFile, search }: { cluster: FeatureCluster; fnsByFile: Record<string, FunctionSummary[]>; search: string }) {
  const [open, setOpen] = useState(false);
  const [openFns, setOpenFns] = useState<Set<string>>(new Set());
  const [showMoreFns, setShowMoreFns] = useState(false);
  const q = search.trim().toLowerCase();
  // 簇内函数(从 functions 按 member 取),按重要性排序
  const members = cluster.members
    .map((m) => fnsByFile[m.file]?.find((f) => f.fn === m.fn))
    .filter((f): f is FunctionSummary => !!f)
    .filter((f) => !q || f.fn.toLowerCase().includes(q) || (f.what ?? "").toLowerCase().includes(q) || f.file.toLowerCase().includes(q))
    .sort((a, b) => {
      const order: Record<string, number> = { core: 0, util: 1, ui: 2, glue: 3 };
      return order[a.level] - order[b.level] || a.startLine - b.startLine;
    });
  if (members.length === 0) return null;
  const visibleFns = members.slice(0, 8);
  const restFns = members.slice(8);
  const toggleFn = (key: string) => setOpenFns((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const isOther = cluster.name === "其他函数";

  return (
    <div className={cn("rounded-md border", isOther ? "border-border/30 bg-muted/10" : "border-border/40")}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 px-2.5 py-2 text-left hover:bg-muted/30"
      >
        <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} />
        {isOther ? <Boxes className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" /> : <Boxes className="h-3.5 w-3.5 shrink-0 text-accent/70" />}
        <span className="truncate text-[12px] font-medium">{cluster.name}</span>
        {cluster.what && !isOther ? <span className="truncate text-[10.5px] text-muted-foreground">— {cluster.what}</span> : null}
        <span className="ml-auto flex shrink-0 items-center gap-2">
          {!isOther && cluster.cohesion > 0 ? <span className="text-[9.5px] text-muted-foreground/60" title="内聚度">●{cluster.cohesion.toFixed(1)}</span> : null}
          <span className="text-[10.5px] text-muted-foreground">{members.length} 函数</span>
        </span>
      </button>
      <Collapse open={open}>
        <div className="space-y-1 border-t border-border/40 p-1.5">
          {visibleFns.map((f) => (
            <FunctionCard key={`${f.file}:${f.fn}`} fn={f} open={openFns.has(`${f.file}:${f.fn}`)} onToggle={() => toggleFn(`${f.file}:${f.fn}`)} />
          ))}
          {restFns.length > 0 ? (
            <>
              <Collapse open={showMoreFns}>
                {restFns.map((f) => (
                  <FunctionCard key={`${f.file}:${f.fn}`} fn={f} open={openFns.has(`${f.file}:${f.fn}`)} onToggle={() => toggleFn(`${f.file}:${f.fn}`)} />
                ))}
              </Collapse>
              <button type="button" onClick={() => setShowMoreFns((v) => !v)} className="w-full rounded border border-border/30 py-0.5 text-[10px] text-muted-foreground hover:bg-muted/40">
                {showMoreFns ? "收起" : `还有 ${restFns.length} 个函数`}
              </button>
            </>
          ) : null}
        </div>
      </Collapse>
    </div>
  );
}

/**
 * 项目功能地图内嵌视图(右栏 Tab 内容)。
 * 主视图:按功能簇分组(像 IDE 大纲按功能),点开看跨文件函数。
 */
export function DigestView({ cwd }: { cwd: string }) {
  const digest = useDigestStore((s) => s.digest);
  const loading = useDigestStore((s) => s.loading);
  const error = useDigestStore((s) => s.error);
  const refresh = useDigestStore((s) => s.refresh);
  const reload = useDigestStore((s) => s.reload);
  const curCwd = useDigestStore((s) => s.cwd);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (cwd && cwd !== curCwd) {
      useDigestStore.setState({ cwd });
      void reload();
    } else if (cwd && !digest && !loading) {
      void reload();
    }
  }, [cwd, curCwd, digest, loading, reload]);

  const fnCount = digest ? Object.values(digest.functions).reduce((n, fns) => n + fns.length, 0) : 0;
  const features = digest?.features ?? [];
  const visibleFeatures = features.filter((f) => f.name !== "其他").slice(0, 15);
  const hiddenFeatures = features.filter((f) => f.name !== "其他").slice(15);
  const otherCluster = features.find((f) => f.name === "其他函数");
  const [showMoreFeat, setShowMoreFeat] = useState(false);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-7 shrink-0 items-center gap-1.5 border-b border-border/40 px-2.5">
        <span className="text-[11px] font-medium text-muted-foreground">
          {digest ? `${visibleFeatures.length} 功能 · ${fnCount} 函数` : "项目功能地图"}
        </span>
        <Button variant="ghost" size="icon" className="ml-auto h-6 w-6 text-muted-foreground" onClick={() => void refresh()} disabled={loading} title="刷新地图">
          <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-2.5 py-2 pr-3">
          {loading && !digest ? (
            <div className="py-12 text-center text-[12px] text-muted-foreground">
              <RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin opacity-50" />
              正在生成项目地图…
            </div>
          ) : !digest ? (
            <div className="py-12 text-center">
              <Map className="mx-auto mb-2 h-7 w-7 text-muted-foreground/40" />
              <div className="mb-2 text-[12px] text-muted-foreground">{error ?? "还没有项目地图"}</div>
              <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => void refresh()}>生成地图</Button>
            </div>
          ) : (
            <div className="space-y-2.5">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索功能或函数…"
                className="w-full rounded border border-border/40 bg-background/60 px-2 py-1 text-[11px] outline-none placeholder:text-muted-foreground/50 focus:border-accent/40"
              />
              {/* 功能簇(主视图,限量15 + 更多折叠) */}
              {visibleFeatures.map((c) => (
                <FeatureCard key={c.name} cluster={c} fnsByFile={digest.functions} search={search} />
              ))}
              {hiddenFeatures.length > 0 ? (
                <Collapse open={showMoreFeat}>
                  {hiddenFeatures.map((c) => (
                    <FeatureCard key={c.name} cluster={c} fnsByFile={digest.functions} search={search} />
                  ))}
                </Collapse>
              ) : null}
              {hiddenFeatures.length > 0 ? (
                <button type="button" onClick={() => setShowMoreFeat((v) => !v)} className="w-full rounded border border-border/30 py-1 text-[10.5px] text-muted-foreground hover:bg-muted/40">
                  {showMoreFeat ? "收起" : `还有 ${hiddenFeatures.length} 个功能`}
                </button>
              ) : null}
              {/* 其他(孤立函数,折叠在最后) */}
              {otherCluster ? (
                <FeatureCard cluster={otherCluster} fnsByFile={digest.functions} search={search} />
              ) : null}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
