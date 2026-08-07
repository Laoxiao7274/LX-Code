/**
 * LXCode 风格工具条:复刻 LXCode 原版 ChatToolbar 的视觉与交互。
 * 模型下拉(分组式) + 分隔条 + 思考等级下拉 + 上下文用量(横条+hover详情)。
 * 数据接 Skitre 的 appStore(session.model/thinkingLevel/contextUsage),操作调 host。
 */
import { Check, ChevronDown, Brain, Activity } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { ModelSummary } from "@lxcode/protocol";
import { useAppStore } from "../../lib/stores/app-store";
import { hostClient } from "../../lib/bridge/host-client";
import { activeSessionContext } from "../../lib/bridge/host-context";
import { requestWithRetry } from "../../lib/bridge/request-retry";
import { formatTokenCount } from "../../lib/format-token-count";
import { useT } from "../../lib/i18n/use-t";

/** 下拉/浮窗进场动画:fade + 轻微上滑+缩放。 */
function Panel({ children, className }: { children: ReactNode; className: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    if (!ref.current) return;
    gsap.fromTo(ref.current, { opacity: 0, y: 4, scale: 0.98 }, { opacity: 1, y: 0, scale: 1, duration: 0.16, ease: "power2.out" });
  }, []);
  return <div ref={ref} className={className}>{children}</div>;
}

/** 按 provider 分组的模型下拉,复刻 LXCode ModelSelect 视觉。 */
function LxModelSelect() {
  const t = useT();
  const host = useAppStore((s) => s.host);
  const workspace = useAppStore((s) => s.workspace);
  const session = useAppStore((s) => s.session);
  const setSession = useAppStore((s) => s.setSession);
  const setThinkingLevels = useAppStore((s) => s.setThinkingLevels);
  const pushNotification = useAppStore((s) => s.pushNotification);
  const connecting = useAppStore((s) => s.connecting);
  const rehydrating = useAppStore((s) => s.rehydrating);
  const desynchronized = useAppStore((s) => s.desynchronized);
  const providerConfigRevision = useAppStore((s) => s.providerConfigRevision);
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<ModelSummary[]>([]);
  const listRequest = useRef(0);

  const hostInstanceId = host?.hostInstanceId;
  const workspaceId = workspace?.id;
  const workspaceRevision = workspace?.revision;
  const sessionId = session?.sessionId;
  const sessionRevision = session?.revision;

  const curLabel = session?.model ? session.model.name || session.model.modelId : (models.length ? models[0].name || models[0].modelId : "未选择模型");

  // 按原版 ModelControls 逻辑:host/workspace/session 就绪且不在 connecting/rehydrating/desynchronized 时拉模型列表(带重试)。
  useEffect(() => {
    const current = useAppStore.getState();
    const requestHost = current.host;
    const requestWorkspace = current.workspace;
    const requestSession = current.session;
    const canRequest =
      !!requestHost && !!requestWorkspace && !!requestSession &&
      requestHost.hostInstanceId === hostInstanceId &&
      requestWorkspace.id === workspaceId &&
      requestWorkspace.revision === workspaceRevision &&
      requestSession.sessionId === sessionId &&
      requestSession.revision === sessionRevision &&
      !connecting && !rehydrating && !desynchronized;
    if (!canRequest) {
      listRequest.current += 1;
      return;
    }
    let cancelled = false;
    const request = ++listRequest.current;
    const expectedHostId = requestHost.hostInstanceId;
    const expectedWorkspaceId = requestWorkspace.id;
    const expectedWorkspaceRevision = requestWorkspace.revision;
    const expectedSessionId = requestSession.sessionId;
    const expectedSessionRevision = requestSession.revision;
    const isCurrentRequest = () => {
      const c = useAppStore.getState();
      return (
        !cancelled &&
        request === listRequest.current &&
        c.host?.hostInstanceId === expectedHostId &&
        c.workspace?.id === expectedWorkspaceId &&
        c.workspace?.revision === expectedWorkspaceRevision &&
        c.session?.sessionId === expectedSessionId &&
        c.session?.revision === expectedSessionRevision
      );
    };
    void (async () => {
      let res;
      try {
        res = await requestWithRetry(
          () => hostClient.request(
            "model.list",
            activeSessionContext(requestHost, requestWorkspace, requestSession),
            null,
          ),
          undefined,
          isCurrentRequest,
        );
      } catch {
        return;
      }
      if (!res || !isCurrentRequest()) return;
      if (res.ok) {
        setModels(res.result.models);
        setThinkingLevels(res.result.thinkingLevels);
        if (res.result.current) {
          const latestSession = useAppStore.getState().session;
          const selected = latestSession?.model;
          if (
            latestSession &&
            (selected?.provider !== res.result.current.provider ||
              selected.modelId !== res.result.current.modelId)
          ) {
            useAppStore.getState().applySessionSnapshot({ ...latestSession, model: res.result.current });
          }
        }
      }
    })();
    return () => { cancelled = true; };
  }, [hostInstanceId, workspaceId, workspaceRevision, sessionId, sessionRevision, providerConfigRevision, connecting, rehydrating, desynchronized, setThinkingLevels]);

  async function choose(provider: string, modelId: string) {
    const cur = useAppStore.getState();
    const h = cur.host;
    const ws = cur.workspace;
    const sess = cur.session;
    if (!h || !ws || !sess) return;
    const res = await hostClient.request(
      "model.setCurrent",
      activeSessionContext(h, ws, sess),
      { provider, modelId },
    );
    if (res.ok) {
      setSession(res.result.session);
      setThinkingLevels(res.result.thinkingLevels);
    } else {
      pushNotification(res.error?.message ?? "切换模型失败", "error");
    }
    setOpen(false);
  }

  // 按 provider 分组;确保当前模型在列表里(即使 model.list 返回空也显示当前模型)
  const visibleModels = models.length > 0
    ? models
    : session?.model
      ? [session.model]
      : [];
  const byProvider = new Map<string, ModelSummary[]>();
  for (const m of visibleModels) {
    const arr = byProvider.get(m.provider) ?? [];
    arr.push(m);
    byProvider.set(m.provider, arr);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-5 items-center gap-1 px-1.5 text-[10px] text-muted/70 transition-colors hover:bg-surface-overlay/40 hover:text-foreground"
      >
        <span className="signal-dot scale-[0.7]" aria-hidden />
        <span className="max-w-[120px] truncate font-medium text-foreground">{curLabel}</span>
        <ChevronDown className={`h-3 w-3 text-muted/60 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <Panel className="absolute bottom-full left-0 z-20 mb-1 max-h-72 w-60 overflow-y-auto rounded-lg border border-border/60 bg-popover p-1 shadow-lg">
            {byProvider.size === 0 ? (
              <div className="px-2 py-1.5 text-[10px] text-muted">{"无可用模型"}</div>
            ) : (
              [...byProvider.entries()].map(([provider, list]) => (
                <div key={provider}>
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted/60">
                    {provider}
                  </div>
                  {list.map((m) => {
                    const active = session?.model?.provider === m.provider && session?.model?.modelId === m.modelId;
                    return (
                      <button
                        key={m.modelId}
                        type="button"
                        onClick={() => choose(m.provider, m.modelId)}
                        className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[12px] hover:bg-surface-overlay/60"
                      >
                        <span className="truncate">{m.name || m.modelId}</span>
                        {active ? <Check className="h-3.5 w-3.5 shrink-0 text-accent" /> : null}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </Panel>
        </>
      ) : null}
    </div>
  );
}

/** 思考等级下拉,复刻 LXCode ThinkingLevelSelect 视觉与中文标签。 */
const THINKING_LABELS: Record<string, string> = {
  off: "关闭",
  low: "低",
  medium: "中",
  high: "高",
  xhigh: "极高",
  max: "最大",
};
function thinkingLabel(level: string): string {
  return THINKING_LABELS[level] ?? level;
}

function LxThinkingSelect() {
  const t = useT();
  const host = useAppStore((s) => s.host);
  const workspace = useAppStore((s) => s.workspace);
  const session = useAppStore((s) => s.session);
  const setSession = useAppStore((s) => s.setSession);
  const thinkingLevels = useAppStore((s) => s.thinkingLevels);
  const pushNotification = useAppStore((s) => s.pushNotification);
  const [open, setOpen] = useState(false);

  // 菜单档位优先用 host 报告的 thinkingLevels(模型实际支持的),没有则回退到全档位。
  // 过滤 minimal(参考旧版 LXCode)。不支持思考的模型 thinkingLevels 只有 off/空。
  // 注意:全局 thinkingLevels 在 session.model 未绑定时会是全档(误导),
  // 所以判断模型是否支持思考优先看 session.model.thinkingLevels(模型真实能力)。
  const fullLevels = ["off", "low", "medium", "high", "xhigh", "max"];
  const modelLevels = session?.model?.thinkingLevels;
  const supported = modelLevels && modelLevels.length > 0 ? modelLevels : (thinkingLevels.length > 0 ? thinkingLevels : fullLevels);
  const levels = supported.filter((level) => level !== "minimal");
  const cur = session?.thinkingLevel ?? "medium";
  const curLabel = thinkingLabel(cur);
  // 模型是否支持思考:优先用 session.model.reasoning(模型真实能力,可靠)。
  // fallback:session.model.reasoning 缺失时用 thinkingLevels/modelLevels 含非 off 档位判断。
  // 注意:全局 thinkingLevels 在 session.model 未绑定时会是全档(不可靠),故 reasoning 优先。
  const modelReasoning = session?.model?.reasoning;
  const modelSupportsThinking = modelReasoning !== undefined
    ? modelReasoning
    : (modelLevels
        ? modelLevels.some((l) => l !== "off")
        : thinkingLevels.length > 0 && thinkingLevels.some((l) => l !== "off"));

  async function choose(level: string) {
    if (!host || !workspace || !session) return;
    const res = await hostClient.request(
      "model.setThinkingLevel",
      activeSessionContext(host, workspace, session),
      { level },
    );
    if (res.ok) {
      setSession(res.result);
      // 结果导向判断:若 host 返回的实际 thinkingLevel 与用户选的不一致,
      // 说明被 SDK clamp 了(模型不支持该档位),弹提示告知用户。
      const actual = res.result?.thinkingLevel;
      if (actual !== undefined && actual !== level) {
        pushNotification(t("modelThinkingClamped", { level, actual }), "error");
      }
    } else {
      pushNotification(res.error?.message ?? t("modelThinkingSetFailed"), "error");
    }
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-5 items-center gap-1 px-1.5 text-[10px] text-muted/70 transition-colors hover:bg-surface-overlay/40 hover:text-foreground"
      >
        <Brain className="h-3 w-3" />
        <span>思考</span>
        <span className="font-medium text-foreground">{curLabel}</span>
        <ChevronDown className={`h-3 w-3 text-muted/60 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <Panel className="absolute bottom-full left-0 z-20 mb-1 w-36 rounded-lg border border-border/60 bg-popover p-1 shadow-lg">
            {levels.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => choose(level)}
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[12px] hover:bg-surface-overlay/60"
              >
                <span>{thinkingLabel(level)}</span>
                {level === cur ? <Check className="h-3.5 w-3.5 shrink-0 text-accent" /> : null}
              </button>
            ))}
          </Panel>
        </>
      ) : null}
    </div>
  );
}

/** 上下文用量:横条进度 + hover 详情浮层,复刻 LXCode ContextUsage 视觉。 */
function LxContextUsage() {
  const t = useT();
  const session = useAppStore((s) => s.session);
  const [hover, setHover] = useState(false);
  const usage = session?.contextUsage;
  const total = usage?.contextWindow ?? 128000;
  const used = usage?.tokens ?? 0;
  const pct = total > 0 && used != null ? Math.min(100, Math.round((used / total) * 100)) : 0;

  if (!usage || usage.tokens == null) {
    return (
      <div className="flex h-6 items-center gap-1.5 px-2 text-[11px] text-muted/50">
        <Activity className="h-3 w-3" />
        <span className="font-mono tabular-nums">—</span>
      </div>
    );
  }
  return (
    <div
      className="relative flex h-6 items-center gap-1.5 px-2 text-[11px] text-muted"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <Activity className="h-3 w-3" />
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-surface-overlay">
        <div
          className={`h-full rounded-full transition-all ${pct > 80 ? "bg-destructive" : pct > 50 ? "bg-amber-500" : "bg-accent"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono tabular-nums">{pct}%</span>
      {hover ? (
        <Panel className="absolute bottom-full right-0 mb-1 z-50 w-44 rounded-lg border border-border/60 bg-popover p-2.5 text-[11px] shadow-lg">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted/70">上下文用量</div>
          <div className="space-y-1">
            <div className="flex justify-between"><span className="text-muted">当前上下文</span><span className="font-mono tabular-nums text-foreground">{formatTokenCount(used)}</span></div>
            <div className="flex justify-between"><span className="text-muted">模型窗口</span><span className="font-mono tabular-nums text-foreground">{formatTokenCount(total)}</span></div>
            <div className="flex justify-between border-t border-border/40 pt-1"><span className="text-muted">已用</span><span className="font-mono tabular-nums text-accent">{pct}%</span></div>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}

/** LXCode 风格工具条:模型 + 分隔条 + 思考 + flex-1 + 上下文。 */
export function LxToolbar() {
  return (
    <div className="mt-2.5 flex items-center gap-1 px-1">
      <LxModelSelect />
      <span className="h-3 w-px bg-border/40" />
      <LxThinkingSelect />
      <div className="flex-1" />
      <LxContextUsage />
    </div>
  );
}
