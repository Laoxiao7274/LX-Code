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
// 协议类型:用 pi 的 KnownApi 值。openai-completions 最通用(覆盖 OpenAI/DeepSeek/Kimi/Qwen/ZAI/ollama),
// anthropic-messages 用于 Claude 系,openai-responses 用于 OpenAI 新版 Responses API。
export type ApiProtocol = "openai-completions" | "anthropic-messages" | "openai-responses" | (string & {});

/** LXCode 内部用的 provider 结构(数组形式,前端方便增删改)。 */
export interface ProviderData {
  id: string;
  name: string;
  /** 协议:openai-completions | anthropic-messages | openai-responses | 自定义。 */
  api: ApiProtocol;
  baseUrl: string;
  apiKey: string;
  /** 自定义请求头(数组形式,前端编辑用)。 */
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


/** pi 格式的 provider(对象 map,key=providerId)。 */
export interface PiProviderConfig {
  name?: string;
  baseUrl?: string;
  apiKey?: string;
  api?: ApiProtocol;
  headers?: Record<string, string>;
  models?: {
    id: string;
    name?: string;
    reasoning?: boolean;
    input?: ("text" | "image")[];
    contextWindow?: number;
    maxTokens?: number;
  }[];
}
export interface PiModelsConfig {
  defaultModel: string;
  thinkingLevel: string;
  providers: Record<string, PiProviderConfig>;
}

/** LXCode 数组形式 → pi 对象 map 形式(写文件)。 */
export function toPiFormat(cfg: ModelsConfig): PiModelsConfig {
  const providers: Record<string, PiProviderConfig> = {};
  for (const p of cfg.providers) {
    providers[p.id] = {
      name: p.name,
      baseUrl: p.baseUrl || undefined,
      apiKey: p.apiKey || undefined,
      api: p.api,
      headers: p.headers.length ? Object.fromEntries(p.headers.map((h) => [h.key, h.value])) : undefined,
      models: p.models.map((m) => ({
        id: m.id,
        name: m.name,
        reasoning: m.reasoning || undefined,
        input: ["text", ...(m.vision ? ["image" as const] : [])],
        contextWindow: m.contextWindow || undefined,
        maxTokens: m.maxTokens || undefined,
      })),
    };
  }
  return { defaultModel: cfg.defaultModel, thinkingLevel: cfg.thinkingLevel, providers };
}

/** pi 对象 map 形式 → LXCode 数组形式(读文件)。 */
export function fromPiFormat(cfg: PiModelsConfig): ModelsConfig {
  const providers: ProviderData[] = Object.entries(cfg.providers ?? {}).map(([id, p]) => ({
    id,
    name: p.name ?? id,
    api: p.api ?? "openai-completions",
    baseUrl: p.baseUrl ?? "",
    apiKey: p.apiKey ?? "",
    headers: p.headers ? Object.entries(p.headers).map(([key, value]) => ({ key, value })) : [],
    models: (p.models ?? []).map((m) => ({
      id: m.id,
      name: m.name ?? m.id,
      reasoning: m.reasoning ?? false,
      vision: m.input?.includes("image") ?? false,
      contextWindow: m.contextWindow ?? 128000,
      maxTokens: m.maxTokens ?? 8192,
      enabled: true,
    })),
  }));
  return { defaultModel: cfg.defaultModel ?? "", thinkingLevel: cfg.thinkingLevel ?? "medium", providers };
}

export async function readModels(): Promise<ModelsConfig> {
  const pi = await readJson<PiModelsConfig>(path.join(dataDir(), "models.json"), {
    defaultModel: "",
    thinkingLevel: "medium",
    providers: {},
  });
  return fromPiFormat(pi);
}

/** 直接读 pi 格式(供 agent-service 用)。 */
export async function readModelsPi(): Promise<PiModelsConfig> {
  return readJson<PiModelsConfig>(path.join(dataDir(), "models.json"), {
    defaultModel: "",
    thinkingLevel: "medium",
    providers: {},
  });
}

export async function writeModels(cfg: ModelsConfig): Promise<void> {
  await writeJson(path.join(dataDir(), "models.json"), toPiFormat(cfg));
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

// ─── 归档的会话 id 列表(持久化归档状态) ────────────
export async function readArchived(): Promise<string[]> {
  return readJson<string[]>(path.join(dataDir(), "archived.json"), []);
}

export async function writeArchived(ids: string[]): Promise<void> {
  await writeJson(path.join(dataDir(), "archived.json"), ids);
}
