import { useRef, useState } from "react";
import { Upload, Plus, Trash2, Rocket, FileCheck, X } from "lucide-react";
import { useToast } from "../../../components/Toast";
import { Markdown } from "../../../components/Markdown";
import { apiClient, type ChannelManifests, type VersionInfo } from "../../../api";

export function VersionsPanel({
  versions,
  manifests,
  onChange,
}: {
  versions: VersionInfo[];
  manifests: ChannelManifests | null;
  onChange: () => Promise<void>;
}) {
  const { show } = useToast();
  const [showNew, setShowNew] = useState(false);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{versions.length} 个版本</p>
        <button
          onClick={() => setShowNew((v) => !v)}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          新建版本
        </button>
      </div>

      {showNew && (
        <NewVersionForm
          onDone={async () => {
            setShowNew(false);
            await onChange();
          }}
        />
      )}

      {versions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 py-16 text-center text-slate-400">
          还没有版本,点击右上角「新建版本」发布第一个
        </div>
      ) : (
        <div className="space-y-4">
          {versions.map((v) => (
            <VersionCard
              key={v.version}
              v={v}
              isLatest={!!manifests && ((v.channel === "beta" && !!manifests.beta.version && `v${manifests.beta.version}` === v.version) || (v.channel !== "beta" && !!manifests.stable.version && `v${manifests.stable.version}` === v.version))}
              onPublish={async () => {
                try {
                  await apiClient.publish(v.version.replace(/^v/, ""));
                  show(`已发布 ${v.version} 为最新`);
                  await onChange();
                } catch (e) {
                  show((e as Error).message, "err");
                }
              }}
              onDelete={async () => {
                if (!confirm(`删除 ${v.version}?此操作不可恢复`)) return;
                try {
                  await apiClient.deleteVersion(v.version.replace(/^v/, ""));
                  await onChange();
                  show(`已删除 ${v.version}`);
                } catch (e) {
                  show((e as Error).message, "err");
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NewVersionForm({ onDone }: { onDone: () => Promise<void> }) {
  const { show } = useToast();
  const [version, setVersion] = useState("");
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [channel, setChannel] = useState<"stable" | "beta">("stable");
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const dropRef = useRef<HTMLDivElement>(null);

  const addFiles = (list: FileList | File[]) => setFiles((p) => [...p, ...Array.from(list)]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d+\.\d+\.\d+$/.test(version)) return show("版本号格式应为 x.y.z", "err");
    if (!files.some((f) => /setup\.exe$/i.test(f.name)) || !files.some((f) => /\.sig$/i.test(f.name)))
      return show("需要 setup.exe 和 .sig 文件", "err");
    setUploading(true);
    try {
      await apiClient.createVersion({ version, label, notes, channel });
      for (let i = 0; i < files.length; i++) {
        setProgress(Math.round((i / files.length) * 100));
        await apiClient.uploadFile(version, files[i].name, files[i]);
      }
      setProgress(100);
      show(`v${version} 创建成功`);
      await onDone();
    } catch (e) {
      show((e as Error).message, "err");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="版本号">
          <input
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="0.2.1"
            pattern="\d+\.\d+\.\d+"
            className={inputCls}
          />
        </Field>
        <Field label="标签(可选)">
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="内测 / 稳定" className={inputCls} />
        </Field>
        <Field label="频道">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setChannel("stable")}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm transition ${channel === "stable" ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}
            >稳定版</button>
            <button
              type="button"
              onClick={() => setChannel("beta")}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm transition ${channel === "beta" ? "border-amber-400 bg-amber-50 text-amber-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}
            >测试版</button>
          </div>
        </Field>
      </div>
      <div className="mt-4">
        <Field label="更新日志(Markdown)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={"## 新功能\n- xxx\n\n## 修复\n- yyy"}
            className="min-h-[120px] w-full resize-y rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs leading-relaxed outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </Field>
      </div>
      <div className="mt-4">
        <Field label="上传文件">
          <div
            ref={dropRef}
            onClick={() => {
              const inp = document.createElement("input");
              inp.type = "file";
              inp.multiple = true;
              inp.onchange = () => addFiles(inp.files!);
              inp.click();
            }}
            onDragOver={(e) => {
              e.preventDefault();
              dropRef.current?.classList.add("border-brand-400", "bg-brand-50");
            }}
            onDragLeave={() => dropRef.current?.classList.remove("border-brand-400", "bg-brand-50")}
            onDrop={(e) => {
              e.preventDefault();
              addFiles(e.dataTransfer.files);
              dropRef.current?.classList.remove("border-brand-400", "bg-brand-50");
            }}
            className="cursor-pointer rounded-xl border-2 border-dashed border-slate-200 p-6 text-center text-sm text-slate-400 transition hover:border-brand-300 hover:bg-brand-50/50"
          >
            <Upload className="mx-auto mb-2 h-6 w-6 text-slate-300" />
            点击或拖入文件(NSIS setup.exe + 对应 .sig)
            {files.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {files.map((f, i) => (
                  <div key={f.name + i} className="flex items-center justify-between rounded-md bg-slate-100 px-3 py-1.5 font-mono text-xs" onClick={(e) => e.stopPropagation()}>
                    <span className="truncate text-slate-600">
                      {f.name} <span className="text-slate-400">({(f.size / 1024 / 1024).toFixed(1)}MB)</span>
                    </span>
                    <button type="button" onClick={() => setFiles((p) => p.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Field>
      </div>
      {uploading && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full bg-brand-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onDone} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-600 transition hover:bg-slate-50">
          取消
        </button>
        <button type="submit" disabled={uploading} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-50">
          <Plus className="h-4 w-4" />
          {uploading ? `上传中 ${progress}%` : "创建并上传"}
        </button>
      </div>
    </form>
  );
}

function VersionCard({ v, isLatest, onPublish, onDelete }: { v: VersionInfo; isLatest: boolean; onPublish: () => void; onDelete: () => void }) {
  return (
    <div className={`rounded-2xl border bg-white p-5 shadow-sm transition ${isLatest ? "border-brand-300 ring-1 ring-brand-200" : "border-slate-200"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="font-mono text-base font-semibold text-slate-900">{v.version}</span>
          {isLatest && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
              <FileCheck className="h-3 w-3" />最新
            </span>
          )}
          <span className={`rounded px-2 py-0.5 text-xs ${v.channel === "beta" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{v.channel === "beta" ? "测试版" : "稳定版"}</span>
          {v.label && <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{v.label}</span>}
          <span className="text-xs text-slate-400">{new Date(v.createdAt).toISOString().slice(0, 19).replace("T", " ")}</span>
        </div>
        <div className="flex gap-2">
          {!isLatest && (
            <button onClick={onPublish} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition hover:border-brand-300 hover:text-brand-700">
              <Rocket className="h-3.5 w-3.5" />设为最新
            </button>
          )}
          <button onClick={onDelete} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 transition hover:bg-red-50">
            <Trash2 className="h-3.5 w-3.5" />删除
          </button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {v.files.map((f) => (
          <a key={f} href={`/releases/${encodeURIComponent(v.version)}/${encodeURIComponent(f)}`} target="_blank" className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-xs text-slate-600 transition hover:border-brand-300 hover:text-brand-700">
            {f}
          </a>
        ))}
      </div>
      {v.notes && (
        <div className="mt-4 border-l-2 border-slate-100 pl-4">
          <Markdown content={v.notes} />
        </div>
      )}
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-slate-500">{label}</label>
      {children}
    </div>
  );
}
