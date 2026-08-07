import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * 内置扩展注册中心。
 *
 * 分两类:
 *  - CORE_TOOLS: LXCode 内部核心工具(视觉识别/网页搜索),始终启用,不进设置页开关。
 *  - BUILTIN_EXTENSIONS: 可选扩展(CodeGraph),用户可在设置里关闭。
 *
 * 新增扩展只需在本目录下建子目录(含 extension.ts 工厂),并按类别加数组一项。
 * session-lifecycle.ts / workspace-lifecycle.ts 经 load-builtin.ts 挂载到
 * DefaultResourceLoader.extensionFactories。
 */
export type BuiltinExtensionEntry = {
  /** 唯一 id,对应设置开关的 key。 */
  id: string;
  /** 显示名(给 UI 用,host 不直接用)。 */
  name: string;
  /** pi 扩展工厂。动态 import 避免未启用扩展也被加载。 */
  factory: () => Promise<{ default: (pi: ExtensionAPI) => void }>;
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

/** 可选内置扩展(用户可开关)。 */
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
 * 过滤出启用的可选内置扩展(根据用户设置)。
 * settings 是 { [extensionId]: boolean },false=禁用,缺省/true=启用。
 */
export function enabledBuiltinExtensions(
  disabled: Record<string, boolean> | null | undefined,
): BuiltinExtensionEntry[] {
  if (!disabled) return BUILTIN_EXTENSIONS;
  return BUILTIN_EXTENSIONS.filter((ext) => disabled[ext.id] !== false);
}
