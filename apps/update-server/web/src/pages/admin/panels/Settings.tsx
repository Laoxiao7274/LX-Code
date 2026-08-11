// 设置板块:服务器配置展示(只读,后续可加编辑)
// 当前配置来自环境变量,运行时不可改;这里展示让管理员确认部署状态
import { useEffect, useState } from "react";

export function SettingsPanel() {
  const [health, setHealth] = useState<{ ok: boolean; versions: number } | null>(null);
  useEffect(() => {
    fetch("/api/health").then((r) => r.json()).then(setHealth).catch(() => setHealth(null));
  }, []);

  const rows = [
    { label: "服务状态", value: health?.ok ? "运行中" : "未知", ok: health?.ok },
    { label: "已发布版本数", value: health?.versions ?? "—" },
    { label: "更新清单", value: "/latest.json" },
    { label: "产物目录", value: "/releases/<版本>/" },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">服务器</h2>
        <dl className="divide-y divide-slate-100">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between py-3">
              <dt className="text-sm text-slate-500">{r.label}</dt>
              <dd className={`flex items-center gap-2 text-sm font-medium ${r.ok ? "text-emerald-600" : "text-slate-900"}`}>
                {r.ok === true && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                {r.ok === false && <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />}
                {r.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="mb-2 text-sm font-semibold text-slate-900">配置说明</h2>
        <p className="text-sm leading-relaxed text-slate-500">
          服务器配置(PORT、PUBLISH_TOKEN、PUBLIC_BASE_URL、SITE_TITLE)通过环境变量注入,
          运行时不可修改。如需调整,修改部署环境的 <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">.env</code> 后重启服务。
        </p>
      </div>
    </div>
  );
}
