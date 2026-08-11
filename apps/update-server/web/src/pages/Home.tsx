import { useEffect, useState } from "react";
import { Download, ChevronRight, ShieldCheck, Clock } from "lucide-react";
import { Header } from "../components/Header";
import { Markdown } from "../components/Markdown";
import { apiClient, type Manifest, type VersionInfo } from "../api";

function fmtDate(ms: number) {
  return new Date(ms).toISOString().slice(0, 19).replace("T", " ");
}

function fileUrl(version: string, file: string) {
  return `/releases/${encodeURIComponent(version)}/${encodeURIComponent(file)}`;
}

export function HomePage() {
  const [versions, setVersions] = useState<VersionInfo[]>([]);
  const [manifests, setManifests] = useState<{ stable: Manifest | null; beta: Manifest | null }>({ stable: null, beta: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([apiClient.getVersions(), apiClient.getManifest(), apiClient.getBetaManifest()])
      .then(([v, s, b]) => {
        setVersions(v.versions);
        setManifests({ stable: s, beta: b });
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <Header
        right={
          <a
            href="/admin"
            className="text-sm text-slate-500 transition hover:text-slate-900"
          >
            管理后台
          </a>
        }
      />

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pt-16 pb-12">
        <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
          LXCode
        </h1>
        <p className="mt-3 text-lg text-slate-500">
          桌面端 AI 编码助手 · 自动更新与安装包分发
        </p>
        {manifests.stable?.version && (
          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-emerald-700">
              <ShieldCheck className="h-4 w-4" />
              稳定版 v{manifests.stable.version}
              {manifests.stable.pub_date && (
                <span className="text-emerald-400">· {manifests.stable.pub_date.slice(0, 10)}</span>
              )}
            </span>
            {manifests.beta?.version && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3.5 py-1.5 text-amber-700">
                测试版 v{manifests.beta.version}
                {manifests.beta.pub_date && (
                  <span className="text-amber-400">· {manifests.beta.pub_date.slice(0, 10)}</span>
                )}
              </span>
            )}
          </div>
        )}
      </section>

      {/* 版本列表 */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-slate-400">
          版本历史
        </h2>
        {loading ? (
          <div className="py-16 text-center text-slate-400">加载中…</div>
        ) : versions.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            还没有发布任何版本
          </div>
        ) : (
          <div className="space-y-4">
            {versions.map((v) => {
              const isLatest =
                (v.channel !== "beta" && manifests.stable?.version && `v${manifests.stable.version}` === v.version) ||
                (v.channel === "beta" && manifests.beta?.version && `v${manifests.beta.version}` === v.version);
              const setup = v.files.find((f) => /setup\.exe$/i.test(f));
              return (
                <article
                  key={v.version}
                  className={`rounded-2xl border bg-white p-6 transition hover:shadow-sm ${
                    isLatest ? (v.channel === "beta" ? "border-amber-300" : "border-emerald-300") : "border-slate-200"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-mono text-lg font-semibold text-slate-900">
                        {v.version}
                      </span>
                      {isLatest && (
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${v.channel === "beta" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                          最新
                        </span>
                      )}
                      <span className={`rounded px-2 py-0.5 text-xs ${v.channel === "beta" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{v.channel === "beta" ? "测试版" : "稳定版"}</span>
                      {v.label && (
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                          {v.label}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1.5 text-xs text-slate-400">
                        <Clock className="h-3.5 w-3.5" />
                        {fmtDate(v.createdAt)}
                      </span>
                      {setup && (
                        <a
                          href={fileUrl(v.version, setup)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand-700"
                        >
                          <Download className="h-4 w-4" />
                          下载
                        </a>
                      )}
                    </div>
                  </div>

                  {v.notes && (
                    <div className="mt-4 border-l-2 border-slate-100 pl-4">
                      <Markdown content={v.notes} />
                    </div>
                  )}

                  {/* 所有文件 */}
                  <details className="mt-4 group">
                    <summary className="flex cursor-pointer list-none items-center gap-1 text-xs text-slate-400 transition hover:text-slate-600">
                      <ChevronRight className="h-3.5 w-3.5 transition group-open:rotate-90" />
                      全部文件 ({v.files.length})
                    </summary>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {v.files.map((f) => (
                        <a
                          key={f}
                          href={fileUrl(v.version, f)}
                          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-xs text-slate-600 transition hover:border-brand-300 hover:text-brand-700"
                        >
                          {f}
                        </a>
                      ))}
                    </div>
                  </details>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-6 text-xs text-slate-400">
          更新清单 <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono">/latest.json</code>
          {" · "}
          客户端启动时自动检查更新,校验签名后静默安装
        </div>
      </footer>
    </div>
  );
}
