/**
 * LXCode 数据层:所有数据独立存在 ~/.lxcode/,脱离 pi 原生 ~/.pi/agent/。
 *
 * 目录结构:
 * ~/.lxcode/
 *   ├── projects.json    项目列表
 *   ├── sessions/        会话(按项目分目录)
 *   ├── models.json       provider + 模型配置
 *   ├── auth.json         API key
 *   ├── settings.json     设置
 *   └── usecases.json     用途配置
 */
import { app } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";

/** LXCode 数据根目录。 */
export function dataDir(): string {
  const home = app.getPath("home");
  return path.join(home, ".lxcode");
}

/** 会话目录。 */
export function sessionsDir(): string {
  return path.join(dataDir(), "sessions");
}

/** 确保数据目录结构存在。 */
export async function ensureDataDir(): Promise<void> {
  const dirs = [dataDir(), sessionsDir()];
  for (const d of dirs) {
    if (!existsSync(d)) await fs.mkdir(d, { recursive: true });
  }
}

/** 读 JSON 文件(不存在返回默认值)。 */
async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    if (!existsSync(file)) return fallback;
    const txt = await fs.readFile(file, "utf-8");
    return JSON.parse(txt) as T;
  } catch {
    return fallback;
  }
}

/** 写 JSON 文件。 */
async function writeJson(file: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf-8");
}

// ─── 项目 ────────────────────────────────────────────

export interface ProjectData {
  id: string;
  name: string;
  path: string;
  createdAt: number;
  lastUsedAt: number;
}

export async function readProjects(): Promise<ProjectData[]> {
  return readJson<ProjectData[]>(path.join(dataDir(), "projects.json"), []);
}

export async function writeProjects(projects: ProjectData[]): Promise<void> {
  await writeJson(path.join(dataDir(), "projects.json"), projects);
}

// ─── 模型配置(provider + models,LXCode 自管) ──────────

export interface ProviderData {
  id: string;
  name: string;
  /** 协议类型:openai(兼容) | anthropic | custom。 */
  api: "openai" | "anthropic" | "custom";
  baseUrl: string;
  apiKey: string;
  /** 自定义请求头。 */
  headers: { key: string; value: string }[];
  models: {
    id: string;
    name: string;
    /** 是否支持思考/推理。 */
    reasoning: boolean;
    /** 是否多模态(图片输入)。 */
    vision: boolean;
    contextWindow: number;
    maxTokens: number;
    enabled: boolean;
  }[];
}

export interface ModelsConfig {
  /** 默认模型 "providerId/modelId"。 */
  defaultModel: string;
  /** 默认思考等级。 */
  thinkingLevel: string;
  providers: ProviderData[];
}

const DEFAULT_MODELS: ModelsConfig = {
  defaultModel: "",
  thinkingLevel: "medium",
  providers: [],
};

export async function readModels(): Promise<ModelsConfig> {
  return readJson<ModelsConfig>(path.join(dataDir(), "models.json"), DEFAULT_MODELS);
}

export async function writeModels(cfg: ModelsConfig): Promise<void> {
  await writeJson(path.join(dataDir(), "models.json"), cfg);
}

// ─── 设置 ────────────────────────────────────────────

export interface SettingsData {
  theme: "light" | "dark" | "system";
  density: "compact" | "standard" | "comfortable";
  autoSave: boolean;
  streaming: boolean;
  showStatusBar: boolean;
  animations: boolean;
}

const DEFAULT_SETTINGS: SettingsData = {
  theme: "system",
  density: "standard",
  autoSave: true,
  streaming: true,
  showStatusBar: true,
  animations: true,
};

export async function readSettings(): Promise<SettingsData> {
  return readJson<SettingsData>(path.join(dataDir(), "settings.json"), DEFAULT_SETTINGS);
}

export async function writeSettings(s: SettingsData): Promise<void> {
  await writeJson(path.join(dataDir(), "settings.json"), s);
}

// ─── 用途 ────────────────────────────────────────────

export interface UseCaseData {
  id: string;
  label: string;
  /** 该用途选定的模型 key,空=跟随默认。 */
  modelKey: string;
}

export async function readUseCases(): Promise<UseCaseData[]> {
  return readJson<UseCaseData[]>(path.join(dataDir(), "usecases.json"), []);
}

export async function writeUseCases(cases: UseCaseData[]): Promise<void> {
  await writeJson(path.join(dataDir(), "usecases.json"), cases);
}
