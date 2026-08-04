/**
 * 数据层 IPC:读写 LXCode 自己的数据(~/.lxcode/)。
 * 完全脱离 pi 原生,所有数据 LXCode 自管。
 */
import { ipcMain, dialog } from "electron";
import {
  ensureDataDir,
  readProjects,
  writeProjects,
  readModels,
  writeModels,
  readSettings,
  writeSettings,
  readUseCases,
  writeUseCases,
  type ProjectData,
  type ModelsConfig,
  type SettingsData,
  type UseCaseData,
} from "./data-store";
export function initDataIpc() {
  // 确保数据目录
  ensureDataDir().catch(console.error);

  // ─── 项目 ──────────────────────────────────────
  ipcMain.handle("data:listProjects", async () => {
    return { ok: true, projects: await readProjects() };
  });

  ipcMain.handle("data:saveProjects", async (_e, args: { projects: ProjectData[] }) => {
    await writeProjects(args.projects);
    return { ok: true };
  });

  // 打开项目(选目录)
  ipcMain.handle("data:openProject", async () => {
    const res = await dialog.showOpenDialog({ properties: ["openDirectory"] });
    if (res.canceled || !res.filePaths.length) return { ok: false };
    const p = res.filePaths[0];
    const name = p.split(/[\\/]/).filter(Boolean).pop() ?? p;
    return { ok: true, name, path: p };
  });

  // ─── 模型配置 ──────────────────────────────────
  ipcMain.handle("data:readModels", async () => {
    return { ok: true, config: await readModels() };
  });

  ipcMain.handle("data:writeModels", async (_e, args: { config: ModelsConfig }) => {
    await writeModels(args.config);
    return { ok: true };
  });

  // ─── 设置 ──────────────────────────────────────
  ipcMain.handle("data:readSettings", async () => {
    return { ok: true, settings: await readSettings() };
  });

  ipcMain.handle("data:writeSettings", async (_e, args: { settings: SettingsData }) => {
    await writeSettings(args.settings);
    return { ok: true };
  });

  // ─── 用途 ──────────────────────────────────────
  ipcMain.handle("data:readUseCases", async () => {
    return { ok: true, cases: await readUseCases() };
  });

  ipcMain.handle("data:writeUseCases", async (_e, args: { cases: UseCaseData[] }) => {
    await writeUseCases(args.cases);
    return { ok: true };
  });

  // ─── 自动获取模型列表(调 provider 的 /v1/models) ────
  ipcMain.handle("data:fetchModels", async (_e, args: { baseUrl: string; apiKey: string; api: string }) => {
    try {
      let url = args.baseUrl?.replace(/\/+$/, "") ?? "";
      // OpenAI 兼容:GET /v1/models 或 /models
      // Anthropic:GET /v1/models
      if (!/\/v1$/.test(url) && !/\/models/.test(url)) url = `${url}/v1`;
      const endpoint = `${url}/models`;
      const res = await fetch(endpoint, {
        method: "GET",
        headers: {
          ...(args.apiKey ? { Authorization: `Bearer ${args.apiKey}` } : {}),
          // Anthropic 需要 anthropic-version 头
          ...(args.api === "anthropic-messages" ? { "anthropic-version": "2023-06-01" } : {}),
        },
      });
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
      const json = (await res.json()) as { data?: { id: string; display_name?: string; name?: string }[]; models?: { id: string; display_name?: string; name?: string }[] };
      // OpenAI 兼容:json.data = [{id, ...}]
      // Anthropic:json.data = [{id, display_name, ...}]
      const list = (json.data ?? json.models ?? []) as { id: string; display_name?: string; name?: string }[];
      const models = list.map((m) => ({
        id: m.id,
        name: m.display_name ?? m.name ?? m.id,
      }));
      return { ok: true, models };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  });
}
