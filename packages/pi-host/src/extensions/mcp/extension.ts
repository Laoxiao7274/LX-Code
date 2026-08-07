/**
 * MCP 适配内置扩展 —— 把 pi-mcp-adapter 接成 LXCode 内置扩展。
 *
 * pi-mcp-adapter 是 pi 生态官方的 MCP(Model Context Protocol)适配器:
 * 它不把每个 MCP server 的工具全部注册进上下文(会吃掉上万 token),而是只注册
 * 一个 `mcp` 代理工具(~200 token),AI 调用时按需发现/调用具体 MCP server 工具。
 *
 * LXCode 通过 mcp-defaults.ts 把内置默认 MCP server(chrome-devtools)写进
 * ~/.lxcode/mcp.json(= PI_CODING_AGENT_DIR/mcp.json,pi-mcp-adapter 的 pi-global 路径)。
 * 本扩展用 createMcpAdapter({ configPath }) 让适配器读这个文件,程序化注入配置,
 * 不依赖 pi install npm:pi-mcp-adapter 的用户安装流程。
 *
 * 用户可在 设置 → 内置扩展 开关;关闭后 MCP 工具不出现,AI 也不能调浏览器自动化等。
 */
import { join } from "node:path";
import { createMcpAdapter } from "pi-mcp-adapter";

export default function createMcpBuiltinExtension(pi: import("@earendil-works/pi-coding-agent").ExtensionAPI): void {
  // agentDir 即 ~/.lxcode(= PI_CODING_AGENT_DIR)。mcp.json 由 mcp-defaults.ts 维护。
  // createMcpAdapter 返回 (pi) => void 工厂,直接调用注入。
  const agentDir = process.env.PI_CODING_AGENT_DIR;
  const configPath = agentDir ? join(agentDir, "mcp.json") : undefined;
  const adapter = createMcpAdapter(configPath ? { configPath } : {});
  adapter(pi);
}
