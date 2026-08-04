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
}
