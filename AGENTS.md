# LXCode Agent Guide

用中文回复。LXCode 是基于 `@earendil-works/pi-coding-agent` 的 Electron 桌面 AI 编码助手（Electron + React + pi SDK）。

## 项目地图

- `electron/main.ts` — Electron 主进程入口，创建窗口、注册 IPC，加载 `desktop/main/index`。
- `desktop/main/` — 主进程业务层，被 electron 主进程加载：
  - `agent-service.ts` — **pi SDK 集成核心**。用 `createAgentSession` 管 agent 会话生命周期 + 事件流（`subscribe` → IPC 转发前端）。所有 pi 相关改动先看这里。
  - `data-store.ts` / `data-ipc.ts` — 数据存储（`~/.lxcode/`）与 IPC。
  - `index.ts` — 主进程对外的 `initAgentIpc` / `shutdownAgent`。
- `desktop/renderer/` — React 渲染进程（chat / settings / sidebar / components）。
- `desktop/preload/` — IPC 桥接。
- `src/` — Vite web 版页面与原型（`pages/prototypes/` 等）。
- `reference/` — 第三方参考项目（kimi-code / opencode / MiMo-Code），**只读，不要改**。
- `driver/` — pnpm workspace 占位（"pi 驱动进程"），**当前未启用**，架构已改为 SDK 内嵌模式。

## 核心架构原则

**新功能一律做成 pi 扩展（extension / pi 包），不要直接堆进 LXCode 宿主代码。**

LXCode 是 pi 的 SDK 宿主，能力来自 pi 扩展。新增任何「给 AI 用的能力」（生成摘要、注入上下文、暴露工具、监听事件、调用模型）都要落到 pi 扩展里，而不是在 `agent-service.ts` 或主进程里手写逻辑。

挂载方式：在 `agent-service.ts` 的 `getOrCreateSession` 里给 `DefaultResourceLoader` 传 `extensionFactories: [xxxFactory]`。当前用内联 factory，等能力成熟后抽成带 `pi` manifest 的独立 npm 包（`pi-package` 关键字）发布。**内联 factory 和包的 `index.ts` 同构**，所以现在写内联不会白做。

## 能力边界

| 该做 | 不该做 |
|------|--------|
| ✅ pi 扩展内：监听事件、`registerTool`、`before_agent_start` 改 systemPrompt、`complete()` 独立调 LLM | ❌ 在 LXCode 主进程里手写「监听 agent 事件做能力」逻辑 |
| ✅ pi 扩展产出文件（如 `digest.json` / `PROJECT_DIGEST.md`）当契约 | ❌ 用 pi 的 TUI custom UI（LXCode 是 React，UI 留 LXCode） |
| ✅ LXCode：UI 渲染、IPC、用户触发、数据存储、把 LXCode 特有数据喂给扩展 | ❌ 在扩展里直接渲染 React / 调 Electron API |

简单判定：**有 UI 或碰 Electron → 留 LXCode；给 AI 用的能力 → pi 扩展**。两边靠产物文件（如 `digest.json`）解耦。

## pi 集成硬约束（踩过的坑，务必遵守）

- **`agent_start` 事件不能和 `agent_end`/`agent_settled` 共用 case 块**。`agent_start` 一来就 `unsub()` 会取消订阅，后续事件全丢，表现为「回复空/一直思考」。`agent_start` 单独处理（只标记 streaming），`agent_end` 看 `willRetry`，`agent_settled` 才执行完整结束逻辑。
- **切历史会话必须传 `sessionPath`，用 `SessionManager.open()` 恢复**，不能 `SessionManager.create()`。`create` 会新建空 session，上下文从零开始、历史丢失。链路：前端 `send(sessionId, cwd, sessionPath)` → preload → IPC → `agent-service.prompt` → `getOrCreateSession(... sessionPath)`。
- **初始数据不要留 mock fallback**。`reloadFromPi` 读不到真实数据时直接 `set({ projects: [] })`，不要 return 保留假数据，否则侧栏一直显示假数据。
- **扩展工厂里不能起后台资源**（file watcher / timer / socket）。pi 文档明确禁止。需要「文件变化触发」就改用 `agent_settled` + git diff 增量。
- **`before_agent_start` 注入上下文**时，注意和 LXCode 现有 `appendSystemPrompt` 链式叠加，避免重复注入同一内容。项目地图这类统一交给扩展管，别再塞 `appendSystemPrompt`。

## 工作流约定

- 改 pi 相关代码前先读 `desktop/main/agent-service.ts` 现有实现和最近约束。
- pi 扩展的独立 LLM 调用用 `getModel` + `complete()`（参考 `examples/extensions/summarize.ts`），不要污染用户会话。model 默认可配置，优先复用当前 session model 降本。
- 扩展要通用化以便以后发布给别的 pi 宿主：宿主特有数据（如 LXCode 的 failure 记忆）通过扩展定义的注入点喂入，别的宿主不喂就留空，不要硬编码依赖 LXCode。
- pi 文档路径：`C:\Users\xzy\AppData\Roaming\npm\node_modules\@earendil-works\pi-coding-agent\docs\` 与 `examples/`。涉及扩展机制、SDK、包分发时先读对应 doc。
