/**
 * vision-tool pi 扩展 —— 把"识图"做成显式工具,转发给用户配置的视觉模型。
 *
 * pi 原生视觉靠多模态主模型直接看图(粘贴/拖入/read 工具)。本工具额外提供:
 * 即使主会话模型不支持视觉,AI 也能调用 vision_analyze 工具,工具内部把图片
 * 转发给 设置→模型用途→视觉理解 配置的视觉模型(独立 complete 调用),把识别结果
 * 返回主会话。相当于给主模型接了一个"视觉外脑"。
 *
 * 工具参数:
 *  - imagePath: 本地图片绝对路径(首选,AI 用 read 工具读不到图片语义时可调本工具)
 *  - question: 让视觉模型回答的问题(可选,默认描述图片)
 *
 * 挂载:extensions/index.ts 注册中心 + session-lifecycle 的 extensionFactories。
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { analyzeImage } from "./vision-analyze.js";
import { invalidateVisionConfigCache } from "./vision-config.js";

export default function createVisionToolExtension(pi: ExtensionAPI): void {
  // 会话开始:清一次配置缓存(用户可能刚改了视觉用途设置)
  pi.on("session_start", () => {
    invalidateVisionConfigCache();
  });

  // 视觉代理引导:用户粘贴图片时,前端把图片存成临时文件并把路径放进消息文本
  // (格式 [粘贴图片: <绝对路径>])。这里注入 systemPrompt 让 AI 收到这种消息
  // 时直接调 vision_analyze 工具识别,而不是说"我无法查看图片"。
  // 主模型本身可能不支持视觉,但通过工具调视觉模型获得识别能力。
  pi.on("before_agent_start", (event, _ctx) => {
    // 仅当本次消息含粘贴图片标记时才注入引导,避免无谓污染 systemPrompt
    if (!/\[粘贴图片\s*:|\[pasted image\s*:/i.test(event.prompt)) return;
    const hint = [
      "",
      "## 视觉识别(重要)",
      "用户消息中的 [粘贴图片: <路径>] 标记代表一张本地图片文件。你本身可能无法直接查看图片,但可以调用 vision_analyze 工具识别它。",
      "规则:",
      "- 收到 [粘贴图片: 路径] 时,直接调用 vision_analyze 工具(传 imagePath=该路径),不要说“我无法查看图片”“请提供路径”之类的话——路径已经在消息里了。",
      "- 可以在 question 参数里带上用户的问题(如“这个 UI 有什么问题”“提取图片里的文字”),让视觉模型针对性识别。",
      "- vision_analyze 返回识别结果文本后,基于该结果回答用户。",
      "- 如果用户没问具体问题,默认让视觉模型描述图片内容。",
      "",
    ].join("\n");
    return { systemPrompt: event.systemPrompt + hint };
  });

  // 主工具:vision_analyze(用视觉模型识别图片)
  pi.registerTool({
    name: "vision_analyze",
    label: "视觉识别",
    description:
      "用视觉模型识别/分析图片。把图片转发给配置的视觉模型(设置→模型用途→视觉理解),返回识别结果文本。当用户消息含 [粘贴图片: <路径>] 标记、或需要看图片内容时,直接用本工具(传 imagePath=该路径),不要说“我无法查看图片”。支持 jpg/png/gif/webp。",
    promptSnippet: "Analyze an image with the vision model",
    promptGuidelines: [
      "When the user message contains [粘贴图片: <path>] or an image path, call vision_analyze with imagePath=<that path> — do NOT say you cannot see the image.",
      "Pass the absolute path to a local image file (jpg/png/gif/webp).",
      "Optionally pass a question/prompt to guide what the vision model should describe or extract.",
      "Returns the vision model's textual description/analysis of the image; base your answer on that result.",
    ],
    parameters: Type.Object({
      imagePath: Type.String({
        description: "Absolute path to a local image file (jpg/png/gif/webp) to analyze",
      }),
      question: Type.Optional(
        Type.String({
          description: "Optional question or instruction for the vision model, e.g. 'describe the UI layout' or 'extract text from this screenshot'. Defaults to describing the image.",
        }),
      ),
    }),
    async execute(_id, params, signal, _onUpdate, ctx) {
      try {
        const imagePath = String(params.imagePath ?? "").trim();
        if (!imagePath) {
          return {
            content: [{ type: "text", text: "vision_analyze 失败: 缺少 imagePath 参数" }],
            details: {},
          };
        }
        const result = await analyzeImage(
          {
            imagePath,
            question: params.question ? String(params.question) : undefined,
          },
          ctx.modelRegistry,
          signal,
        );
        if (!result.ok) {
          return {
            content: [{ type: "text", text: `视觉识别失败: ${result.error ?? "未知错误"}` }],
            details: { ok: false, error: result.error, model: result.model },
          };
        }
        const note = result.model ? `[视觉模型: ${result.model}]\n` : "";
        return {
          content: [{ type: "text", text: `${note}${result.text ?? "(视觉模型未返回内容)"}` }],
          details: { ok: true, model: result.model, text: result.text },
        };
      } catch (e) {
        return {
          content: [{ type: "text", text: `vision_analyze 异常: ${e instanceof Error ? e.message : e}` }],
          details: {},
        };
      }
    },
  });
}
