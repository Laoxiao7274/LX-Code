import type { HostTransport } from "./host-client";

/**
 * Tauri IPC transport. Falls back to a mock for browser-only Vite dev
 * when Tauri APIs are unavailable.
 */
export async function createTauriTransport(): Promise<HostTransport> {
  const { invoke, isTauri } = await import("@tauri-apps/api/core");
  if (!isTauri()) return createMockTransport();

  const { listen } = await import("@tauri-apps/api/event");
  // Pool 多路复用:host 输出带 workspace 标记 {workspace, line}。解包后按 workspace 分发。
  // 未带标记的(旧格式)按 active 处理。
  const handlers = new Set<(line: string) => void>();

  const unlistenStdout = await listen<string>("pi-host-stdout", (event) => {
    let payload = event.payload;
    try {
      const parsed = JSON.parse(payload);
      if (parsed && typeof parsed === "object" && "line" in parsed && "workspace" in parsed) {
        payload = parsed.line;
        // workspace 标记可用于后续按 host 路由响应,这里先透传 line(hostClient 按 id 匹配)。
      }
    } catch {
      /* 非 JSON(如 fatal 合成),原样透传 */
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
