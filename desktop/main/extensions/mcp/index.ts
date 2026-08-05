/**
 * MCP 适配扩展 —— LXCode 自带的精简版,让 AI 能用任意 MCP server。
 *
 * 抄自 pi-mcp-adapter 的核心思想(一个代理工具 + 按需发现),但适配 LXCode 的 CJS bundle
 * 环境:不依赖 pi-ai/pi-tui,只用纯 Node 的 @modelcontextprotocol/sdk(MCP 标准协议)。
 *
 * 工作方式:
 *  - 读 .mcp.json(项目级 + 全局)拿到已配置的 MCP server 定义
 *  - AI 用 3 个工具按需连接 server(lazy,连接缓存):
 *    - mcp_servers: 列出已配置的 server(不连接,只读配置)
 *    - mcp_tools: 连接某 server 列出它的工具
 *    - mcp_call: 调用某 server 的某工具
 *  - server 是子进程(stdio transport),用完不主动杀,缓存复用
 *
 * 纯后端,无 UI。LXCode 自带 codegraph 之外,用户配 .mcp.json 就能接任何 MCP 工具。
 */
import { spawn } from "node:child_process";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

/** .mcp.json 里单个 server 定义。 */
interface ServerDef {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
}

/** .mcp.json 根结构。 */
interface McpConfig {
  mcpServers?: Record<string, ServerDef>;
}

/** 已连接的 server 句柄(缓存复用)。 */
interface ServerConn {
  client: Client;
  lastUsed: number;
}

/** 配置查找路径:项目级 + 全局。 */
function configPaths(cwd: string): string[] {
  const home = os.homedir();
  return [
    path.join(cwd, ".mcp.json"),
    path.join(cwd, ".pi", "mcp.json"),
    path.join(home, ".config", "mcp", "mcp.json"),
    path.join(home, ".agents", "mcp.json"),
    path.join(home, ".agents", "mcp", "mcp.json"),
  ];
}

/** 读所有配置文件合并成 server 定义表(后出现的不覆盖先出现的)。 */
async function loadServers(cwd: string): Promise<Record<string, ServerDef>> {
  const out: Record<string, ServerDef> = {};
  for (const p of configPaths(cwd)) {
    try {
      const txt = await fs.readFile(p, "utf8");
      const cfg = JSON.parse(txt) as McpConfig;
      if (cfg.mcpServers) {
        for (const [name, def] of Object.entries(cfg.mcpServers)) {
          if (!out[name] && def.command) out[name] = def;
        }
      }
    } catch {
      // 文件不存在或 JSON 非法,跳过
    }
  }
  return out;
}

/** Windows 上 npx/npx.cmd 不能直接 spawn,转成 node + npx 脚本路径。 */
function resolveCommand(command: string): { command: string; args: string[] } | null {
  if (command === "npx" || command === "npm") {
    // 全局 npm 的 npx CLI 入口
    const globalRoot = path.join(os.homedir(), "AppData", "Roaming", "npm", "node_modules", "npm", "bin");
    const cli = command === "npx" ? "npx-cli.js" : "npm-cli.js";
    const cliPath = path.join(globalRoot, cli);
    try {
      fs.accessSync(cliPath);
      return { command: process.execPath, args: [cliPath] };
    } catch {
      // 找不到就回退原样(非 Windows 或自定义安装)
      return null;
    }
  }
  return null;
}

/** 连接池:serverName → 连接句柄。 */
const connections = new Map<string, ServerConn>();

/** 按需连接某 server(缓存复用)。失败抛错。 */
async function connectServer(name: string, def: ServerDef): Promise<Client> {
  const cached = connections.get(name);
  if (cached) {
    cached.lastUsed = Date.now();
    return cached.client;
  }
  const resolved = resolveCommand(def.command);
  const command = resolved?.command ?? def.command;
  const args = resolved ? [...resolved.args, ...(def.args ?? [])] : (def.args ?? []);
  const env = { ...process.env, ...def.env };
  const client = new Client({ name: "lxcode", version: "1.0" }, { capabilities: {} });
  const transport = new StdioClientTransport({ command, args, env, cwd: def.cwd });
  await client.connect(transport);
  connections.set(name, { client, lastUsed: Date.now() });
  return client;
}

/** 扩展工厂。 */
export default function createMcpExtension(pi: ExtensionAPI): void {
  // 工具 1:列出已配置的 server(不连接,轻量)
  pi.registerTool({
    name: "mcp_servers",
    label: "MCP 服务器列表",
    description:
      "列出本项目已配置的 MCP server(读 .mcp.json,不连接)。先用这个看有哪些 server,再用 mcp_tools 看工具、mcp_call 调用。",
    parameters: Type.Object({}),
    async execute(_id, _params, _signal, _onUpdate, ctx) {
      try {
        const servers = await loadServers(ctx.cwd);
        const list = Object.entries(servers).map(
          ([name, def]) => `- ${name}: ${def.command} ${(def.args ?? []).join(" ")}`,
        );
        return {
          content: [{ type: "text", text: list.length ? `已配置的 MCP server:\n${list.join("\n")}` : "未配置任何 MCP server(在项目根或 ~/.config/mcp/mcp.json 加 .mcp.json)" }],
          details: {},
        };
      } catch (e) {
        return { content: [{ type: "text", text: `读取配置失败: ${e instanceof Error ? e.message : e}` }], details: {} };
      }
    },
  });

  // 工具 2:连接某 server 列出它的工具
  pi.registerTool({
    name: "mcp_tools",
    label: "MCP 工具列表",
    description: "连接某个 MCP server 并列出它提供的工具(含工具名、描述、参数 schema)。先用 mcp_servers 看 server 名。",
    parameters: Type.Object({
      server: Type.String({ description: "server 名(mcp_servers 返回的)" }),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        const servers = await loadServers(ctx.cwd);
        const name = String(params.server ?? "");
        const def = servers[name];
        if (!def) return { content: [{ type: "text", text: `未找到 server "${name}"` }], details: {} };
        const client = await connectServer(name, def);
        const { tools } = await client.listTools();
        const lines = (tools ?? []).map(
          (t) => `- ${t.name}: ${t.description ?? ""}`,
        );
        return {
          content: [{ type: "text", text: lines.length ? `${name} 的工具:\n${lines.join("\n")}` : `${name} 没有工具` }],
          details: {},
        };
      } catch (e) {
        return { content: [{ type: "text", text: `连接/列工具失败: ${e instanceof Error ? e.message : e}` }], details: {} };
      }
    },
  });

  // 工具 3:调用某 server 的某工具
  pi.registerTool({
    name: "mcp_call",
    label: "MCP 调用工具",
    description: "调用某个 MCP server 的某个工具。先用 mcp_servers 看 server、mcp_tools 看工具名和参数。",
    parameters: Type.Object({
      server: Type.String({ description: "server 名" }),
      tool: Type.String({ description: "要调用的工具名" }),
      arguments: Type.Optional(Type.Record(Type.String(), Type.Any(), { description: "工具参数(JSON 对象)" })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        const servers = await loadServers(ctx.cwd);
        const name = String(params.server ?? "");
        const tool = String(params.tool ?? "");
        const def = servers[name];
        if (!def) return { content: [{ type: "text", text: `未找到 server "${name}"` }], details: {} };
        const client = await connectServer(name, def);
        const result = await client.callTool({ name: tool, arguments: (params.arguments as Record<string, unknown>) ?? {} });
        const text = (result.content ?? [])
          .map((c) => (c.type === "text" ? c.text : JSON.stringify(c)))
          .join("\n");
        return { content: [{ type: "text", text: text || "(无输出)" }], details: {} };
      } catch (e) {
        return { content: [{ type: "text", text: `调用失败: ${e instanceof Error ? e.message : e}` }], details: {} };
      }
    },
  });
}
