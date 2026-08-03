import { useRef, useState } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { ChevronDown, Check, Code, FileText, Image, ListTodo, GitCommitHorizontal, ScanSearch, Boxes } from "lucide-react";
import { useUseCaseStore, allModels, type UseCase } from "../../stores/usecase-store";
import { useModelStore } from "../../stores/model-store";
import { cn } from "../../lib/utils";

gsap.registerPlugin(useGSAP);

/** 用途图标映射。 */
const ICONS: Record<string, typeof Code> = {
  code: Code,
  complete: Code,
  file: FileText,
  image: Image,
  plan: ListTodo,
  embed: Boxes,
  git: GitCommitHorizontal,
  review: ScanSearch,
};

/** 模型下拉选择。 */
function ModelSelect({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (open && menuRef.current) {
        gsap.fromTo(menuRef.current, { opacity: 0, y: -6, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.2, ease: "power2.out" });
      }
    },
    { dependencies: [open] },
  );
  const models = allModels();
  const defaultModel = useModelStore((s) => s.defaultModel);
  const current = value ? models.find((m) => m.key === value) : null;
  const label = current ? current.label : value === "" ? "跟随默认" : "未选择";

  if (disabled) {
    return (
      <span className="rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground">
        系统配置
      </span>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-7 items-center gap-1.5 rounded-md border border-border/60 bg-background px-2.5 text-[12px] transition-colors hover:bg-muted/40"
      >
        <span className="max-w-[140px] truncate">{label}</span>
        <ChevronDown className={cn("h-3 w-3 text-muted-foreground/60 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <>
          {/* 点外侧关闭 */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div ref={menuRef} className="absolute right-0 z-20 mt-1 max-h-64 w-56 overflow-y-auto rounded-lg border border-border/60 bg-popover p-1 shadow-lg">
            {/* 跟随默认 */}
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false); }}
              className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-[12px] hover:bg-muted/60"
            >
              <span className="text-muted-foreground">跟随默认</span>
              {value === "" ? <Check className="h-3.5 w-3.5 text-accent" /> : null}
            </button>
            <div className="my-1 h-px bg-border/60" />
            {/* 按提供商分组 */}
            {models.length === 0 ? (
              <div className="px-2.5 py-2 text-[11px] text-muted-foreground">无可用模型</div>
            ) : (
              models.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => { onChange(m.key); setOpen(false); }}
                  className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left hover:bg-muted/60"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[12px] font-medium">{m.label}</div>
                    <div className="truncate text-[10px] text-muted-foreground/70">{m.provider}</div>
                  </div>
                  {value === m.key ? <Check className="h-3.5 w-3.5 shrink-0 text-accent" /> : null}
                </button>
              ))
            )}
            <div className="mt-1 border-t border-border/60 px-2.5 py-1 text-[10px] text-muted-foreground/60">
              默认: {defaultModel.split("/")[1] ?? "—"}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

/** 单个用途行。 */
function UseCaseRow({ c }: { c: UseCase }) {
  const setModel = useUseCaseStore((s) => s.setModel);
  const Icon = ICONS[c.icon] ?? Code;
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium">{c.label}</div>
        <div className="truncate text-[11px] text-muted-foreground">{c.desc}</div>
      </div>
      <ModelSelect value={c.modelKey} onChange={(v) => setModel(c.id, v)} disabled={!c.selectable} />
    </div>
  );
}

/**
 * 用途配置面板:为不同功能场景指定专用模型。
 * 如文件读取用便宜模型,视觉用多模态模型,代码生成用强模型。
 */
export function UseCasePanel() {
  const cases = useUseCaseStore((s) => s.cases);
  const defaultModel = useModelStore((s) => s.defaultModel);
  const cur = defaultModel.split("/")[1] ?? "—";

  return (
    <div>
      <div className="mb-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5">
        <div className="flex items-center gap-1.5 text-[12px]">
          <span className="font-medium">默认模型:</span>
          <span className="font-mono text-muted-foreground">{cur}</span>
        </div>
        <div className="mt-0.5 text-[11px] text-muted-foreground/80">
          未单独指定的用途将使用默认模型
        </div>
      </div>

      <div className="divide-y divide-border/40 rounded-lg border border-border/60 bg-background/40">
        {cases.map((c) => (
          <UseCaseRow key={c.id} c={c} />
        ))}
      </div>
    </div>
  );
}
