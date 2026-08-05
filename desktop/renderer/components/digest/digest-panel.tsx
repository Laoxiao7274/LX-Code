import { useEffect } from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";
import { cn } from "../../lib/utils";
import { useDigestStore } from "../../stores/digest-store";
import type { FunctionSummary } from "../../types";
import {
  RefreshCw, Map, ChevronRight, ChevronDown, FileCode2,
  CornerDownRight, AlertTriangle, FileWarning,
} from "lucide-react";

/** level 对应的 badge 样式。 */
const LEVEL_STYLE: Record<string, string> = {
  core: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  util: "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  ui: "border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-400",
  glue: "border-muted-foreground/30 bg-muted/40 text-muted-foreground",
};

/** 单个函数卡片(折叠:一句话;展开:how/logic/pitfalls/calls)。 */
function FunctionCard({ fn }: { fn: FunctionSummary }) {
  const hasDetail = (fn.how.length > 0) || (fn.logic?.length ?? 0) > 0 || (fn.pitfalls?.length ?? 0) || fn.calls;
  return (
    <details className="group rounded-md border border-border/40 bg-background/40">
      <summary className={cn("flex w-full cursor-pointer list-none items-start gap-2 px-2.5 py-1.5 text-left", hasDetail && "hover:bg-muted/30")}>
        {hasDetail ? (
          <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground group-open:rotate-90 group-open:transition-transform" />
        ) : <span className="mt-1.5 h-3.5 w-3.5 shrink-0" />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-mono text-[11.5px] font-medium">{fn.fn}</span>
            <Badge variant="outline" className={cn("shrink-0 px-1 py-0 text-[9.5px] font-medium", LEVEL_STYLE[fn.level])}>
              {fn.level}
            </Badge>
            {fn.entry ? <Badge variant="outline" className="shrink-0 px-1 py-0 text-[9.5px] text-accent border-accent/30">entry</Badge> : null}
            <span className="ml-auto shrink-0 font-mono text-[10.5px] text-muted-foreground">L{fn.startLine}-{fn.endLine}</span>
          </div>
          <div className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
            {fn.what || <span className="italic opacity-60">(白话待生成)</span>}
          </div>
        </div>
      </summary>
      {hasDetail ? (
        <div className="space-y-2 border-t border-border/40 px-2.5 py-2 text-[11.5px]">
          {fn.how.length > 0 ? (
            <div>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">怎么写的</div>
              <ol className="space-y-0.5">
                {fn.how.map((h, i) => (
                  <li key={i} className="flex gap-1 text-foreground/90">
                    <span className="text-muted-foreground/50">{i + 1}.</span>
                    <span>{h}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
          {fn.logic?.length ? (
            <div>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">关键逻辑</div>
              <ul className="space-y-0.5">
                {fn.logic.map((l, i) => (
                  <li key={i} className="flex gap-1 text-foreground/90">
                    <CornerDownRight className="mt-0.5 h-2.5 w-2.5 shrink-0 text-muted-foreground/50" />
                    <span>{l}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {fn.pitfalls?.length ? (
            <div className="rounded border border-amber-500/30 bg-amber-500/5 p-1.5">
              <div className="mb-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                <FileWarning className="h-2.5 w-2.5" /> 踩过的坑
              </div>
              <ul className="space-y-0.5">
                {fn.pitfalls.map((p, i) => (
                  <li key={i} className="flex gap-1 text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="mt-0.5 h-2.5 w-2.5 shrink-0" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {fn.calls ? (
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[10.5px] text-muted-foreground">
              <span>调用: {fn.calls.calls.length ? fn.calls.calls.join(", ") : "—"}</span>
              <span>被调: {fn.calls.calledBy.length ? fn.calls.calledBy.join(", ") : "—"}</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </details>
  );
}

/** 单个文件的函数组(折叠)。 */
function FileGroup({ file, fns }: { file: string; fns: FunctionSummary[] }) {
  const coreCount = fns.filter((f) => f.level === "core").length;
  return (
    <details className="group rounded-md border border-border/40" open={coreCount > 0}>
      <summary className="flex w-full cursor-pointer list-none items-center gap-1.5 px-2.5 py-1.5 hover:bg-muted/30">
        <ChevronRight className="h-3 w-3 text-muted-foreground group-open:rotate-90 group-open:transition-transform" />
        <FileCode2 className="h-3 w-3 text-muted-foreground" />
        <span className="truncate font-mono text-[11.5px]">{file}</span>
        <span className="ml-auto shrink-0 text-[10.5px] text-muted-foreground">
          {fns.length}{coreCount > 0 ? ` · ${coreCount}核心` : ""}
        </span>
      </summary>
      <div className="space-y-1 border-t border-border/40 p-1.5">
        {fns.map((f) => <FunctionCard key={f.fn} fn={f} />)}
      </div>
    </details>
  );
}

/**
 * 项目功能地图内嵌视图(右栏 Tab 内容)。
 * 三层折叠:① 模块总览表 ② 文件折叠 ③ 函数详情。
 * 不含覆盖层壳,由右栏面板承载。首次进入自动加载当前项目。
 */
export function DigestView({ cwd }: { cwd: string }) {
  const digest = useDigestStore((s) => s.digest);
  const loading = useDigestStore((s) => s.loading);
  const error = useDigestStore((s) => s.error);
  const refresh = useDigestStore((s) => s.refresh);
  const reload = useDigestStore((s) => s.reload);
  const curCwd = useDigestStore((s) => s.cwd);

  // 切换项目时重新加载
  useEffect(() => {
    if (cwd && cwd !== curCwd) {
      useDigestStore.setState({ cwd });
      void reload();
    } else if (cwd && !digest && !loading) {
      void reload();
    }
  }, [cwd, curCwd, digest, loading, reload]);

  const fnCount = digest ? Object.values(digest.functions).reduce((n, fns) => n + fns.length, 0) : 0;

  return (
    <div className="flex h-full flex-col">
      {/* 顶栏:标题 + 刷新 */}
      <div className="flex h-7 shrink-0 items-center gap-1.5 border-b border-border/40 px-2.5">
        <span className="text-[11px] font-medium text-muted-foreground">
          {digest ? `${digest.modules.length} 模块 · ${fnCount} 函数` : "项目功能地图"}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto h-6 w-6 text-muted-foreground"
          onClick={() => void refresh()}
          disabled={loading}
          title="刷新地图"
        >
          <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-2.5 py-2">
          {loading && !digest ? (
            <div className="py-12 text-center text-[12px] text-muted-foreground">
              <RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin opacity-50" />
              正在生成项目地图…
            </div>
          ) : !digest ? (
            <div className="py-12 text-center">
              <Map className="mx-auto mb-2 h-7 w-7 text-muted-foreground/40" />
              <div className="mb-2 text-[12px] text-muted-foreground">
                {error ?? "还没有项目地图"}
              </div>
              <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => void refresh()}>
                生成地图
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* ① 模块总览表 */}
              <section>
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  模块总览
                </div>
                <div className="overflow-hidden rounded-md border border-border/40">
                  <table className="w-full text-[11.5px]">
                    <thead className="bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground/70">
                      <tr>
                        <th className="px-2 py-1 text-left font-semibold">模块</th>
                        <th className="px-2 py-1 text-left font-semibold">功能</th>
                        <th className="px-2 py-1 text-right font-semibold">文件</th>
                      </tr>
                    </thead>
                    <tbody>
                      {digest.modules.map((m) => (
                        <tr key={m.name} className="border-t border-border/30">
                          <td className="px-2 py-1.5 font-mono font-medium align-top">{m.name}</td>
                          <td className="px-2 py-1.5 text-muted-foreground">
                            {m.what || <span className="italic opacity-60">(待生成)</span>}
                          </td>
                          <td className="px-2 py-1.5 text-right font-mono text-[10.5px] text-muted-foreground">{m.files.length}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* ② 函数清单(按文件折叠) */}
              <section>
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  函数级摘要
                </div>
                <div className="space-y-1">
                  {Object.entries(digest.functions).map(([file, fns]) =>
                    fns.length > 0 ? <FileGroup key={file} file={file} fns={fns} /> : null,
                  )}
                </div>
              </section>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
