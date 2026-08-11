import { useEffect, useState } from "react";
import { LogOut, Package, Settings, LayoutDashboard, ExternalLink } from "lucide-react";
import { LxMark } from "../../components/LxMark";
import { useToast } from "../../components/Toast";
import { apiClient, type ChannelManifests, type VersionInfo } from "../../api";
import { useAdminPath, Link, navigate } from "../../router";
import { VersionsPanel } from "./panels/Versions";
import { SettingsPanel } from "./panels/Settings";

export function AdminApp() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [versions, setVersions] = useState<VersionInfo[]>([]);
  const [manifests, setManifests] = useState<ChannelManifests | null>(null);
  const sub = useAdminPath("/admin") ?? "";
  const { show } = useToast();

  const refresh = async () => {
    const [v, m] = await Promise.all([apiClient.adminVersions(), apiClient.adminManifest()]);
    setVersions(v.versions);
    setManifests(m);
  };

  useEffect(() => {
    apiClient.checkAuth().then((r) => setAuthed(r.authed)).catch(() => setAuthed(false));
  }, []);

  useEffect(() => {
    if (authed) refresh().catch((e) => show(e.message, "err"));
  }, [authed]);

  if (authed === null) {
    return <div className="flex min-h-screen items-center justify-center text-slate-400">加载中…</div>;
  }

  if (!authed) return <Login onOk={() => setAuthed(true)} />;

  const nav: { key: string; label: string; icon: typeof Package; path: string }[] = [
    { key: "dashboard", label: "概览", icon: LayoutDashboard, path: "/admin" },
    { key: "versions", label: "版本管理", icon: Package, path: "/admin/versions" },
    { key: "settings", label: "设置", icon: Settings, path: "/admin/settings" },
  ];

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* 侧边栏 */}
      <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="flex h-14 items-center gap-2 border-b border-slate-200 px-5">
          <LxMark className="h-6 w-6" />
          <span className="font-semibold tracking-tight text-slate-900">LXCode</span>
        </div>
        <nav className="flex-1 space-y-0.5 p-3">
          {nav.map((n) => {
            const active = (n.path === "/admin" && sub === "") || (n.path !== "/admin" && sub === n.path.slice("/admin/".length));
            return (
              <Link
                key={n.key}
                to={n.path}
                onClick={() => navigate(n.path)}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                  active
                    ? "bg-brand-50 font-medium text-brand-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-slate-200 p-3">
          <Link
            to="/"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <ExternalLink className="h-4 w-4" />
            回到首页
          </Link>
          <button
            onClick={async () => {
              await apiClient.logout();
              setAuthed(false);
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <LogOut className="h-4 w-4" />
            登出
          </button>
        </div>
      </aside>

      {/* 主区 */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-slate-200 bg-white/80 px-8 backdrop-blur-md">
          <h1 className="text-sm font-medium text-slate-500">
            {sub === "" ? "概览" : sub === "versions" ? "版本管理" : "设置"}
          </h1>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-400">稳定版</span>
            <strong className="font-mono text-brand-600">{manifests?.stable.version ? `v${manifests.stable.version}` : "—"}</strong>
            <span className="text-slate-300">·</span>
            <span className="text-slate-400">测试版</span>
            <strong className="font-mono text-amber-600">{manifests?.beta.version ? `v${manifests.beta.version}` : "—"}</strong>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-8">
          {sub === "" && <Dashboard versions={versions} manifests={manifests} />}
          {sub === "versions" && (
            <VersionsPanel
              versions={versions}
              manifests={manifests}
              onChange={refresh}
            />
          )}
          {sub === "settings" && <SettingsPanel />}
        </main>
      </div>
    </div>
  );
}

function Login({ onOk }: { onOk: () => void }) {
  const [token, setToken] = useState("");
  const [err, setErr] = useState("");
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <form
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await apiClient.login(token.trim());
            onOk();
          } catch {
            setErr("token 错误");
          }
        }}
      >
        <div className="mb-6 flex items-center gap-2">
          <LxMark className="h-7 w-7" />
          <div>
            <h1 className="text-lg font-semibold text-slate-900">LXCode 管理后台</h1>
            <p className="text-xs text-slate-400">输入管理 token 登录</p>
          </div>
        </div>
        <input
          type="password"
          value={token}
          autoFocus
          onChange={(e) => setToken(e.target.value)}
          placeholder="PUBLISH_TOKEN"
          className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
        <button
          type="submit"
          className="mt-4 w-full rounded-lg bg-brand-600 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700"
        >
          登录
        </button>
        {err && <p className="mt-3 text-center text-sm text-red-600">{err}</p>}
      </form>
    </div>
  );
}

function Dashboard({ versions, manifests }: { versions: VersionInfo[]; manifests: ChannelManifests | null }) {
  const stableLatest = manifests?.stable.version;
  const betaLatest = manifests?.beta.version;
  const stats = [
    { label: "已发布版本", value: versions.length },
    { label: "稳定版最新", value: stableLatest ? `v${stableLatest}` : "—" },
    { label: "测试版最新", value: betaLatest ? `v${betaLatest}` : "—" },
  ];
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="text-xs font-medium text-slate-400">{s.label}</div>
            <div className="mt-1.5 text-2xl font-semibold text-slate-900">{s.value}</div>
          </div>
        ))}
      </div>
      {versions.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-medium text-slate-700">最近版本</h2>
          <div className="space-y-2">
            {versions.slice(0, 5).map((v) => (
              <div key={v.version} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                <span className="font-mono text-sm font-semibold text-slate-900">{v.version}</span>
                <span className={`rounded px-2 py-0.5 text-xs ${v.channel === "beta" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{v.channel === "beta" ? "测试版" : "稳定版"}</span>
                {v.label && <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{v.label}</span>}
                <span className="ml-auto text-xs text-slate-400">{new Date(v.createdAt).toLocaleDateString("zh-CN")}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
