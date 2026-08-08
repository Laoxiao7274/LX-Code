/**
 * Coding 工作流引导 —— Plan-Confirm-Execute-Verify 规范流程。
 *
 * before_agent_start 注入 systemPrompt,要求 agent:
 *  1. Plan:先给方案(改哪些文件/怎么做/测试方式),不要直接动手
 *  2. Confirm:调 confirm_plan 工具弹窗(按方案执行 / 调整后再执行 / 重新规划),等用户选择
 *  3. Execute:用户确认执行后才动手
 *  4. Verify:执行完调 run_verify 工具跑自动化测试,过才算完成
 *
 * 注册两个工具:
 *  - confirm_plan:ctx.ui.select 多选项弹窗(执行/调整/重新规划 + 自由输入),
 *    返回用户选择,agent 据此决定下一步
 *  - run_verify:检测项目类型(Web/WebView/Tauri),引导对应测试方式
 *    (chrome-devtools MCP / npm test / dev 模式 + CDP)
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

type PackageJson = {
  scripts?: Record<string, string>;
  devDependencies?: Record<string, string>;
  dependencies?: Record<string, string>;
};

function readPackageJson(cwd: string): PackageJson | null {
  try {
    const p = join(cwd, "package.json");
    if (!existsSync(p)) return null;
    return JSON.parse(readFileSync(p, "utf8")) as PackageJson;
  } catch {
    return null;
  }
}

/** 是否 Tauri/Electron 等 WebView 桌面应用项目(需 dev 模式 + CDP 测)。 */
function isWebViewProject(cwd: string, pkg: PackageJson): boolean {
  if (existsSync(join(cwd, "src-tauri"))) return true; // Tauri
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  return Boolean(deps.electron);
}

/** 是否前端项目(有 dev server / 前端框架)。 */
function isFrontendProject(pkg: PackageJson): boolean {
  const scripts = pkg.scripts ?? {};
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  return Boolean(
    scripts.dev ||
    deps.vite || deps.next || deps.nuxt ||
    deps.playwright || deps.cypress ||
    deps.webpack || deps.rollup,
  );
}

function hasTestScript(pkg: PackageJson): boolean {
  const s = pkg.scripts ?? {};
  return Boolean(s.test && s.test !== 'echo "Error: no test specified" && exit 1');
}

/** 生成工作流引导 systemPrompt。 */
function buildWorkflowHint(cwd: string, pkg: PackageJson | null): string {
  if (!pkg) return ""; // 无 package.json 不引导(非 JS 项目)
  const webview = isWebViewProject(cwd, pkg);
  const frontend = isFrontendProject(pkg);
  const hasTest = hasTestScript(pkg);
  const lines = [
    "",
    "## Coding 工作流(必须遵守)",
    "任何涉及改代码的任务,必须按 Plan-Confirm-Execute-Verify 流程,不许跳步:",
    "",
    "### 1. Plan(先给方案)",
    "- 先调研(读代码/搜索),输出明确方案:改哪些文件、怎么改、为什么、测试方式。",
    "- 不要一上来就动手改文件或跑命令。先讲清楚你要做什么。",
    "",
    "### 2. Confirm(等用户确认)",
    "- 方案讲完后,调用 confirm_plan 工具(把方案摘要放进 message 参数)弹窗让用户选择。",
    "- 弹窗提供三个选项:按方案执行 / 调整后再执行 / 重新规划;用户也可在输入框补充说明。",
    "- 工具返回值含义:返回『用户已确认』→ 开始执行;返回『调整/补充说明』→ 按补充调整后重新 confirm_plan;返回『重新规划』→ 重新给方案;返回『取消』→ 停止。",
    "- 简单的只读问答/解释类任务不需要确认,但只要涉及改代码/跑命令就必须确认。",
    "",
    "### 3. Execute(执行)",
    "- 按 confirm 过的方案执行,边做边说明进度。",
    "",
    "### 4. Verify(必须实际运行验证,过才算完成)",
    "- 改完代码必须验证,不许只改不验就交付。重要:类型检查/构建只说明“没语法错”,不算验证完成。必须实际运行测试或启动应用验证行为正确。验证方式按项目类型:",
  ];
  if (webview) {
    lines.push(
      "- 这是 WebView 桌面应用项目(Tauri/Electron)。必须走 dev 模式实测:",
      "  a. 用 bash 启动 dev server:Tauri 用 `cargo tauri dev`(或 npm run tauri dev),",
      "     Electron 用 `npm run dev`;启动时必须带 remote debugging 参数让 MCP 能连:",
      "     Tauri(WebView2)设环境变量 WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=\"--remote-debugging-port=9222\";",
      "     Electron 加 --remote-debugging-port=9222 参数。",
      "  b. 等 dev server 就绪(看日志输出端口/地址)。",
      "  c. chrome-devtools MCP 用「连接已运行应用(CDP)」模式连 http://localhost:9222,",
      "     用 navigate_page 打开应用窗口地址,click/fill_form 复现场景,",
      "     take_screenshot(传 filePath 存文件) + vision_analyze 看效果。",
      "  d. 若 chrome-devtools 配了 executablePath 但启动失败,提示用户去",
      "     设置→自动化测试 配置浏览器路径或改用「连接已运行应用(CDP)」模式。",
    );
  } else if (frontend) {
    lines.push(
      "- 这是前端项目。用 chrome-devtools MCP 实测:",
      "  a. 若需运行时验证,用 bash 启动 dev server(npm run dev,后台运行),等就绪",
      "  b. chrome-devtools navigate_page 打开页面(如 http://localhost:5173)",
      "  c. click/fill_form 复现场景",
      "  d. take_screenshot 传 filePath 存文件 + vision_analyze 看效果",
      "     (你看不了图,必须存文件再让视觉模型看,不要只说\"模型不支持图片\"就跳过)",
      "  e. 确认无控制台/网络报错",
    );
  }
  if (hasTest) {
    lines.push("- 有测试脚本:必须用 bash 跑 `npm test`(或对应脚本)并确认通过,不能只用 tsc 代替。");
  }
  if (!webview && !frontend && !hasTest) {
    lines.push(
      "- 后端/库项目无测试脚本:不能只类型检查。必须实际运行验证:",
      "  * 若是服务/应用(有 dev/start 脚本):用 bash 后台启动 `npm run dev` 或 `npm start`,等就绪后用 curl/请求实际调用验证行为正确,再关掉。",
      "  * 若是库:写个临时脚本 import 改动的东西,实际调用确认输出符合预期。",
      "  * 类型检查/构建可作为附加,但不能代替实际运行。",
    );
  }
  lines.push(
    "- 验证失败就修,最多重试 3 次,还不行就停下报告问题,不要交付未验证的代码。",
    "- 验证通过后才算完成,明确告诉用户\"已验证通过\"。",
    "",
  );
  return lines.join("\n");
}

export default function createTestFlowExtension(pi: ExtensionAPI): void {
  // 注入工作流引导
  pi.on("before_agent_start", (event, ctx) => {
    const hint = buildWorkflowHint(ctx.cwd, readPackageJson(ctx.cwd));
    if (!hint) return;
    return { systemPrompt: event.systemPrompt + hint };
  });

  // 方案确认工具:多选项弹窗(执行/调整/重新规划 + 自由输入)。
  // 方案已在对话里给出,弹窗只做选择确认,不重复方案。
  const EXECUTE = "按方案执行";
  const ADJUST = "调整后再执行";
  const REPLAN = "重新规划";
  pi.registerTool({
    name: "confirm_plan",
    label: "方案确认",
    description:
      `改代码前向用户确认方案。方案你已经在上文讲清楚了,这里只需传一句简短确认语(如"是否开始执行?"),弹窗会显示这句并给三个选项:按方案执行 / 调整后再执行 / 重新规划,用户还可在输入框补充说明。不要把整个方案塞进 message。涉及改代码/跑命令的任务必须先调此工具确认。返回值会说明用户的选择,据此决定下一步。`,
    promptSnippet: "Confirm plan with user before editing",
    promptGuidelines: [
      "Call confirm_plan with a short confirmation prompt (e.g. \"是否开始执行?\") after presenting your plan above",
      "Do NOT paste the full plan into message — it's already in the conversation",
      "Return value tells you the user's choice: confirmed → execute; adjust/feedback → adjust per feedback then re-confirm; replan → give a new plan; cancelled → stop",
      "Skip for read-only/explanation tasks; required for any code change or command execution",
    ],
    parameters: Type.Object({
      message: Type.Optional(Type.String({ description: `简短确认语,如"是否开始执行?"。不传则默认"是否按此方案执行?"` })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const message = String(params.message ?? "").trim() || "是否按此方案执行?";
      try {
        const choice = await ctx.ui.select(
          "方案确认",
          [EXECUTE, ADJUST, REPLAN],
          {
            pideck: {
              presentation: "modal",
              risk: "normal",
              allowFreeform: true,
              optionDetails: [
                { id: EXECUTE, description: "按上方方案立即开始改代码" },
                { id: ADJUST, description: "在下方输入框补充修改意见" },
                { id: REPLAN, description: "放弃当前方案,重新给出方案" },
              ],
            },
          } as never,
        );
        // choice === undefined:用户取消/超时
        // choice === EXECUTE:确认执行
        // choice === ADJUST:调整(无补充文本)
        // choice === REPLAN:重新规划
        // 其他(自由输入文本):用户的补充说明
        let text: string;
        let confirmed = false;
        let action: "execute" | "adjust" | "replan" | "cancel";
        if (choice === undefined) {
          text = "用户已取消,停止执行。";
          action = "cancel";
        } else if (choice === EXECUTE) {
          text = "用户已确认,按方案开始执行。";
          confirmed = true;
          action = "execute";
        } else if (choice === ADJUST) {
          text = "用户选择调整方案。请在下方补充说明需要调整的地方,我会据此修改方案后重新确认。";
          action = "adjust";
        } else if (choice === REPLAN) {
          text = "用户要求重新规划,请重新给出方案。";
          action = "replan";
        } else {
          // 自由输入:用户的补充说明文本
          text = `用户补充说明:${choice}。请按补充说明调整方案后重新确认。`;
          action = "adjust";
        }
        return {
          content: [{ type: "text", text }],
          details: { confirmed, action, choice },
        };
      } catch (e) {
        return {
          content: [{ type: "text", text: `确认弹窗失败: ${e instanceof Error ? e.message : e}` }],
          details: { confirmed: false, error: String(e) },
        };
      }
    },
  });

  // 验证工具:检测项目类型,引导对应测试方式
  pi.registerTool({
    name: "run_verify",
    label: "运行验证",
    description:
      "改完代码后跑验证。自动检测项目类型:WebView 桌面应用(Tauri/Electron)→提示走 dev 模式 + chrome-devtools CDP 测;前端项目→chrome-devtools 测;有 npm test→跑测试;其他→构建/类型检查。返回验证指引,你按指引执行。",
    promptSnippet: "Run verification after code changes",
    promptGuidelines: [
      "Call run_verify after code changes to get verification steps for the project type",
      "Follow the returned steps (dev mode + CDP for WebView apps, chrome-devtools for web, npm test if present)",
    ],
    parameters: Type.Object({}),
    async execute(_id, _params, _signal, _onUpdate, ctx) {
      const cwd = ctx.cwd;
      const pkg = readPackageJson(cwd);
      if (!pkg) {
        return { content: [{ type: "text", text: "无 package.json,非 JS 项目。请用项目自身的构建/测试方式验证。" }], details: {} };
      }
      const webview = isWebViewProject(cwd, pkg);
      const frontend = isFrontendProject(pkg);
      const hasTest = hasTestScript(pkg);
      const lines = ["验证指引:"];
      if (webview) {
        lines.push(
          "WebView 桌面应用,必须走 dev 模式实测:",
          "1. bash 启动 dev:Tauri 用 `cargo tauri dev`(带 env WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=\"--remote-debugging-port=9222\");Electron 用 `npm run dev -- --remote-debugging-port=9222`",
          "2. 等 dev 就绪",
          "3. chrome-devtools MCP 连 http://localhost:9222,navigate_page/交互/take_screenshot(filePath)+vision_analyze 验证",
          "4. 若浏览器 exe 没配且启动失败,提示用户去 设置→自动化测试 配置或改用连接 CDP 模式",
        );
      } else if (frontend) {
        lines.push(
          "前端项目,用 chrome-devtools MCP 实测:",
          "1. bash 启动 dev server(npm run dev),等就绪",
          "2. chrome-devtools navigate_page 打开页面",
          "3. 交互复现场景",
          "4. take_screenshot(filePath) + vision_analyze 看效果",
        );
      }
      if (hasTest) lines.push("有测试脚本:必须跑 `npm test` 并确认通过(不能只 tsc 代替)");
      if (!webview && !frontend && !hasTest) lines.push("无测试脚本:不能只类型检查。若服务/应用用 bash 启动 dev/start + curl 实际调用验证;若库写临时脚本调用验证。类型检查仅附加。");
      lines.push("验证失败最多重试 3 次,不过就停下报告。");
      return { content: [{ type: "text", text: lines.join("\n") }], details: { webview, frontend, hasTest } };
    },
  });
}
