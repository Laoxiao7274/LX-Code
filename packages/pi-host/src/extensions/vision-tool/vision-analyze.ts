/**
 * 视觉识别核心:把图片发给用户配置的视觉模型,返回识别结果。
 *
 * 不走主会话模型,而是独立调用 useCases.vision 配置的视觉模型:
 *  1. 读 desktop-settings.json 的 useCases.vision = "providerId/modelId"
 *  2. 从 modelRegistry 找到该 model + API key
 *  3. 用 complete() 发图片 + 用户问题给该模型
 *  4. 返回模型识别出的文本给主会话
 *
 * 这样即使主会话模型不支持视觉,AI 也能通过 vision_analyze 工具识图。
 */
import { complete } from "@earendil-works/pi-ai/compat";
import { uuidv7 } from "@earendil-works/pi-ai";
import type { Model, Api, ImageContent } from "@earendil-works/pi-ai";
import type { ModelRegistry } from "@earendil-works/pi-coding-agent";
import { getVisionModelKey } from "./vision-config.js";

export type VisionAnalyzeInput = {
  /** 本地图片绝对路径(二选一)。 */
  imagePath?: string;
  /** 已编码好的 base64 图片(二选一)。 */
  imageBase64?: string;
  /** imageBase64 对应的 mime type。 */
  mimeType?: string;
  /** 让视觉模型回答的问题/指令(可选,默认"描述这张图片")。 */
  question?: string;
};

export type VisionAnalyzeResult = {
  ok: boolean;
  /** 视觉模型返回的识别文本。 */
  text?: string;
  /** 使用的模型 key(providerId/modelId)。 */
  model?: string;
  error?: string;
};

/** 探测图片 mime type(从文件头)。 */
function detectMimeType(bytes: Buffer): string | undefined {
  if (bytes.length < 4) return undefined;
  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  // GIF: 47 49 46 38
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return "image/gif";
  // WebP: 52 49 46 46 ?? ?? ?? ?? 57 45 42 50
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return "image/webp";
  return undefined;
}

/** 读本地图片为 base64。 */
async function readImageAsBase64(path: string): Promise<{ data: string; mimeType: string } | { error: string }> {
  try {
    const { readFile } = await import("node:fs/promises");
    const buf = await readFile(path);
    const mime = detectMimeType(buf);
    if (!mime) {
      // 兜底:按扩展名猜
      const ext = path.toLowerCase().split(".").pop();
      const extMime = ext === "png" ? "image/png" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "gif" ? "image/gif" : ext === "webp" ? "image/webp" : undefined;
      if (!extMime) return { error: `无法识别图片类型: ${path}` };
      return { data: buf.toString("base64"), mimeType: extMime };
    }
    return { data: buf.toString("base64"), mimeType: mime };
  } catch (e) {
    return { error: `读取图片失败: ${e instanceof Error ? e.message : e}` };
  }
}

/**
 * 用视觉模型识别图片。
 * registry 用于找 model + auth。signal 可取消。
 */
export async function analyzeImage(
  input: VisionAnalyzeInput,
  registry: ModelRegistry,
  signal?: AbortSignal,
): Promise<VisionAnalyzeResult> {
  // 1. 解析图片为 base64 + mime
  let data: string | undefined;
  let mimeType: string | undefined;
  if (input.imageBase64) {
    data = input.imageBase64;
    mimeType = input.mimeType ?? "image/png";
  } else if (input.imagePath) {
    const r = await readImageAsBase64(input.imagePath);
    if ("error" in r) return { ok: false, error: r.error };
    data = r.data;
    mimeType = r.mimeType;
  } else {
    return { ok: false, error: "必须提供 imagePath 或 imageBase64" };
  }

  // 2. 读视觉模型配置
  const modelKey = getVisionModelKey();
  if (!modelKey) {
    return {
      ok: false,
      error: "未配置视觉模型。请在 设置 → 模型用途 → 视觉理解 中指定一个支持视觉的模型。",
    };
  }
  const slash = modelKey.indexOf("/");
  const providerId = modelKey.slice(0, slash);
  const modelId = modelKey.slice(slash + 1);

  // 3. 从 registry 找 model + auth
  const model = registry.find(providerId, modelId);
  if (!model) {
    return { ok: false, error: `视觉模型未找到: ${modelKey}。请检查模型服务配置或用途设置。`, model: modelKey };
  }
  // 校验该模型是否支持视觉(input 含 image)
  if (!("input" in model) || !Array.isArray((model as { input?: unknown[] }).input) || !(model as { input?: unknown[] }).input?.includes("image")) {
    // 不阻断,给警告但仍尝试(有些模型未正确声明 input)
    // 继续:很多代理模型 input 声明不全
  }
  const auth = await registry.getApiKeyAndHeaders(model);
  if (!auth.ok) {
    return { ok: false, error: `视觉模型鉴权失败: ${auth.error}`, model: modelKey };
  }
  // authHeader:false 的 provider(如内网无鉴权模型)没有 apiKey 也不发 Authorization,
  // 这是合法配置——不用强制 key。pi-ai 的 complete 内部 assertRequestAuth 要求
  // apiKey 或 authorization/x-api-key header,但 LXCode 的 registry 已经按 authHeader
  // 处理好 headers(authHeader:false 不加 Authorization)。这里直接用 auth 的值,没 key
  // 时让 pi-ai 用 headers 里的鉴权(如果有)或报错给用户明确提示。
  const effectiveApiKey = auth.apiKey;
  const effectiveHeaders = auth.headers;

  // 4. 构造请求:图片 + 问题
  const question = input.question?.trim() || "请详细描述这张图片的内容。";
  const imageContent: ImageContent = {
    type: "image",
    data,
    mimeType: mimeType!,
  };
  const messages = [
    {
      role: "user" as const,
      content: [
        { type: "text" as const, text: question },
        imageContent,
      ],
      timestamp: Date.now(),
    },
  ];

  try {
    // 30s 超时,避免视觉模型挂起拖死整个会话(input 钩子是阻塞的)
    const timeoutMs = 30_000;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(new Error("vision model timeout")), timeoutMs);
    // 外部 signal(agent abort)时也取消
    const onExternalAbort = () => ac.abort((signal as any)?.reason ?? new Error("aborted"));
    if (signal && !signal.aborted) signal.addEventListener("abort", onExternalAbort, { once: true });
    else if (signal?.aborted) ac.abort(signal.reason);
    let response;
    try {
      response = await complete(
        model as Model<Api>,
        { messages },
        {
          apiKey: effectiveApiKey,
          headers: effectiveHeaders,
          env: auth.env,
          signal: ac.signal,
          cacheRetention: "none",
          sessionId: uuidv7(),
        },
      );
    } finally {
      clearTimeout(timer);
      if (signal) signal.removeEventListener("abort", onExternalAbort);
    }
    const text = response.content
      .filter((c): c is { type: "text"; text: string } => c.type === "text")
      .map((c) => c.text)
      .join("\n");
    // 检测 complete 内部错误(pi-ai 的 complete 流式 API 错误放在 response.errorMessage,不抛异常)
    // 例如无 apiKey 时 assertRequestAuth 报 "No API key for provider: xxx",content 为空,stopReason=error
    if (response.stopReason === "error" || (!text && response.errorMessage)) {
      console.error("[vision-tool] 视觉模型返回错误:", response.errorMessage, "stopReason:", response.stopReason, "model:", modelKey);
      return {
        ok: false,
        error: `视觉模型返回错误: ${response.errorMessage || "未知错误(模型未返回内容)"}`,
        model: modelKey,
      };
    }
    if (!text) {
      console.error("[vision-tool] 视觉模型返回空内容,model:", modelKey, "stopReason:", response.stopReason);
      return { ok: false, error: "视觉模型返回了空内容", model: modelKey };
    }
    return { ok: true, text, model: modelKey };
  } catch (e) {
    return {
      ok: false,
      error: `视觉识别请求失败: ${e instanceof Error ? e.message : String(e)}`,
      model: modelKey,
    };
  }
}
