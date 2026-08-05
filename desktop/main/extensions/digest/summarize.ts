/**
 * LLM 摘要生成 —— 摘取 Understand-Anything 的 prompt 设计,适配 LXCode digest 字段。
 *
 * 用 LXCode 主进程已有的 ModelRuntime.completeSimple 调 LLM,不引 pi-ai 依赖。
 * UA 的 buildFileAnalysisPrompt 要求 fileSummary/tags/complexity/functionSummaries JSON;
 * 我们适配成 what(一句话)/how(白话步骤)/logic(关键逻辑) 三字段,贴合排查诉求。
 *
 * MIT 协议,Understand-Anything (c) Yuxiang Lin / Egonex-AI。
 */

/** LLM 调用需要的运行时(来自 LXCode 主进程的 ModelRuntime)。 */
export interface LLMRuntime {
  /** 调用模型完成一次推理(非流式)。 */
  completeSimple: (
    model: unknown,
    context: { systemPrompt?: string; messages: unknown[] },
    options?: unknown,
  ) => Promise<{ content: Array<{ type: string; text?: string }>; stopReason?: string }>; /**
   * 获取指定 provider/model 的模型对象(可选,备用)。
   */
  getModel?: (providerId: string, modelId: string) => unknown | undefined;
}

/** 单文件 LLM 摘要结果。 */
export interface FileLLMSummary {
  /** 文件一句话功能(白话)。 */
  what: string;
  /** 每个函数的摘要:key=函数名,value={what,how,logic?}。 */
  functions: Record<
    string,
    { what: string; how: string[]; logic?: string[] }
  >;
}

/**
 * 构建单文件分析 prompt(摘取 UA 设计,适配我们字段)。
 * 给 LLM 文件结构骨架(函数名/行号/调用/import,来自 AST)+ 源码,要它填白话。
 */
export function buildFilePrompt(filePath: string, skeleton: string, source: string): string {
  return `你是代码分析助手。分析下面的源文件,返回 JSON 对象。只返回 JSON,不要额外文字。

文件: ${filePath}

函数骨架(来自 AST 解析,含函数名/行号/调用关系/import):
${skeleton}

源码:
\`\`\`
${source}
\`\`\`

返回 JSON 对象,字段:
- "what": 这个文件整体干嘛的(一句话白话,程序员轻松看懂,不要"工具文件"这种空话,要具体如"提供 API 层用的日期格式化工具")
- "functions": 对象,key 是函数名,value 是对象含:
  - "what": 这函数干嘛(一句话白话)
  - "how": 怎么实现的(白话 2-5 步,数组)
  - "logic": 关键逻辑/分支/边界,只写非显然的、排查问题有用的(数组,可选;无则省)

规则:
- 全部用中文白话,程序员一看就懂,必须用中文不要用英文
- how 用动词开头,如"有 sessionPath 就 open 恢复,没有就 create 新建"
- logic 只摘易出问题的(分支判断、状态转换、循环、异步、事件),普通赋值/简单调用不写
- 不要臆造,基于实际代码
- 只返回 JSON`;
}

/** 从 LLM 响应提取 JSON(容错:处理 markdown fence + 裸 JSON)。摘取 UA 的 extractJson。 */
function extractJson(response: string): string {
  const fence = response.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fence) return fence[1].trim();
  const obj = response.match(/\{[\s\S]*\}/);
  if (obj) return obj[0].trim();
  return response.trim();
}

/** 解析单文件 LLM 响应。失败返回 null(不阻断,上层用空字段)。 */
export function parseFileSummary(response: string): FileLLMSummary | null {
  try {
    const parsed = JSON.parse(extractJson(response)) as Record<string, unknown>;
    const what = typeof parsed.what === "string" ? parsed.what : "";
    const functions: FileLLMSummary["functions"] = {};
    const fns = parsed.functions;
    if (fns && typeof fns === "object" && !Array.isArray(fns)) {
      for (const [name, val] of Object.entries(fns as Record<string, unknown>)) {
        if (!val || typeof val !== "object") continue;
        const v = val as Record<string, unknown>;
        const fWhat = typeof v.what === "string" ? v.what : "";
        const fHow = Array.isArray(v.how) ? v.how.filter((x) => typeof x === "string") : [];
        const fLogic = Array.isArray(v.logic) ? v.logic.filter((x) => typeof x === "string") : undefined;
        functions[name] = { what: fWhat, how: fHow, ...(fLogic?.length ? { logic: fLogic } : {}) };
      }
    }
    return { what, functions };
  } catch {
    return null;
  }
}

/** 生成单文件的 LLM 摘要。失败返回 null(静默,不拖垮主流程)。 */
export async function summarizeFile(
  rt: LLMRuntime,
  model: unknown,
  filePath: string,
  skeleton: string,
  source: string,
  signal?: AbortSignal,
): Promise<FileLLMSummary | null> {
  const prompt = buildFilePrompt(filePath, skeleton, source);
  try {
    const result = await rt.completeSimple(
      model,
      {
        systemPrompt: "你是代码分析助手,只返回 JSON。",
        messages: [{ role: "user", content: prompt, timestamp: Date.now() }],
      },
      signal ? { signal } : undefined,
    );
    const text = result.content.find((c) => c.type === "text")?.text ?? "";
    if (!text) return null;
    return parseFileSummary(text);
  } catch {
    return null;
  }
}

/** 一个功能簇的输入(给 LLM 命名用)。 */
export interface ClusterInput {
  id: string;
  members: { fn: string; file: string }[];
}

/** 构建功能簇命名 prompt:给 LLM 簇内函数名+文件,要它起功能名+一句话描述。 */
function buildClusterNamesPrompt(clusters: ClusterInput[]): string {
  const lines = clusters.map((c, i) => {
    const mems = c.members.slice(0, 15).map((m) => `${m.fn}(${m.file})`).join(", ");
    return `簇${i}: [${mems}${c.members.length > 15 ? " ..." : ""}]`;
  }).join("\n");
  return `你是代码分析助手。下面是按调用关系聚类出的功能簇,每簇含一组互相调用的函数(函数名+文件)。

要求:
- 给每个簇起一个简洁的中文功能名(必须是中文,如"会话管理""数据存储""项目地图""用户界面"),不要用英文
- 写一句话中文描述它干什么

${lines}

返回 JSON 数组,每个元素:{"index": 簇序号, "name": 中文功能名, "what": 中文一句话描述}。只返回 JSON。`;
}

/** 解析功能簇命名 LLM 响应。失败返回 null。 */
export function parseClusterNames(response: string): Array<{ index: number; name: string; what?: string }> | null {
  try {
    const parsed = JSON.parse(extractJson(response));
    const arr = Array.isArray(parsed) ? parsed : (parsed as { clusters?: unknown[] })?.clusters;
    if (!Array.isArray(arr)) return null;
    return arr
      .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
      .map((x) => ({
        index: typeof x.index === "number" ? x.index : -1,
        name: typeof x.name === "string" ? x.name : "",
        what: typeof x.what === "string" ? x.what : undefined,
      }))
      .filter((x) => x.index >= 0 && x.name);
  } catch {
    return null;
  }
}

/** 用 LLM 给功能簇批量命名。失败返回 null(上层用种子函数名占位)。 */
export async function nameClusters(
  rt: LLMRuntime,
  model: unknown,
  clusters: ClusterInput[],
  signal?: AbortSignal,
): Promise<Array<{ name: string; what?: string }> | null> {
  if (clusters.length === 0) return [];
  const prompt = buildClusterNamesPrompt(clusters);
  try {
    const result = await rt.completeSimple(
      model,
      { systemPrompt: "你是代码分析助手,只返回 JSON。", messages: [{ role: "user", content: prompt, timestamp: Date.now() }] },
      signal ? { signal } : undefined,
    );
    const text = result.content.find((c) => c.type === "text")?.text ?? "";
    console.log(`[digest] LLM 命名响应长度=${text.length}, 前80字=${text.slice(0, 80)}`);
    if (!text) return null;
    const parsed = parseClusterNames(text);
    console.log(`[digest] LLM 命名解析:`, parsed ? `${parsed.length}个` : 'null(解析失败)');
    if (!parsed) return null;
    // 按返回顺序对应(不依赖 LLM 的 index 字段,更鲁棒)
    return clusters.map((_, i) => ({
      name: parsed[i]?.name ?? "",
      what: parsed[i]?.what,
    }));
  } catch {
    return null;
  }
}
