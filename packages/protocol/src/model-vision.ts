import type { ThinkingLevelMap } from "./types.js";

type ModelInput = "text" | "image";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 已知支持视觉(图片输入)的模型 ID 模式。匹配则认为支持 image。
 * 仅当 provider catalog 不返回能力字段时作为兜底推断。
 */
const VISION_ID_PATTERNS: RegExp[] = [
  /(?:^|[-_.])gpt-4o(?:mini|a)?(?:$|[-_.])/i,
  /(?:^|[-_.])gpt-4-turbo(?:$|[-_.])/i,
  /(?:^|[-_.])gpt-4o(?:$|[-_.])/i,
  /(?:^|[-_.])gpt-4-vision(?:$|[-_.])/i,
  /(?:^|[-_.])gpt-4o[-_.]realtime(?:$|[-_.])/i,
  /claude-?3(?:\.5)?[-_.]?sonnet/i,
  /claude-?3(?:\.5)?[-_.]?opus/i,
  /claude-?4[-_.]?(?:sonnet|opus|haiku|solo)/i,
  /(?:^|[-_.])gemini[-_.]?(?:1\.5|2\.0|2\.5|pro|flash|vision)/i,
  /(?:^|[-_.])gemini[-_.]?pro(?:$|[-_.])/i,
  /(?:^|[-_.])qwen[-_.]?vl/i,
  /(?:^|[-_.])qwen2?[-_.]?vl/i,
  /(?:^|[-_.])internvl/i,
  /(?:^|[-_.])llava/i,
  /(?:^|[-_.])cogvlm/i,
  /(?:^|[-_.])glm-4v/i,
  /(?:^|[-_.])step-1v/i,
  /(?:^|[-_.])yi[-_.]?vl/i,
  /(?:^|[-_.])minicpm[-_.]?v/i,
];

/**
 * 探测模型视觉(图片输入)能力。
 *
 * 优先级:
 *  1. catalog item 里的 input / modalities / supported_inputs / capabilities(显式声明 image)
 *  2. catalog item 里声明的 capabilities.vision === true / supports_image === true
 *  3. 模型 ID 匹配已知视觉模型档案
 *  4. 兜底 ["text"](不乱给视觉,避免对不支持图片的模型发图导致报错)
 */
export function detectModelVision(
  modelId: string,
  metadata?: unknown,
): { input: ModelInput[]; source: "provider" | "profile" | "default" } {
  if (isObject(metadata)) {
    // 1. 显式 input / modalities / supported_inputs 数组
    const capsObj2 = isObject(metadata.capabilities) ? metadata.capabilities : undefined;
    const candidates = [
      metadata.input,
      metadata.modalities,
      metadata.supported_inputs,
      metadata.supports,
      capsObj2?.input,
      capsObj2?.modalities,
      capsObj2?.supported_inputs,
    ];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        const lower = candidate.map((item) => String(item).toLowerCase());
        const hasText = lower.some((item) => item === "text" || item === "txt");
        const hasImage = lower.some(
          (item) => item === "image" || item === "images" || item === "vision",
        );
        if (hasImage) {
          return { input: hasText ? ["text", "image"] : ["image"], source: "provider" };
        }
        if (hasText) {
          return { input: ["text"], source: "provider" };
        }
      }
    }
    // 2. capabilities.vision / supports_image 布尔
    const capsObj = isObject(metadata.capabilities) ? metadata.capabilities : null;
    const visionFlags = capsObj
      ? [capsObj.vision, capsObj.supports_image, capsObj.image, capsObj.multimodal]
      : [metadata.vision, metadata.supports_image, metadata.image, metadata.multimodal];
    for (const flag of visionFlags) {
      if (flag === true) return { input: ["text", "image"], source: "provider" };
      if (flag === false) return { input: ["text"], source: "provider" };
    }
  }

  // 3. 模型 ID 匹配已知视觉模型档案
  const normalizedId = modelId.trim().toLowerCase();
  for (const pattern of VISION_ID_PATTERNS) {
    if (pattern.test(normalizedId)) {
      return { input: ["text", "image"], source: "profile" };
    }
  }

  // 4. 兜底
  return { input: ["text"], source: "default" };
}
