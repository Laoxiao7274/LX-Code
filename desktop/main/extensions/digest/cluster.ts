/**
 * 功能聚类 —— 文件级标签传播(对齐 Glue 的文件聚类做法)。
 *
 * 节点=文件,边=文件间依赖(import + 跨文件函数调用)。
 * 文件依赖图比函数调用图稳定,聚成 20-40 个功能簇(不像函数级聚出 178 碎簇)。
 *
 * 参考 Glue:Louvain 聚 4000 文件成 23 功能;我们用标签传播(纯JS,效果接近)。
 * 命名:启发式(入口文件名+高频术语→中文),LLM 只给大簇命名(降成本)。
 */

/** 一个文件节点。 */
export interface FileNode {
  file: string;
  /** 被多少文件依赖(import/调用),用于选簇种子。 */
  inDegree: number;
}

/** 文件间依赖边(fileA 依赖 fileB)。 */
export interface FileEdge {
  from: string;
  to: string;
  /** 边权重:import=1.0, 跨文件调用=0.8。 */
  weight: number;
}

/** 一个功能簇(按文件聚类)。 */
export interface FeatureCluster {
  id: string;
  name: string;
  /** 簇内文件。 */
  files: string[];
  /** 簇内函数(从 files 展开,由调用方填充)。 */
  members: { file: string; fn: string }[];
  cohesion: number;
  what?: string;
}

/** 小簇归"其他"阈值。 */
const MIN_CLUSTER_SIZE = 2;

/** 文件级标签传播聚类。 */
export function clusterByFiles(
  files: FileNode[],
  edges: FileEdge[],
  /** 文件→该文件的函数名列表(用于展开簇成员)。 */
  fnsByFile: Record<string, string[]>,
): FeatureCluster[] {
  // 1. 建邻接表(无向,带权重)
  const adj = new Map<string, Map<string, number>>();
  for (const f of files) adj.set(f.file, new Map());
  for (const e of edges) {
    if (e.from === e.to) continue;
    const a = adj.get(e.from);
    const b = adj.get(e.to);
    if (a) a.set(e.to, (a.get(e.to) ?? 0) + e.weight);
    if (b) b.set(e.from, (b.get(e.from) ?? 0) + e.weight);
  }

  // 2. 标签传播
  let labels = new Map<string, string>();
  for (const f of files) labels.set(f.file, f.file);
  const MAX_ITER = 15;
  for (let iter = 0; iter < MAX_ITER; iter++) {
    let changed = false;
    const order = [...labels.keys()].sort(() => Math.random() - 0.5);
    for (const id of order) {
      const neighbors = adj.get(id);
      if (!neighbors || neighbors.size === 0) continue;
      // 加权统计邻居标签
      const counts = new Map<string, number>();
      for (const [nb, w] of neighbors) {
        const l = labels.get(nb);
        if (l) counts.set(l, (counts.get(l) ?? 0) + w);
      }
      if (counts.size === 0) continue;
      let best = "";
      let bestW = -1;
      for (const [l, w] of counts) {
        if (w > bestW || (w === bestW && l < best)) { best = l; bestW = w; }
      }
      if (best && labels.get(id) !== best) { labels.set(id, best); changed = true; }
    }
    if (!changed) break;
  }

  // 3. 按标签分组文件
  const groups = new Map<string, string[]>();
  for (const [file, label] of labels) {
    let arr = groups.get(label);
    if (!arr) { arr = []; groups.set(label, arr); }
    arr.push(file);
  }

  // 4. 构造簇 + 小簇归"其他" + 启发式命名
  const fileInDegree = new Map(files.map((f) => [f.file, f.inDegree]));
  const clusters: FeatureCluster[] = [];
  const leftovers: string[] = [];

  for (const [label, fileList] of groups) {
    if (fileList.length < MIN_CLUSTER_SIZE) {
      leftovers.push(...fileList);
      continue;
    }
    // 大簇(>8文件)按一级目录二次拆分,避免 UI 组件密集互连聚成巨型簇
    if (fileList.length > 8) {
      const byDir = new Map<string, string[]>();
      for (const file of fileList) {
        const dir = file.includes("/") ? file.split("/")[0] : "(root)";
        if (!byDir.has(dir)) byDir.set(dir, []);
        byDir.get(dir)!.push(file);
      }
      for (const [dir, dirFiles] of byDir) {
        if (dirFiles.length >= MIN_CLUSTER_SIZE) {
          clusters.push(makeFileCluster(`${label}:${dir}`, dirFiles, edges, fnsByFile, fileInDegree));
        } else {
          leftovers.push(...dirFiles);
        }
      }
    } else {
      clusters.push(makeFileCluster(label, fileList, edges, fnsByFile, fileInDegree));
    }
  }
  if (leftovers.length > 0) {
    const c = makeFileCluster("__other__", leftovers, edges, fnsByFile, fileInDegree);
    c.name = "其他功能";
    clusters.push(c);
  }

  clusters.sort((a, b) => b.files.length - a.files.length);
  return clusters;
}

/** 构造一个文件簇 + 启发式命名。 */
function makeFileCluster(
  id: string,
  fileList: string[],
  edges: FileEdge[],
  fnsByFile: Record<string, string[]>,
  fileInDegree: Map<string, number>,
): FeatureCluster {
  const fileSet = new Set(fileList);
  // 簇内函数
  const members: { file: string; fn: string }[] = [];
  for (const file of fileList) {
    for (const fn of fnsByFile[file] ?? []) members.push({ file, fn });
  }
  // 内聚度 = 簇内边权重和 / 文件数
  let internalW = 0;
  for (const e of edges) {
    if (fileSet.has(e.from) && fileSet.has(e.to)) internalW += e.weight;
  }
  const cohesion = fileList.length > 0 ? internalW / fileList.length : 0;

  // 启发式命名:入口文件名 + 所在目录(避免不同目录同名文件导致簇名重复)
  let name = "";
  if (id !== "__other__") {
    const entry = [...fileList].sort((a, b) => (fileInDegree.get(b) ?? 0) - (fileInDegree.get(a) ?? 0))[0];
    name = entry ? dirPrefix(entry) + baseName(entry) : "功能组";
  }
  return { id, name, files: fileList, members, cohesion };
}

/** 取文件名(去扩展名/路径),如 desktop/main/agent-service.ts -> agent-service。 */
function baseName(file: string): string {
  const f = file.split("/").pop() ?? file;
  return f.replace(/\.\w+$/, "");
}

/** 取文件所在的一级目录前缀(避免不同目录同名文件簇名重复),如 src/types.ts -> src/, desktop/main/x.ts -> main/。 */
function dirPrefix(file: string): string {
  const parts = file.split("/");
  if (parts.length <= 1) return "";
  // 用一级目录(若一级是 src 则用二级),让名字更有区分度
  let dir = parts[0];
  if (dir === "src" && parts.length > 2) dir = parts[1];
  return dir + "/";
}
