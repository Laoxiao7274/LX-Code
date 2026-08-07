export type DesktopSmallFile =
  | {
      kind: "image";
      name: string;
      sizeBytes: number;
      mediaType: string;
      data: string;
    }
  | {
      kind: "text";
      name: string;
      sizeBytes: number;
      text: string;
    };

export async function isDesktopRuntime(): Promise<boolean> {
  const { isTauri } = await import("@tauri-apps/api/core");
  return isTauri();
}

export async function pickDesktopAttachmentPaths(): Promise<string[] | null> {
  if (!(await isDesktopRuntime())) return null;
  const { open } = await import("@tauri-apps/plugin-dialog");
  const selected = await open({
    multiple: true,
    directory: false,
    filters: [
      {
        name: "Documents and images",
        extensions: [
          "pdf",
          "docx",
          "png",
          "jpg",
          "jpeg",
          "gif",
          "webp",
          "txt",
          "md",
          "mdx",
          "json",
          "jsonl",
          "yaml",
          "yml",
          "toml",
          "csv",
          "tsv",
          "xml",
          "html",
          "css",
          "js",
          "jsx",
          "ts",
          "tsx",
          "py",
          "rs",
          "go",
          "java",
          "kt",
          "swift",
          "c",
          "h",
          "cpp",
          "hpp",
          "sh",
          "sql",
          "log",
        ],
      },
    ],
  });
  if (!selected) return [];
  return Array.isArray(selected) ? selected : [selected];
}

export async function readDesktopSmallFile(path: string): Promise<DesktopSmallFile> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<DesktopSmallFile>("desktop_read_small_file", { path });
}

/** 把 base64 图片写入临时目录,返回绝对路径。用于粘贴图片转本地文件路径,配合 vision_analyze 工具。 */
export async function writeTempImage(data: string, mediaType: string): Promise<string> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string>("desktop_write_temp_image", { data, mediaType });
}

export function isDocumentPath(path: string): boolean {
  return /\.(?:pdf|docx)$/iu.test(path.trim());
}

/** web-search.json 配置(pi-web-access 原生格式)。各字段可选。 */
export type WebSearchConfig = {
  exaApiKey?: string;
  openaiApiKey?: string;
  openaiResponsesUrl?: string;
  braveApiKey?: string;
  tavilyApiKey?: string;
  kagiApiKey?: string;
  perplexityApiKey?: string;
  geminiApiKey?: string;
  tinyfishApiKey?: string;
  search1apiApiKey?: string;
  queritApiKey?: string;
  searxngBaseUrl?: string;
  provider?: string;
  workflow?: "none" | "summary-review" | "auto-summary";
  allowBrowserCookies?: boolean;
  /** 是否弹出 curator 搜索网页(在内置浏览器开策展页)。默认 false。 */
  openCuratorPage?: boolean;
  /** curator 自动 approve 摘要(不等用户点确认)。默认 false(人工审核)。 */
  autoApprove?: boolean;
  searchModel?: string;
};

/** 读 web-search.json(存 ~/.lxcode/,pi-web-access 用)。文件不存在返回空对象。 */
export async function readWebSearchConfig(): Promise<WebSearchConfig> {
  const { invoke, isTauri } = await import("@tauri-apps/api/core");
  if (!isTauri()) return {};
  const raw = await invoke<string>("web_search_config_get");
  try {
    return JSON.parse(raw) as WebSearchConfig;
  } catch {
    return {};
  }
}

/** 局部更新 web-search.json(merge patch,值为 null 删除字段)。 */
export async function patchWebSearchConfig(patch: Partial<WebSearchConfig>): Promise<WebSearchConfig> {
  const { invoke, isTauri } = await import("@tauri-apps/api/core");
  if (!isTauri()) return {};
  const raw = await invoke<string>("web_search_config_patch", { patch: JSON.stringify(patch) });
  try {
    return JSON.parse(raw) as WebSearchConfig;
  } catch {
    return {};
  }
}
