/**
 * 内置默认 MCP server 配置 —— 确保 LXCode 默认提供 chrome-devtools-mcp(浏览器自动化测试),
 * 用户无需在每个项目手动配 .mcp.json。
 *
 * 写入 ~/.lxcode/mcp.json(pi-mcp-adapter 的 pi-global override,所有项目共享)。
 * merge 策略:已存在的 server 保留(不覆盖用户配置),只补缺失的内置 server。
 * 在 pi-host 启动早期(setCurrent 之前)调用,确保 pi-mcp-adapter 加载时读到。
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

/** 内置默认 MCP server(用户可在 ~/.lxcode/mcp.json 删除条目或改参数来禁用/调整)。 */
const BUILTIN_MCP_SERVERS: Record<string, { command: string; args: string[]; env?: Record<string, string> }> = {
  // chrome-devtools-mcp:Google 官方,启动无头 Chrome 供 AI 自动化测试/性能分析。
  // --headless:无头不弹窗(自动化测试默认无头;要看页面改 args 去掉 --headless)。
  // 可选:--browser-url=<url> 连接已有 Chrome;--auto-connect 连本地已运行 Chrome;
  //       --isolated 隔离 profile;--channel=canary 用 Canary。
  "chrome-devtools": {
    command: "npx",
    args: ["-y", "chrome-devtools-mcp@latest", "--headless"],
  },
};

type McpConfig = {
  mcpServers?: Record<string, { command: string; args?: string[]; env?: Record<string, string> }>;
};

/**
 * 确保 agentDir/mcp.json 含内置默认 server(merge,不覆盖用户已有)。
 * 返回写入的路径(成功)或 null(失败)。
 */
export function ensureDefaultMcpConfig(agentDir: string): string | null {
  try {
    if (!existsSync(agentDir)) mkdirSync(agentDir, { recursive: true });
    const path = join(agentDir, "mcp.json");
    let config: McpConfig = {};
    if (existsSync(path)) {
      try {
        const raw = JSON.parse(readFileSync(path, "utf8"));
        if (raw && typeof raw === "object" && !Array.isArray(raw)) config = raw as McpConfig;
      } catch {
        // 文件损坏,用空配置重写(保留备份在下方)
        try { writeFileSync(`${path}.bak`, readFileSync(path, "utf8"), "utf8"); } catch { /* 静默 */ }
      }
    }
    if (!config.mcpServers || typeof config.mcpServers !== "object") config.mcpServers = {};
    let changed = false;
    for (const [name, def] of Object.entries(BUILTIN_MCP_SERVERS)) {
      // 用户已配同名 server(或显式置 null 删除)则跳过
      if (name in config.mcpServers) continue;
      config.mcpServers[name] = { command: def.command, args: def.args, ...(def.env ? { env: def.env } : {}) };
      changed = true;
    }
    if (changed) {
      writeFileSync(path, JSON.stringify(config, null, 2), "utf8");
    }
    return path;
  } catch {
    return null;
  }
}
