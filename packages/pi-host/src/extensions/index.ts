import { createRequire } from "node:module";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * 内置扩展注册中心。
 *
 * 分三类:
 *  - CORE_TOOLS: LXCode 内部核心工具(视觉识别/网页搜索),始终启用,不进设置页开关。
 *  - BUILTIN_EXTENSIONS: 可选内置扩展(CodeGraph/auto-git),LXCode 自带工厂,用户可在设置里关闭。
 *  - BUILTIN_PATH_EXTENSIONS: 可选内置扩展(MCP),由第三方 pi 包(pi-mcp-adapter)
 *    提供 .ts 源码,须经 Pi 的 jiti 加载器加载(裸 Node 无法直接 import)。用户可在设置里关闭。
 *
 * 新增 inline 工厂扩展只需在本目录下建子目录(含 extension.ts 工厂),并按类别加数组一项。
 * 新增 path 型扩展(第三方 pi 包)加到 BUILTIN_PATH_EXTENSIONS,并在 load-builtin.ts 的
 * loadBuiltinExtensionPaths 里提供其运行时定位逻辑。
 * session-lifecycle.ts / workspace-lifecycle.ts 经 load-builtin.ts 挂载到
 * DefaultResourceLoader(extensionFactories + additionalExtensionPaths)。
 */
export type BuiltinExtensionEntry = {
  /** 唯一 id,对应设置开关的 key。 */
  id: string;
  /** 显示名(给 UI 用,host 不直接用)。 */
  name: string;
  /** pi 扩展工厂。动态 import 避免未启用扩展也被加载。 */
  factory: () => Promise<{ default: (pi: ExtensionAPI) => void }>;
};

/** path 型内置扩展:第三方 pi 包,.ts 源码由 Pi jiti 加载,无法走 inline factory。 */
export type BuiltinPathExtensionEntry = {
  /** 唯一 id,对应设置开关的 key(与 inline 类共用 builtin-extensions.json 命名空间)。 */
  id: string;
  /** 显示名(给 UI 用,host 不直接用)。 */
  name: string;
  /** 运行时定位包目录的绝对路径,交给 DefaultResourceLoader.additionalExtensionPaths。 */
  resolvePath: () => string | null;
};

/** LXCode 内部核心工具:始终启用,不显示在设置开关里。 */
export const CORE_TOOLS: BuiltinExtensionEntry[] = [
  {
    id: "vision-tool",
    name: "视觉识别工具",
    factory: () => import("./vision-tool/extension.js"),
  },
  {
    id: "web-access",
    name: "网页搜索",
    factory: () => import("./web-access/extension.js"),
  },
  {
    id: "test-flow",
    name: "测试流程引导",
    factory: () => import("./test-flow/extension.js"),
  },
];

/** 可选内置扩展(inline 工厂,用户可开关)。 */
export const BUILTIN_EXTENSIONS: BuiltinExtensionEntry[] = [
  {
    id: "codegraph",
    name: "CodeGraph 代码图谱",
    factory: () => import("./codegraph/extension.js"),
  },
  {
    id: "auto-git",
    name: "自动 Git 提交",
    factory: () => import("./auto-git/extension.js"),
  },
];

/**
 * 可选内置扩展(path 型,第三方 pi 包经 jiti 加载,用户可开关)。
 * resolvePath 在运行时定位包目录;返回 null 表示包不可用(跳过,不报错)。
 */
export const BUILTIN_PATH_EXTENSIONS: BuiltinPathExtensionEntry[] = [
  {
    id: "mcp",
    name: "MCP 服务器",
    // pi-mcp-adapter 发纯 .ts 源码,由 Pi 的 jiti 加载器加载。
    // 运行时从 pi-host 自身 node_modules 定位包目录,交给 DefaultResourceLoader
    // 的 additionalExtensionPaths → resolveExtensionEntries 读 package.json 的
    // pi.extensions → jiti.import(./index.ts)。默认读 PI_CODING_AGENT_DIR/mcp.json
    // (由 mcp-defaults.ts 维护),无需程序化传 configPath。
    resolvePath: () => resolveMcpAdapterPath(),
  },
];

/**
 * 运行时定位 pi-mcp-adapter 包目录。
 *
 * pi-mcp-adapter 发布纯 .ts 源码(package.json exports → ./index.ts),裸 Node 无法
 * 直接 import,必须经 Pi 的 jiti 加载器。本函数用 createRequire 从 pi-host 自身
 * (运行此模块的文件)出发 resolve 包入口,取其目录,交给 DefaultResourceLoader 的
 * additionalExtensionPaths → resolveExtensionEntries 读 package.json 的 pi.extensions
 * → jiti.import(./index.ts)。
 *
 * release(pnpm deploy --prod)后包在 pi-host node_modules/pi-mcp-adapter;
 * 开发(tsx)与 release 都能经 createRequire 正确 resolve。返回 null 表示不可用。
 */
export function resolveMcpAdapterPath(): string | null {
  try {
    const require = createRequire(import.meta.url);
    const entry = require.resolve("pi-mcp-adapter");
    return dirname(entry);
  } catch {
    return null;
  }
}

/**
 * 过滤出启用的可选内置扩展(inline 工厂,根据用户设置)。
 * settings 是 { [extensionId]: boolean },false=禁用,缺省/true=启用。
 */
export function enabledBuiltinExtensions(
  disabled: Record<string, boolean> | null | undefined,
): BuiltinExtensionEntry[] {
  if (!disabled) return BUILTIN_EXTENSIONS;
  return BUILTIN_EXTENSIONS.filter((ext) => disabled[ext.id] !== false);
}

/**
 * 过滤出启用的 path 型内置扩展(根据用户设置,同 enabledBuiltinExtensions 语义)。
 */
export function enabledBuiltinPathExtensions(
  disabled: Record<string, boolean> | null | undefined,
): BuiltinPathExtensionEntry[] {
  if (!disabled) return BUILTIN_PATH_EXTENSIONS;
  return BUILTIN_PATH_EXTENSIONS.filter((ext) => disabled[ext.id] !== false);
}
