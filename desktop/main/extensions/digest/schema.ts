/**
 * digest.json Schema —— 项目功能地图的结构化契约。
 *
 * 这个文件是 digest 扩展(写) 和 LXCode UI(读) 之间的唯一契约。
 * 扩展产出 .lxcode/digest.json,LXCode 读它渲染三层折叠面板。
 * 阶段2 接入 codegraph 时,只补充带 ? 的可选字段,不破坏现有结构。
 *
 * 三层粒度:模块(全局) → 函数(排查定位) → 关键逻辑块(细节)。
 */

/** digest 文件根结构。 */
export interface DigestFile {
  /** Schema 版本,目前 1。字段语义变更才升级。 */
  version: 1;
  /** 生成时间 ISO 字符串。 */
  generatedAt: string;
  /** 触发方式:onboarding=首次全量,incremental=AI 写完后增量。 */
  trigger: "onboarding" | "incremental";
  /** 项目根目录(绝对路径)。 */
  cwd: string;
  /** 功能簇(按调用关系聚类,LLM 生成功能名)。主展示维度。 */
  features: FeatureCluster[];
  /** 模块总览(按目录,辅助维度)。 */
  modules: ModuleSummary[];
  /** 函数级摘要,按文件分组。key=相对 cwd 的文件路径。 */
  functions: Record<string, FunctionSummary[]>;
  /** 代码图谱来源。builtin=阶段1 AST,codegraph=阶段2 接入。 */
  provider: { name: "builtin" | "codegraph"; version: string };
  /** 阶段2 codegraph 才填充,阶段1 留空数组。 */
  callGraph?: CallGraphEntry[];
  /** 阶段2:框架/程序入口符号。 */
  entryPoints?: SymbolRef[];
}

/** 功能簇(按调用关系聚类,像 IDE 大纲按功能分组)。 */
export interface FeatureCluster {
  /** 簇名(LLM 生成,如"会话管理";无 LLM 用核心函数名)。 */
  name: string;
  /** 簇内函数(可能跨文件)。 */
  members: { file: string; fn: string }[];
  /** 内聚度(簇内调用数/函数数),越高越内聚。 */
  cohesion: number;
  /** 簇一句话功能描述(LLM 生成,可选)。 */
  what?: string;
}

/** 模块总览表的一行。 */
export interface ModuleSummary {
  /** 模块名(按目录或职责命名)。 */
  name: string;
  /** 代表路径(目录或核心文件,相对 cwd)。 */
  path: string;
  /** 一句话功能(白话,程序员轻松看懂)。 */
  what: string;
  /** 模块包含的文件(相对 cwd)。 */
  files: string[];
  /** 关联模块及关系描述,如 ["会话管理 ← 调用 → agent-service"]。 */
  related: string[];
}

/** 函数级摘要(排查问题的核心单位)。 */
export interface FunctionSummary {
  /** 所在文件(相对 cwd)。 */
  file: string;
  /** 函数/方法名。 */
  fn: string;
  /** 起止行号(精准定位,1-indexed)。 */
  startLine: number;
  endLine: number;
  /** 级别:core=核心逻辑 / util=工具 / ui=界面 / glue=胶水。 */
  level: "core" | "util" | "ui" | "glue";
  /** 一句话:这函数干嘛(白话)。 */
  what: string;
  /** 怎么实现的(白话 2-5 步)。 */
  how: string[];
  /** 关键逻辑/分支(只写非显然的,排查用)。可选,无则省。 */
  logic?: string[];
  /** 易踩坑点(复用 LXCode failure 记忆,排查最值钱)。可选。 */
  pitfalls?: string[];
  /** 调用关系。阶段1 靠 AST 填本文件内调用,阶段2 codegraph 补全跨文件。 */
  calls?: {
    calls: string[];
    calledBy: string[];
    /** 来源:ast=阶段1 内置解析,codegraph=阶段2 全量。 */
    source: "ast" | "codegraph";
  };
  /** 依赖外部(import/全局/配置)。可选。 */
  deps?: string[];
  /** 是否框架/程序入口。 */
  entry?: boolean;
  /** 关键逻辑块(辅单位,只摘易出问题的分支/循环/异步)。可选。 */
  blocks?: LogicBlock[];
}

/** 函数内的关键逻辑块(排查细节用,不是每个块都摘)。 */
export interface LogicBlock {
  /** 块的起止行号。 */
  lines: [number, number];
  /** 这块逻辑在干嘛/为什么这么写(白话)。 */
  what: string;
}

/** 代码符号引用(函数级)。 */
export interface SymbolRef {
  file: string;
  fn: string;
}

/** 调用图的一条边(阶段2 codegraph 填充)。 */
export interface CallGraphEntry {
  from: SymbolRef;
  to: SymbolRef;
}

/** digest 扩展的运行配置(.lxcode/digest-config.json)。LXCode 设置页写,扩展读。 */
export interface DigestConfig {
  /** 总开关。关 = 所有 handler 早返回 + 移除工具,零开销。 */
  enabled: boolean;
  /** agent_settled 后自动增量更新。 */
  autoUpdate: boolean;
  /** before_agent_start 注入 digest 到 systemPrompt。 */
  injectContext: boolean;
  /** 摘要生成用的模型(provider/id),空则复用当前 session 模型。 */
  summaryModel?: string;
}

/** 默认配置。 */
export const DEFAULT_DIGEST_CONFIG: DigestConfig = {
  enabled: true,
  autoUpdate: true,
  injectContext: true,
};

/** LXCode ↔ digest 扩展的热插拔事件名。LXCode 主进程用 eventBus.emit 此事件传配置变更。 */
export const DIGEST_CONFIG_EVENT = "lxcode:digest-config";
