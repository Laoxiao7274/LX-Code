import { useRef, useState, useEffect } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { useDigestStore } from "../../stores/digest-store";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { ScrollArea } from "../ui/scroll-area";
import { cn } from "../../lib/utils";
import {
  X, RefreshCw, Map, ChevronRight, ChevronDown, FileCode2,
  CornerDownRight, AlertTriangle, FileWarning,
} from "lucide-react";

gsap.registerPlugin(useGSAP);

/** level 对应的 badge 样式。 */
const LEVEL_STYLE: Record<string, string> = {
  core: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  util: "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  ui: "border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-400",
  glue: "border-muted-foreground/30 bg-muted/40 text-muted-foreground",
};

/** 单个函数卡片(折叠:一句话;展开:how/logic/pitfalls/calls)。 */
function FunctionCard({ fn }: { fn: import("../../types").FunctionSummary }) {
  const [open, setOpen] = useState(false);
  const hasDetail = (fn.how.length > 0) || (fn.logic?.length ?? 0) > 0 || (fn.pitfalls?.length ?? 0) || fn.calls;
  return (
    <div className="rounded-md border border-border/40 bg-background/40">
      <button
        type="button"
        onClick={() => hasDetail && setOpen((v) => !v)}
        className={cn(
          "flex w-full items-start gap-2 px-3 py-2 text-left",
          hasDetail && "hover:bg-muted/30",
        )}
      >
        {hasDetail ? (
          open ? <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
               : <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : <span className="mt-1.5 h-3.5 w-3.5 shrink-0" />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[12px] font-medium">{fn.fn}</span>
            <Badge variant="outline" className={cn("px-1.5 py-0 text-[10px] font-medium", LEVEL_STYLE[fn.level])}>
              {fn.level}
            </Badge>
            {fn.entry ? <Badge variant="outline" className="px-1.5 py-0 text-[10px] text-accent border-accent/30">entry</Badge> : null}
            <span className="ml-auto shrink-0 font-mono text-[11px] text-muted-foreground">L{fn.startLine}-{fn.endLine}</span>
          </div>
          <div className="mt-1 text-[12px] text-muted-foreground">
            {fn.what || <span className="italic opacity-60">(白话待生成)</span>}
          </div>
        </div>
      </button>
      {open && hasDetail ? (
        <div className="space-y-2 border-t border-border/40 px-3 py-2.5 text-[12px]">
          {fn.how.length > 0 ? (
            <div>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">怎么写的</div>
              <ol className="space-y-1">
                {fn.how.map((h, i) => (
                  <li key={i} className="flex gap-1.5 text-foreground/90">
                    <span className="text-muted-foreground/50">{i + 1}.</span>
                    <span>{h}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
          {fn.logic?.length ? (
            <div>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">关键逻辑</div>
              <ul className="space-y-1">
                {fn.logic.map((l, i) => (
                  <li key={i} className="flex gap-1.5 text-foreground/90">
                    <CornerDownRight className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground/50" />
                    <span>{l}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {fn.pitfalls?.length ? (
            <div className="rounded border border-amber-500/30 bg-amber-500/5 p-2">
              <div className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                <FileWarning className="h-3 w-3" /> 踩过的坑
              </div>
              <ul className="space-y-1">
                {fn.pitfalls.map((p, i) => (
                  <li key={i} className="flex gap-1.5 text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {fn.calls ? (
            <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground">
              <span>调用: {fn.calls.calls.length ? fn.calls.calls.join(", ") : "—"}</span>
              <span>被调: {fn.calls.calledBy.length ? fn.calls.calledBy.join(", ") : "—"}</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** 单个文件的函数组(折叠)。 */
function FileGroup({ file, fns }: { file: string; fns: import("../../types").FunctionSummary[] }) {
  const [open, setOpen] = useState(false);
  const coreCount = fns.filter((f) => f.level === "core").length;
  return (
    <div className="rounded-md border border-border/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/30"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        <FileCode2 className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="truncate font-mono text-[12px]">{file}</span>
        <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
          {fns.length} 函数{coreCount > 0 ? ` · ${coreCount} 核心` : ""}
        </span>
      </button>
      {open ? (
        <div className="space-y-1.5 border-t border-border/40 p-2">
          {fns.map((f) => <FunctionCard key={f.fn} fn={f} />)}
        </div>
      ) : null}
    </div>
  );
}

/** digest 面板:覆盖层,三层折叠(模块表 → 文件 → 函数详情)。 */
export function DigestPanel() {
  const open = useDigestStore((s) => s.open);
  const digest = useDigestStore((s) => s.digest);
  const loading = useDigestStore((s) => s.loading);
  const error = useDigestStore((s) => s.error);
  const cwd = useDigestStore((s) => s.cwd);
  const closePanel = useDigestStore((s) => s.closePanel);
  const refresh = useDigestStore((s) => s.refresh);

  const rootRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(open);

  useEffect(() => { if (open) setMounted(true); }, [open]);

  useGSAP(
    () => {
      if (!open || !rootRef.current) return;
      gsap.fromTo(rootRef.current, { opacity: 0 }, { opacity: 1, duration: 0.28, ease: "power2.out", overwrite: true });
      const card = rootRef.current.querySelector(".dp-card");
      if (card) gsap.fromTo(card, { opacity: 0, scale: 0.96, y: 16 }, { opacity: 1, scale: 1, y: 0, duration: 0.3, ease: "power3.out", overwrite: true });
    },
    { scope: rootRef, dependencies: [open] },
  );

  useEffect(() => {
    if (open || !rootRef.current) return;
    const card = rootRef.current.querySelector(".dp-card");
    if (card) gsap.to(card, { opacity: 0, scale: 0.96, y: -16, duration: 0.22, ease: "power2.in", overwrite: true });
    gsap.to(rootRef.current, { opacity: 0, duration: 0.22, ease: "power2.in", overwrite: true, onComplete: () => setMounted(false) });
  }, [open]);

  if (!mounted) return null;

  const fnCount = digest ? Object.values(digest.functions).reduce((n, fns) => n + fns.length, 0) : 0;

  return (
    <div ref={rootRef} className="dp-overlay absolute inset-0 z-40 flex items-center justify-center rounded-xl bg-background/80 backdrop-blur-sm" onClick={closePanel}>
      <div
        className="dp-card surface flex h-[88%] w-[86%] max-w-4xl max-h-[760px] min-w-[680px] overflow-hidden rounded-lg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 主区 */}
        <main className="flex flex-1 flex-col overflow-hidden">
          {/* 顶栏 */}
          <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border/60 px-4">
            <Map className="h-4 w-4 text-accent" />
            <h2 className="text-[15px] font-semibold tracking-tight">项目功能地图</h2>
            {digest ? (
              <span className="text-[12px] text-muted-foreground">
                {digest.modules.length} 模块 · {fnCount} 函数
              </span>
            ) : null}
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-[12px]"
                onClick={() => void refresh()}
                disabled={loading || !cwd}
              >
                <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
                刷新
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={closePanel}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* 内容 */}
          <ScrollArea className="flex-1">
            <div className="px-5 py-4">
              {loading && !digest ? (
                <div className="py-20 text-center text-[13px] text-muted-foreground">
                  <RefreshCw className="mx-auto mb-3 h-6 w-6 animate-spin opacity-50" />
                  正在生成项目地图…
                </div>
              ) : error && !digest ? (
                <div className="py-16 text-center">
                  <Map className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
                  <div className="text-[13px] text-muted-foreground">{error}</div>
                  <Button variant="outline" size="sm" className="mt-3 h-8" onClick={() => void refresh()}>
                    生成地图
                  </Button>
                </div>
              ) : !digest ? (
                <div className="py-16 text-center">
                  <Map className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
                  <div className="text-[13px] text-muted-foreground">还没有项目地图</div>
                  <Button variant="outline" size="sm" className="mt-3 h-8" onClick={() => void refresh()}>
                    生成
                  </Button>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* ① 模块总览表 */}
                  <section>
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                      模块总览
                    </div>
                    <div className="overflow-hidden rounded-md border border-border/40">
                      <table className="w-full text-[12px]">
                        <thead className="bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground/70">
                          <tr>
                            <th className="px-3 py-1.5 text-left font-semibold">模块</th>
                            <th className="px-3 py-1.5 text-left font-semibold">功能(白话)</th>
                            <th className="px-3 py-1.5 text-right font-semibold">文件</th>
                          </tr>
                        </thead>
                        <tbody>
                          {digest.modules.map((m) => (
                            <tr key={m.name} className="border-t border-border/30">
                              <td className="px-3 py-2 font-mono font-medium align-top">{m.name}</td>
                              <td className="px-3 py-2 text-muted-foreground">
                                {m.what || <span className="italic opacity-60">(待生成)</span>}
                              </td>
                              <td className="px-3 py-2 text-right font-mono text-[11px] text-muted-foreground">{m.files.length}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  {/* ② 函数清单(按文件折叠) */}
                  <section>
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                      函数级摘要(点开文件查看)
                    </div>
                    <div className="space-y-1.5">
                      {Object.entries(digest.functions).map(([file, fns]) =>
                        fns.length > 0 ? <FileGroup key={file} file={file} fns={fns} /> : null,
                      )}
                    </div>
                  </section>
                </div>
              )}
            </div>
          </ScrollArea>
        </main>
      </div>
    </div>
  );
}
