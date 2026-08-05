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
  readArchived,
  writeArchived,
  type ProjectData,
  type ModelsConfig,
  type SettingsData,
  type UseCaseData,
} from "./data-store";
import { getDigestConfig, setDigestConfig, getDigestLLM, getDigestDefaultModel } from "./agent-service";
import { buildDigest, writeDigest } from "./extensions/digest/build";
import path from "node:path";
import fs from "node:fs/promises";
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

  // 选择附件文件(图片/文档),返回路径+类型
  ipcMain.handle("data:selectFiles", async () => {
    const res = await dialog.showOpenDialog({
      properties: ["openFile", "multiSelections"],
      filters: [
        { name: "图片", extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"] },
        { name: "所有文件", extensions: ["*"] },
      ],
    });
    if (res.canceled || !res.filePaths.length) return { ok: false };
    const imgExt = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"];
    const files = res.filePaths.map((p) => {
      const ext = p.split(".").pop()?.toLowerCase() ?? "";
      const name = p.split(/[\\/]/).filter(Boolean).pop() ?? p;
      return { path: p, name, kind: imgExt.includes(ext) ? ("image" as const) : ("file" as const) };
    });
    return { ok: true, files };
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

  // 归档的会话 id 列表(持久化)
  ipcMain.handle("data:readArchived", async () => {
    return { ok: true, ids: await readArchived() };
  });

  ipcMain.handle("data:writeArchived", async (_e, args: { ids: string[] }) => {
    await writeArchived(args.ids);
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

  // ─── digest 项目功能地图 ─────────────────────
  // 读 digest.json(给前端渲染三层折叠)。cwd 为项目根目录。
  ipcMain.handle("data:getDigest", async (_e, args: { cwd: string }) => {
    try {
      const p = path.join(args.cwd, ".lxcode", "digest.json");
      const raw = await fs.readFile(p, "utf-8");
      return { ok: true, digest: JSON.parse(raw) };
    } catch {
      return { ok: false, error: "digest 未生成" };
    }
  });

  // 读 digest 运行配置(开关状态,给设置页显示)
  ipcMain.handle("data:getDigestConfig", async (_e, args: { cwd: string }) => {
    return { ok: true, config: await getDigestConfig(args.cwd) };
  });

  // 写 digest 配置(写文件 + emit 热插拔事件,运行时切换)
  ipcMain.handle("data:setDigestConfig", async (_e, args: { cwd: string; config: Partial<{ enabled: boolean; autoUpdate: boolean; injectContext: boolean }> }) => {
    await setDigestConfig(args.cwd, args.config);
    return { ok: true };
  });

  // 手动触发全量刷新 digest(调 buildDigest,无 LLM 填白话留空)
  // 手动触发全量刷新 digest(带 LLM 填白话+功能名,用配置的默认模型)
  ipcMain.handle("data:refreshDigest", async (_e, args: { cwd: string }) => {
    try {
      const llm = getDigestLLM();
      const model = await getDigestDefaultModel();
      const digest = await buildDigest(args.cwd, llm ?? undefined, model);
      digest.trigger = "onboarding";
      await writeDigest(args.cwd, digest);
      return { ok: true, modules: digest.modules.length, functions: Object.values(digest.functions).reduce((n, fns) => n + fns.length, 0) };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  });
}
