/**
 * 功能聚类 —— 标签传播算法(Label Propagation),纯 JS,不引库。
 *
 * 用 calls/calledBy 关系建无向图,把互相调用的函数聚成功能簇。
 * 比连通分量好:会切大簇(入口函数能调到所有,连通分量会聚成一个巨型);
 * 比 Leiden 简单:几十行,无需图数据库,效果接近。
 *
 * 参考:pi-code-graph 用 Leiden(图数据库),fallback 按目录;我们用标签传播。
 * minSize<2 的碎簇归"其他"(对齐 pi-code-graph minSize=2 共识)。
 */

/** 一个函数节点(全局唯一标识 = file:fn)。 */
export interface FnNode {
  /** 唯一 id: `${file}:${fn}`。 */
  id: string;
  file: string;
  fn: string;
  level: "core" | "util" | "ui" | "glue";
  /** 被调用次数(全局,用于选簇种子)。 */
  inDegree: number;
}

/** 一个功能簇。 */
export interface FeatureCluster {
  /** 簇 id(标签传播收敛后的标签)。 */
  id: string;
  /** 簇名(LLM 生成,如"会话管理";无 LLM 时用种子函数名)。 */
  name: string;
  /** 簇内函数。 */
  members: FnNode[];
  /** 内聚度 = 簇内调用数 / 函数数(越高越内聚)。 */
  cohesion: number;
}

/** 大簇拆分阈值。 */
const MAX_CLUSTER_SIZE = 20;
/** 小簇归"其他"阈值。 */
const MIN_CLUSTER_SIZE = 2;

/** 标签传播聚类。输入函数节点 + 调用边(calls),输出功能簇。 */
export function clusterByCallGraph(
  nodes: FnNode[],
  /** 调用边:from 调用 to(from/to 都是 fn 名,非 file:fn)。 */
  callEdges: Array<{ from: FnNode; to: FnNode }>,
): FeatureCluster[] {
  // 1. 建邻接表(无向图:from-to 互连)
  const adj = new Map<string, Set<string>>();
  for (const n of nodes) adj.set(n.id, new Set());
  for (const e of callEdges) {
    adj.get(e.from.id)?.add(e.to.id);
    adj.get(e.to.id)?.add(e.from.id);
  }

  // 2. 标签传播:初始标签=节点自身 id,迭代取邻居最多标签
  let labels = new Map<string, string>();
  for (const n of nodes) labels.set(n.id, n.id);
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  const MAX_ITER = 10;
  for (let iter = 0; iter < MAX_ITER; iter++) {
    let changed = false;
    // 随机顺序遍历(用 id 哈希扰动,避免顺序偏差)
    const order = [...labels.keys()].sort(() => Math.random() - 0.5);
    for (const id of order) {
      const neighbors = adj.get(id);
      if (!neighbors || neighbors.size === 0) continue;
      // 统计邻居标签出现次数
      const counts = new Map<string, number>();
      for (const nb of neighbors) {
        const l = labels.get(nb);
        if (l) counts.set(l, (counts.get(l) ?? 0) + 1);
      }
      if (counts.size === 0) continue;
      // 取最多(平局取标签字符串最小,保证确定收敛)
      let best = "";
      let bestCount = -1;
      for (const [l, c] of counts) {
        if (c > bestCount || (c === bestCount && l < best)) {
          best = l;
          bestCount = c;
        }
      }
      if (best && labels.get(id) !== best) {
        labels.set(id, best);
        changed = true;
      }
    }
    if (!changed) break;
  }

  // 3. 按标签分组
  const groups = new Map<string, FnNode[]>();
  for (const [id, label] of labels) {
    const n = nodeById.get(id);
    if (!n) continue;
    let arr = groups.get(label);
    if (!arr) {
      arr = [];
      groups.set(label, arr);
    }
    arr.push(n);
  }

  // 4. 后处理:大簇拆分、小簇归"其他"、算 cohesion
  const clusters: FeatureCluster[] = [];
  const leftovers: FnNode[] = [];

  for (const [label, members] of groups) {
    if (members.length < MIN_CLUSTER_SIZE) {
      leftovers.push(...members);
      continue;
    }
    if (members.length > MAX_CLUSTER_SIZE) {
      // 大簇按 level 拆:core 一组,其余一组
      const coreGrp = members.filter((m) => m.level === "core");
      const otherGrp = members.filter((m) => m.level !== "core");
      if (coreGrp.length >= MIN_CLUSTER_SIZE) clusters.push(makeCluster(`${label}:core`, coreGrp, callEdges));
      else leftovers.push(...coreGrp);
      if (otherGrp.length >= MIN_CLUSTER_SIZE) clusters.push(makeCluster(`${label}:other`, otherGrp, callEdges));
      else leftovers.push(...otherGrp);
    } else {
      clusters.push(makeCluster(label, members, callEdges));
    }
  }

  // 碎簇归"其他"
  if (leftovers.length > 0) {
    clusters.push(makeCluster("__other__", leftovers, callEdges));
  }

  // 5. 簇名:用被调用最多的 core 函数名作种子(无 LLM 时的占位名)
  for (const c of clusters) {
    if (c.id === "__other__") {
      c.name = "其他";
      continue;
    }
    const seed = [...c.members].sort((a, b) => b.inDegree - a.inDegree)[0];
    c.name = seed ? `${seed.fn} 簇` : c.id;
  }

  // 按成员数降序
  clusters.sort((a, b) => b.members.length - a.members.length);
  return clusters;
}

/** 算一个簇的内聚度 = 簇内调用边数 / 成员数。 */
function makeCluster(id: string, members: FnNode[], callEdges: Array<{ from: FnNode; to: FnNode }>): FeatureCluster {
  const memberIds = new Set(members.map((m) => m.id));
  let internal = 0;
  for (const e of callEdges) {
    if (memberIds.has(e.from.id) && memberIds.has(e.to.id)) internal++;
  }
  return {
    id,
    name: "",
    members,
    cohesion: members.length > 0 ? internal / members.length : 0,
  };
}
