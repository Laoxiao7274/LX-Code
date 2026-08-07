/**
 * 嵌入向量:调 useCases.embed 配置的模型把文本转向量。
 *
 * 用 modelRegistry.find 拿模型 + apiKey,POST /v1/embeddings(或 /embeddings)。
 * 返回 number[][] 向量。失败抛错。
 */
import type { Model, Api } from "@earendil-works/pi-ai";
import type { ModelRegistry } from "@earendil-works/pi-coding-agent";

export type EmbedInput = { model: Model<Api>; apiKey?: string; headers?: Record<string, string>; env?: Record<string, string> };

/** 构造 embeddings 端点 URL(兼容 baseUrl 含/不含 /v1)。 */
function embeddingsUrl(baseUrl: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  // 已含 /v1 或 /openai/v1 等:直接拼 /embeddings
  if (/\/v\d+$/i.test(base)) return `${base}/embeddings`;
  // 不含版本段:用 /v1/embeddings
  return `${base}/v1/embeddings`;
}

/**
 * 把一批文本转向量。批量发(多数 provider 支持数组 input)。
 * 返回与 texts 等长的 number[][]。失败抛 Error。
 */
export async function embedTexts(
  texts: string[],
  input: EmbedInput,
  signal?: AbortSignal,
): Promise<number[][]> {
  if (texts.length === 0) return [];
  const url = embeddingsUrl(input.model.baseUrl);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(input.headers ?? {}),
    ...(input.apiKey ? { Authorization: `Bearer ${input.apiKey}` } : {}),
  };
  const body = JSON.stringify({ model: input.model.id, input: texts });
  const res = await fetch(url, { method: "POST", headers, body, signal });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // /v1/embeddings 404 时降级试 /embeddings
    if (res.status === 404 && !/\/v\d+\/embeddings$/.test(url) && /\/v1\/embeddings$/.test(url)) {
      const alt = url.replace(/\/v1\/embeddings$/, "/embeddings");
      const res2 = await fetch(alt, { method: "POST", headers, body, signal });
      if (!res2.ok) throw new Error(`embeddings ${res2.status}: ${await res2.text().catch(() => "")}`);
      const data2 = await res2.json();
      return normalizeEmbeddings(data2, texts.length);
    }
    throw new Error(`embeddings ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return normalizeEmbeddings(data, texts.length);
}

/** 从各 provider 的 embeddings 响应里提取向量数组。 */
function normalizeEmbeddings(data: unknown, expected: number): number[][] {
  if (!data || typeof data !== "object") throw new Error("embeddings 响应非对象");
  const obj = data as Record<string, unknown>;
  // OpenAI 格式: { data: [{ embedding: [...] }, ...] }
  if (Array.isArray(obj.data)) {
    const arr = obj.data as Array<Record<string, unknown>>;
    const vecs = arr.map((d) => (Array.isArray(d.embedding) ? (d.embedding as number[]) : []));
    if (vecs.length === expected) return vecs;
  }
  // 有的 provider: { embeddings: [[...], ...] }
  if (Array.isArray(obj.embeddings)) {
    const arr = obj.embeddings as unknown[];
    if (Array.isArray(arr[0])) return arr as number[][];
  }
  throw new Error(`embeddings 响应格式无法解析: ${JSON.stringify(data).slice(0, 200)}`);
}

/** 余弦相似度。 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
