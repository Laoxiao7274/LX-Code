// @ts-nocheck
/**
 * web-access pi 扩展 —— LXCode 内置网页搜索 + 内容抓取。
 * vendor 自 pi-web-access(MIT),去掉 TUI/curator/activity,只留 web_search + fetch_content。
 * workflow 固定 none(不弹策展网页);curator 开关由设置页控制(第一期关=none)。
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { search, normalizeSearchProviderSelection } from "./gemini-search.js";
import { extractContent } from "./extract.js";
import { openBrowserInApp, closeBrowserInApp } from "./browser-bridge.js";
import { startCuratorServer, type CuratorServerHandle } from "./curator-server.js";
import { generateSummaryDraft, buildDeterministicSummary, type QueryResultData, type SummaryGenerationContext } from "./summary-review.js";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

/** 读 useCases.summary 配置的摘要模型 key(providerId/modelId)。未配置返回 null。 */
function getSummaryModelKey(): string | null {
  try {
    const dir = process.env.LXCODE_CONFIG_DIR || join(homedir(), ".lxcode");
    const path = join(dir, "desktop-settings.json");
    if (!existsSync(path)) return null;
    const parsed = JSON.parse(readFileSync(path, "utf-8")) as { settings?: { useCases?: { summary?: string } } };
    const v = parsed.settings?.useCases?.summary;
    return typeof v === "string" && v.includes("/") ? v : null;
  } catch {
    return null;
  }
}

/** 读 web-search.json 的 workflow(带缓存,简化:每次读文件)。 */
function readWorkflow(): "none" | "summary-review" | "auto-summary" {
  try {
    // 优先 PI_CODING_AGENT_DIR,兜底 ~/.lxcode(LXCode 固定 agentDir)
    const dir = process.env.PI_CODING_AGENT_DIR || join(homedir(), ".lxcode");
    const path = join(dir, "web-search.json");
    if (!existsSync(path)) return "none";
    const raw = JSON.parse(readFileSync(path, "utf-8"));
    return raw.workflow === "summary-review" ? "summary-review" : "none";
  } catch {
    return "none";
  }
}

/** 读 web-search.json 的 autoApprove(摘要自动确认,不等用户点)。 */
function readAutoApprove(): boolean {
  try {
    const dir = process.env.PI_CODING_AGENT_DIR || join(homedir(), ".lxcode");
    const path = join(dir, "web-search.json");
    if (!existsSync(path)) return false;
    const raw = JSON.parse(readFileSync(path, "utf-8"));
    return raw.autoApprove === true;
  } catch {
    return false;
  }
}

/** 读 web-search.json 的 openCuratorPage(是否开内置浏览器加载 curator 策展页)。 */
function readOpenCuratorPage(): boolean {
  try {
    const dir = process.env.PI_CODING_AGENT_DIR || join(homedir(), ".lxcode");
    const path = join(dir, "web-search.json");
    if (!existsSync(path)) return false;
    const raw = JSON.parse(readFileSync(path, "utf-8"));
    return raw.openCuratorPage === true;
  } catch {
    return false;
  }
}

function formatSearchSummary(results: { title: string; url: string }[], answer: string): string {
  if (!results || results.length === 0) {
    return answer ? `${answer}\n\n---\n\n**Sources:**\nNo sources returned.` : "No results found.";
  }
  let output = answer ? `${answer}\n\n---\n\n**Sources:**\n` : "";
  output += results.map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}`).join("\n\n");
  return output;
}

/** curator 模式:搜所有 query -> 起 curator server -> 开内置浏览器 -> 等用户提交 -> 返回选中结果 */
async function runCurator(
  queryList: string[],
  searchOpts: { provider: any; numResults?: number; recencyFilter?: any; domainFilter?: string[]; includeContent: boolean; extensionContext: any },
  signal: AbortSignal | undefined,
  ctx: any,
): Promise<{ content: { type: string; text: string }[]; details: any }> {
  // 1. 并行搜所有 query + 同时起 curator server(两者互不依赖,提速)
  const searchResults: Map<number, { query: string; answer: string; results: any[]; provider?: string; error?: string }> = new Map();
  let resolveSubmit: (payload: any) => void = () => {};
  let rejectCancel: (reason: string) => void = () => {};
  const submitPromise = new Promise<any>((resolve, reject) => { resolveSubmit = resolve; rejectCancel = reject; });

  // 并行搜索所有 query
  const searchTasks = queryList.map((query, i) =>
    search(query, searchOpts)
      .then((result) => { searchResults.set(i, { query, answer: result.answer || "", results: (result.results || []).map((r: any) => ({ ...r, domain: "" })), provider: result.provider }); })
      .catch((e) => { searchResults.set(i, { query, answer: "", results: [], error: e instanceof Error ? e.message : String(e) }); })
  );

  // 起 curator server(与搜索并行)
  let handle: CuratorServerHandle | null = null;
  try {
    handle = await startCuratorServer(
      {
        queries: queryList,
        sessionToken: randomUUID(),
        timeout: 120,
        availableProviders: { all: false, openai: false, brave: false, parallel: false, tinyfish: false, search1api: false, searchinfinity: false, querit: false, tavily: false, serpdive: false, kagi: false, ollama: false, searxng: false, perplexity: false, exa: true, gemini: false, anysearch: false, xai: false, brightdata: false, serpbase: false },
        defaultProvider: "exa",
        searchProvider: "auto",
        summaryModels: [],
        defaultSummaryModel: null,
        autoApprove: readAutoApprove(),
      },
      {
        onSubmit: (payload) => resolveSubmit(payload),
        onCancel: (reason) => rejectCancel(`Curator ${reason}`),
        onProviderChange: () => {},
        onAddSearch: async () => [],
        onAddSearchResults: () => {},
        onSummarize: async (selectedIndices: number[], summarizeSignal: AbortSignal, model?: string, feedback?: string) => {
          // 优先用「模型用途→搜索摘要」配置的模型,否则用当前会话模型
          const summaryModelKey = getSummaryModelKey();
          let summaryModel = ctx?.model;
          if (summaryModelKey && ctx?.modelRegistry) {
            const slash = summaryModelKey.indexOf("/");
            const providerId = summaryModelKey.slice(0, slash);
            const modelId = summaryModelKey.slice(slash + 1);
            const found = ctx.modelRegistry.find(providerId, modelId);
            if (found) summaryModel = found;
          }
          const summaryCtx: SummaryGenerationContext = { model: summaryModel, modelRegistry: ctx?.modelRegistry, cwd: ctx?.cwd, isProjectTrusted: () => ctx?.isProjectTrusted?.() ?? true };
          const selectedResults: QueryResultData[] = [];
          for (const qi of selectedIndices) {
            const data = searchResults.get(qi);
            if (data) selectedResults.push({ query: data.query, answer: data.answer, results: data.results, error: null, provider: data.provider });
          }
          if (selectedResults.length === 0) return { summary: "", meta: {} as any };
          try {
            return await generateSummaryDraft(selectedResults, summaryCtx, summarizeSignal, model, feedback);
          } catch (err) {
            const det = buildDeterministicSummary(selectedResults);
            return { summary: det.summary, meta: { ...det.meta, fallbackReason: "summary-model-error" } as any };
          }
        },
        onRewriteQuery: async (q: string) => q,
      },
    );
  } catch (e) {
    return { content: [{ type: "text", text: `Curator server failed: ${e instanceof Error ? e.message : String(e)}` }], details: { error: String(e) } };
  }

  // 等所有搜索完成
  await Promise.all(searchTasks);
  if (signal?.aborted) { handle.close(); return { content: [{ type: "text", text: "Aborted" }], details: { aborted: true } }; }

  // 3. 推送搜索结果到 curator
  for (const [qi, data] of searchResults) {
    if (data.error) {
      handle.pushError(qi, data.error, data.provider, { query: data.query });
    } else {
      handle.pushResult(qi, { answer: data.answer, results: data.results, provider: data.provider || "exa", query: data.query });
    }
  }
  handle.searchesDone();

  // 4. 开内置浏览器加载 curator URL
  openBrowserInApp(ctx, handle.url);

  // 5. 等用户提交/取消/超时,带 abort signal
  let result: any;
  try {
    const abortPromise = signal
      ? new Promise<never>((_, reject) => { signal.addEventListener("abort", () => reject("Aborted"), { once: true }); })
      : new Promise<never>(() => {});
    result = await Promise.race([submitPromise, abortPromise]);
  } catch (e) {
    handle.close();
    closeBrowserInApp(ctx);
    return { content: [{ type: "text", text: `Curator cancelled: ${e instanceof Error ? e.message : String(e)}` }], details: { cancelled: true } };
  }
  handle.close();
  closeBrowserInApp(ctx);

  // 6. 构造返回:用户选中的结果
  const selected = result?.selectedQueryIndices?.length > 0 ? result.selectedQueryIndices : [...searchResults.keys()];
  let output = result?.summary?.trim() ? result.summary.trim() + "\n\n" : "";
  for (const qi of selected) {
    const data = searchResults.get(qi);
    if (!data) continue;
    if (queryList.length > 1) output += `## Query: "${data.query}"\n\n`;
    output += formatSearchSummary(data.results, data.answer) + "\n\n";
  }
  return { content: [{ type: "text", text: output.trim() }], details: { curated: true, queries: selected.length } };
}

export default function createWebAccessExtension(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "web_search",
    label: "网页搜索",
    description:
      "Search the web and return an AI-synthesized answer with source citations. Zero-config via Exa (no API key), or configure providers (OpenAI/Brave/Tavily/Kagi/Exa/Perplexity/Gemini/SearXNG) in LXCode settings. Use for web research; prefer queries (plural, 2-4 varied angles) for broader coverage.",
    promptSnippet: "Search the web for current information",
    promptGuidelines: [
      "Use web_search for web research or when you need current/real-time information",
      "Prefer queries (plural, 2-4 varied angles) over a single query for broader coverage",
      "Omit provider to use configured/auto-selected provider (Exa works with no key)",
      "Returns an AI-synthesized answer with source citations",
    ],
    parameters: Type.Object({
      query: Type.Optional(Type.String({ description: "Single search query. For research, prefer 'queries'." })),
      queries: Type.Optional(Type.Array(Type.String(), { description: "Multiple queries, each gets its own synthesized answer. Vary phrasing/scope across 2-4 queries." })),
      numResults: Type.Optional(Type.Number({ description: "Results per query (default: 5, max: 20)" })),
      recencyFilter: Type.Optional(Type.Union([Type.Literal("day"), Type.Literal("week"), Type.Literal("month"), Type.Literal("year")], { description: "Filter by recency" })),
      domainFilter: Type.Optional(Type.Array(Type.String(), { description: "Limit to domains (prefix with - to exclude)" })),
      provider: Type.Optional(Type.String({ description: "Search provider or 'auto' (default). Omit to use configured/auto." })),
      includeContent: Type.Optional(Type.Boolean({ description: "Fetch full page content from sources in background" })),
    }),
    async execute(_callId, params, signal, _onUpdate, ctx) {
      const queryList: string[] = Array.isArray(params.queries)
        ? params.queries.map((q: any) => typeof q === "string" ? q.trim() : "").filter(Boolean)
        : (typeof params.query === "string" && params.query.trim() ? [params.query.trim()] : []);
      if (queryList.length === 0) {
        return { content: [{ type: "text", text: "Error: 'query' or 'queries' is required." }], details: { error: "Missing query" } };
      }
      const provider = normalizeSearchProviderSelection(params.provider);
      const recencyFilter = (["day", "week", "month", "year"].includes(params.recencyFilter) ? params.recencyFilter : undefined) as any;
      const curate = readWorkflow() === "summary-review";
      const openPage = readOpenCuratorPage();
      // curator 完整流程:curate 开 + openCuratorPage 开 → 起 server + 开浏览器 + 等 approve
      if (curate && openPage) {
        return await runCurator(queryList, { provider, numResults: typeof params.numResults === "number" ? params.numResults : undefined, recencyFilter, domainFilter: Array.isArray(params.domainFilter) ? params.domainFilter : undefined, includeContent: Boolean(params.includeContent), extensionContext: ctx }, signal, ctx);
      }
      // curate 开但 openCuratorPage 关 → 应用内策展:搜完直接返回原始结果列表(不起 server,不开浏览器,不等 approve)
      // !curate → AI 合成带 answer
      const wantAnswer = !curate;
      let output = "";
      for (let i = 0; i < queryList.length; i++) {
        const query = queryList[i];
        if (queryList.length > 1) output += `## Query: "${query}"\n\n`;
        try {
          const result = await search(query, {
            provider,
            numResults: typeof params.numResults === "number" ? params.numResults : undefined,
            recencyFilter,
            domainFilter: Array.isArray(params.domainFilter) ? params.domainFilter : undefined,
            includeContent: Boolean(params.includeContent),
            extensionContext: ctx,
          });
          output += formatSearchSummary(result.results, wantAnswer ? result.answer : "") + "\n\n";
        } catch (e) {
          output += `Error: ${e instanceof Error ? e.message : String(e)}\n\n`;
        }
        if (signal?.aborted) return { content: [{ type: "text", text: "Aborted" }], details: { aborted: true } };
      }
      return { content: [{ type: "text", text: output.trim() }], details: { queries: queryList.length, provider } };
    },
  });

  pi.registerTool({
    name: "fetch_content",
    label: "抓取网页",
    description:
      "Fetch URL(s) as readable markdown, exact HTTP body, or page-grounded answer. Auto-detects GitHub repos, YouTube videos, PDFs, local videos, images, and web pages. Use for reading web pages, extracting content, or analyzing videos.",
    promptSnippet: "Fetch and read web page content",
    promptGuidelines: [
      "Use fetch_content to read web pages, extract article text, or analyze YouTube/local videos",
      "mode 'readable' (default) = clean markdown; 'raw' = exact HTTP body; 'answer' = grounded answer from content",
      "Auto-handles GitHub repos (clones), YouTube (transcript), PDFs, images, videos",
    ],
    parameters: Type.Object({
      url: Type.Optional(Type.String({ description: "Single URL or local file path" })),
      urls: Type.Optional(Type.Array(Type.String(), { description: "Multiple URLs" })),
      mode: Type.Optional(Type.Union([Type.Literal("readable"), Type.Literal("raw"), Type.Literal("answer")], { description: "readable (default), raw, answer" })),
      prompt: Type.Optional(Type.String({ description: "Question for video analysis, or page-local question for mode 'answer'" })),
    }),
    async execute(_callId, params, signal, _onUpdate, _ctx) {
      const urls: string[] = Array.isArray(params.urls)
        ? params.urls.map((u: any) => typeof u === "string" ? u.trim() : "").filter(Boolean)
        : (typeof params.url === "string" && params.url.trim() ? [params.url.trim()] : []);
      if (urls.length === 0) {
        return { content: [{ type: "text", text: "Error: 'url' or 'urls' is required." }], details: { error: "Missing url" } };
      }
      let output = "";
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        if (urls.length > 1) output += `## ${url}\n\n`;
        try {
          const content = await extractContent(url, signal, {
            mode: (params.mode as any) ?? "readable",
            prompt: typeof params.prompt === "string" ? params.prompt : undefined,
          });
          if (content.error) {
            output += `Error: ${content.error}\n\n`;
          } else {
            output += (content.title ? `**${content.title}**\n\n` : "") + (content.content || "(no content)") + "\n\n";
          }
        } catch (e) {
          output += `Error: ${e instanceof Error ? e.message : String(e)}\n\n`;
        }
        if (signal?.aborted) return { content: [{ type: "text", text: "Aborted" }], details: { aborted: true } };
      }
      return { content: [{ type: "text", text: output.trim() }], details: { urls: urls.length } };
    },
  });

  // open_browser 工具:在 LXCode 内置浏览器打开 URL(AI 可自主调用打开网页查看)
  pi.registerTool({
    name: "open_browser",
    label: "打开浏览器",
    description:
      "Open a URL in LXCode's built-in browser. Use to view web pages, documentation, dashboards, or any http(s) URL visually inside the app. The browser opens in the right dock. Returns the opened URL.",
    promptSnippet: "Open a URL in the built-in browser",
    promptGuidelines: [
      "Use open_browser to open a web page in LXCode's built-in browser for visual inspection",
      "Pass any http(s) URL — docs, dashboards, localhost dev servers, etc.",
      "The page renders in the app's right dock browser panel",
    ],
    parameters: Type.Object({
      url: Type.String({ description: "The http(s) URL to open in the built-in browser" }),
    }),
    async execute(_callId, params, _signal, _onUpdate, ctx) {
      const url = String(params.url ?? "").trim();
      if (!url || !/^https?:\/\//i.test(url)) {
        return { content: [{ type: "text", text: "Error: a valid http(s) url is required." }], details: { error: "Invalid url" } };
      }
      const ok = openBrowserInApp(ctx, url);
      return {
        content: [{ type: "text", text: ok ? `Opened ${url} in the built-in browser.` : `Failed to open browser (no UI context). URL: ${url}` }],
        details: { url, opened: ok },
      };
    },
  });
}
