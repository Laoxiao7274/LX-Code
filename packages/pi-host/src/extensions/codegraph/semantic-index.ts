/**
 * CodeGraph 语义搜索 —— 用嵌入模型对候选符号重排,支持自然语言语义检索。
 *
 * 不预建全量索引(成本高),而是:
 *  - codegraph_semantic_search(query):
 *    1. cg.searchNodes(query) + getNodesByName(query) 拿候选(符号名匹配)
 *    2. 嵌入模型把 query + 候选文本向量化
 *    3. 余弦相似度排序,返回最相关的 top N
 *
 * 嵌入模型从 useCases.embed 读;未配置则降级返回符号名匹配结果(不阻断)。
 */
import type { ModelRegistry } from "@earendil-works/pi-coding-agent";
import { existsSync, readFileSync } from "node:fs";
import { getEmbedModelKey } from "./embed-config.js";
import { embedTexts, cosineSimilarity, type EmbedInput } from "./embed.js";

type CgNode = { id: string; name: string; filePath: string; startLine: number; endLine: number };

/** 拿嵌入模型的 EmbedInput(从 registry 解析 useCases.embed)。 */
async function resolveEmbedInput(registry: ModelRegistry): Promise<EmbedInput | null> {
  const key = getEmbedModelKey();
  if (!key) return null;
  const slash = key.indexOf("/");
  const providerId = key.slice(0, slash);
  const modelId = key.slice(slash + 1);
  const model = registry.find(providerId, modelId);
  if (!model) return null;
  const auth = await registry.getApiKeyAndHeaders(model);
  if (!auth.ok || !auth.apiKey) return null;
  return { model, apiKey: auth.apiKey, headers: auth.headers, env: auth.env };
}

/** 读符号源码片段(签名附近,限 200 字符)用于 embedding。 */
function readSymbolSnippet(filePath: string, startLine: number, endLine: number): string {
  try {
    if (!existsSync(filePath)) return "";
    const content = readFileSync(filePath, "utf8");
    const lines = content.split(/\r?\n/);
    const start = Math.max(0, (startLine ?? 1) - 1);
    const end = Math.min(lines.length, endLine ?? start + 8);
    return lines.slice(start, end).join("\n").slice(0, 200);
  } catch {
    return "";
  }
}

/** 构造符号的 embedding 文本:name + filePath + 源码片段。 */
function buildSymbolText(n: CgNode): string {
  return `${n.name}\n${n.filePath}\n${readSymbolSnippet(n.filePath, n.startLine, n.endLine)}`;
}

export type SemanticSearchResult = {
  ok: boolean;
  message: string;
  results: Array<{ name: string; filePath: string; startLine: number; score: number }>;
};

/**
 * 语义搜索:对候选符号用嵌入模型重排。
 * candidates 来自 codegraph 的 searchNodes/getNodesByName(符号名匹配),
 * 再用嵌入向量余弦相似度排序,让最语义相关的排前面。
 *
 * 未配置嵌入模型 → 降级返回候选原顺序(不阻断,但无语义排序)。
 */
export async function semanticSearch(
  query: string,
  candidates: CgNode[],
  registry: ModelRegistry,
  topN = 8,
  signal?: AbortSignal,
): Promise<SemanticSearchResult> {
  if (candidates.length === 0) {
    return { ok: false, message: "无候选符号(codegraph 符号名匹配无结果)。", results: [] };
  }
  const embedInput = await resolveEmbedInput(registry);
  if (!embedInput) {
    // 降级:无嵌入模型,返回候选原顺序(限 topN)
    return {
      ok: true,
      message: "未配置嵌入模型,按符号名匹配返回(去 设置→模型用途 配置「嵌入向量化」启用语义排序)。",
      results: candidates.slice(0, topN).map((n) => ({ name: n.name, filePath: n.filePath, startLine: n.startLine, score: 0 })),
    };
  }
  try {
    const texts = [query, ...candidates.map(buildSymbolText)];
    const vecs = await embedTexts(texts, embedInput, signal);
    const queryVec = vecs[0] ?? [];
    if (queryVec.length === 0) {
      return { ok: false, message: "查询向量化失败。", results: [] };
    }
    const scored = candidates
      .map((n, i) => ({ node: n, score: cosineSimilarity(queryVec, vecs[i + 1] ?? []) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topN);
    return {
      ok: true,
      message: `语义搜索 "${query}" → ${scored.length} 个匹配(嵌入模型重排)`,
      results: scored.map((s) => ({ name: s.node.name, filePath: s.node.filePath, startLine: s.node.startLine, score: Number(s.score.toFixed(3)) })),
    };
  } catch (e) {
    // embedding 失败降级
    return {
      ok: true,
      message: `嵌入模型调用失败(${e instanceof Error ? e.message : e}),按符号名匹配返回。`,
      results: candidates.slice(0, topN).map((n) => ({ name: n.name, filePath: n.filePath, startLine: n.startLine, score: 0 })),
    };
  }
}
