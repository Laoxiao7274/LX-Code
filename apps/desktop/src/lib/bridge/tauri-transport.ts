import type { HostTransport } from "./host-client";

/**
 * 归一化 workspace 路径用于比较:小写 + 正斜杠 + 去掉 \\?\ verbatim 前缀。
 * Rust 侧 workspace_tag = canonicalize_path(stripped),前端 activeWorkspace 可能来自
 * settings 原始路径或 Rust 返回的 canonical,两者形式可能不同(C:\ vs C:/、大小写),
 * 归一化后才能稳定匹配。
 */
function normalizeWorkspace(ws: string): string {
  let s = ws;
  if (s.startsWith("\\\\?\\")) s = s.slice(4);
  if (s.startsWith("\\\\?\\UNC\\")) s = "\\\\" + s.slice(8);
  return s.replace(/\\\\/g, "/").toLowerCase();
}

/**
 * Tauri IPC transport. Falls back to a mock for browser-only Vite dev
 * when Tauri APIs are unavailable.
 */
export async function createTauriTransport(): Promise<HostTransport> {
  const { invoke, isTauri } = await import("@tauri-apps/api/core");
  if (!isTauri()) return createMockTransport();

  const { listen } = await import("@tauri-apps/api/event");
  // Pool 多路复用:host 输出带 workspace 标记 {workspace, line}。
  // 关键:只把 active workspace 的行喂给 hostClient,其余 host(预热/切走的)的事件丢弃。
  // 否则预热 host 的 host.ready 会顶替 active host 的 hostInstanceId → hello 不匹配。
  const handlers = new Set<(line: string) => void>();
  let activeWorkspace: string | null = null;

  const unlistenStdout = await listen<string>("pi-host-stdout", (event) => {
    let payload = event.payload;
    let lineWorkspace: string | null = null;
    try {
      const parsed = JSON.parse(payload);
      if (parsed && typeof parsed === "object" && "line" in parsed && "workspace" in parsed) {
        lineWorkspace = typeof parsed.workspace === "string" ? parsed.workspace : null;
        payload = parsed.line;
      }
    } catch {
      /* 非 JSON(如 fatal 合成),原样透传 */
    }
    // active 未设(启动初期)时全部放行(只有一个 host,不会冲突);
// 一旦设了 active,只放行匹配的 host,过滤掉预热/切走 host 的事件。
    if (
      lineWorkspace !== null &&
      activeWorkspace !== null &&
      normalizeWorkspace(lineWorkspace) !== normalizeWorkspace(activeWorkspace)
    ) {
      return;
    }
    for (const h of handlers) h(payload);
  });

  const unlistenStderr = await listen<string>("pi-host-stderr", (event) => {
    console.debug("[pi-host]", event.payload);
  });

  return {
    send: async (line: string, workspace?: string) => {
      await invoke("pi_host_send", { line, workspace: workspace ?? null });
    },
    setActiveWorkspace: (ws) => {
      activeWorkspace = ws;
    },
    onMessage: (handler) => {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    dispose: () => {
      handlers.clear();
      unlistenStdout();
      unlistenStderr();
    },
  };
}

const BROWSER_MOCK_HOST_ID = "00000000-0000-4000-8000-000000000004";

function createMockTransport(): HostTransport {
  const handlers = new Set<(line: string) => void>();
  return {
    send: async (line: string) => {
      try {
        const req = JSON.parse(line);
        if (req.method === "system.hello") {
          const response = {
            protocolVersion: 1,
            hostInstanceId: BROWSER_MOCK_HOST_ID,
            workspaceId: null,
            workspaceRevision: 0,
            sessionId: null,
            sessionRevision: 0,
            packageRevision: 0,
            id: req.id,
            method: "system.hello",
            ok: true,
            result: {
              protocolVersion: 1,
              hostInstanceId: BROWSER_MOCK_HOST_ID,
              workspaceId: null,
              workspaceRevision: 0,
              sessionId: null,
              sessionRevision: 0,
              packageRevision: 0,
              sdkVersion: "0.82.1",
              nodeVersion: "browser",
              agentDir: "(mock)",
              phase: "waitingForWorkspace",
              capabilities: {
                packageUpdateCheck: false,
                extensionUi: true,
                sessionExport: false,
              },
              modelConfigHealth: { state: "ok", source: "ModelRegistry.getError" },
            },
          };
          queueMicrotask(() => {
            for (const h of handlers) h(JSON.stringify(response));
          });
        }
      } catch {
        /* ignore */
      }
    },
    onMessage: (handler) => {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
  };
}
