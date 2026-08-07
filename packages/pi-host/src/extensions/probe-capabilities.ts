/**
 * 真实探测单个模型的能力(思考/视觉/上下文窗口)。
 *
 * 不是靠 ID 猜档案,而是发真实测试请求看模型接不接受:
 *  - 思考:带 thinking/reasoning_effort 参数发个最小请求,不报错=支持
 *  - 视觉:带 1x1 测试图发个最小请求,不报错=支持
 *  - 上下文窗口:优先用 catalog 的 max_model_len,否则发超长 prompt 看报错(暂不实现,用默认)
 *
 * 对 anthropic-messages 和 openai-completions 分别拼请求。
 * 探测失败(网络/鉴权)不抛错,返回探测前的值(保守)。
 */
import type { ProviderApi } from "@lxcode/protocol";

export type ProbeResult = {
  /** 是否支持思考(reasoning)。探测失败=保守 false。 */
  reasoning: boolean;
  /** 是否支持视觉(图片输入)。探测失败=保守 false。 */
  vision: boolean;
  /** 是否支持嵌入向量化(embeddings)。探测失败=保守 false。 */
  embeddings: boolean;
  /** 探测时的错误信息(如有)。 */
  error?: string;
};

/** 1x1 透明 PNG 的 base64。用于视觉探测。 */
const TINY_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pTvAAAAAElFTkSuQmCC";

/**
 * 探测模型能力。providerId/baseUrl/apiKey/api 决定怎么发请求。
 * signal 可取消。超时内部 15s。
 */
export async function probeModelCapabilities(args: {
  baseUrl: string;
  api: ProviderApi;
  apiKey: string | undefined;
  modelId: string;
  signal?: AbortSignal;
}): Promise<ProbeResult> {
  const { baseUrl, api, apiKey, modelId } = args;
  const timeout = AbortSignal.timeout(15_000);
  const signal = args.signal ? AbortSignal.any([args.signal, timeout]) : timeout;

  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  if (apiKey) {
    if (api === "anthropic-messages") {
      headers["x-api-key"] = apiKey;
      headers["anthropic-version"] = "2023-06-01";
      // 兼容 Bearer 鉴权的 anthropic 代理(如 vllm):如果 endpoint 不认 x-api-key,也带 Bearer
      headers["Authorization"] = `Bearer ${apiKey}`;
    } else {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }
  }

  // 并行探测思考 + 视觉 + 向量
  const [reasoning, vision, embeddings] = await Promise.all([
    probeReasoning(baseUrl, api, modelId, headers, signal),
    probeVision(baseUrl, api, modelId, headers, signal),
    probeEmbeddings(baseUrl, headers, modelId, signal),
  ]);

  return { reasoning, vision, embeddings };
}

/** 探测思考:带 thinking/reasoning_effort 参数发最小请求,不报错=支持。 */
async function probeReasoning(
  baseUrl: string,
  api: ProviderApi,
  modelId: string,
  headers: Record<string, string>,
  signal: AbortSignal,
): Promise<boolean> {
  try {
    if (api === "anthropic-messages") {
      // anthropic: /v1/messages 带 thinking 参数
      const url = new URL("/v1/messages", baseUrl).href;
      const body = {
        model: modelId,
        max_tokens: 16,
        thinking: { type: "enabled", budget_tokens: 1024 },
        messages: [{ role: "user", content: "hi" }],
      };
      const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal });
      // 400 且错误含 thinking/reason = 不支持;其他成功或普通错误=保守认为不支持
      if (res.ok) return true;
      const text = await res.text().catch(() => "");
      // 明确拒绝 thinking 参数 = 不支持
      if (/thinking|reason|not.*support|invalid.*parameter/i.test(text)) return false;
      // 其他错误(如鉴权)无法判断,保守 false
      return false;
    }
    // openai: /v1/chat/completions 带 reasoning_effort
    const url = new URL("/v1/chat/completions", baseUrl).href;
    const body = {
      model: modelId,
      max_tokens: 16,
      reasoning_effort: "low",
      messages: [{ role: "user", content: "hi" }],
    };
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal });
    if (res.ok) return true;
    const text = await res.text().catch(() => "");
    if (/reasoning_effort|not.*support|invalid.*parameter/i.test(text)) return false;
    return false;
  } catch {
    return false;
  }
}

/** 探测视觉:带 1x1 测试图发最小请求,不报错=支持。 */
async function probeVision(
  baseUrl: string,
  api: ProviderApi,
  modelId: string,
  headers: Record<string, string>,
  signal: AbortSignal,
): Promise<boolean> {
  try {
    if (api === "anthropic-messages") {
      const url = new URL("/v1/messages", baseUrl).href;
      const body = {
        model: modelId,
        max_tokens: 16,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: "image/png", data: TINY_PNG_B64 } },
              { type: "text", text: "what is this?" },
            ],
          },
        ],
      };
      const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal });
      if (res.ok) return true;
      const text = await res.text().catch(() => "");
      if (/image|vision|multimodal|not.*support|invalid.*type/i.test(text)) return false;
      return false;
    }
    // openai: /v1/chat/completions 带 image_url
    const url = new URL("/v1/chat/completions", baseUrl).href;
    const body = {
      model: modelId,
      max_tokens: 16,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "what is this?" },
            { type: "image_url", image_url: { url: `data:image/png;base64,${TINY_PNG_B64}` } },
          ],
        },
      ],
    };
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal });
    if (res.ok) return true;
    const text = await res.text().catch(() => "");
    if (/image|vision|multimodal|not.*support|invalid/i.test(text)) return false;
    return false;
  } catch {
    return false;
  }
}

/** 从 catalog item 拿 contextWindow(vllm 的 max_model_len 等)。 */
export function contextWindowFromCatalogItem(item: unknown): number | undefined {
  if (!isObject(item)) return undefined;
  // vllm: max_model_len; 其他可能的字段
  const candidates = [(item as Record<string, unknown>).max_model_len, (item as Record<string, unknown>).context_length, (item as Record<string, unknown>).max_context_length, (item as Record<string, unknown>).context_window];
  for (const c of candidates) {
    if (typeof c === "number" && c > 0 && Number.isSafeInteger(c)) return c;
  }
  return undefined;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 探测向量化:发 /v1/embeddings 请求带测试文本,成功=支持。 */
async function probeEmbeddings(
  baseUrl: string,
  headers: Record<string, string>,
  modelId: string,
  signal: AbortSignal,
): Promise<boolean> {
  try {
    const url = new URL("/v1/embeddings", baseUrl).href;
    const body = { model: modelId, input: "hi" };
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal });
    if (res.ok) return true;
    const text = await res.text().catch(() => "");
    // 明确拒绝=不支持(404 端点不存在 / 400 参数错 / 404 model not found)
    return false;
  } catch {
    return false;
  }
}
