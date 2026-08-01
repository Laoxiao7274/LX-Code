/** 工具显示元数据:从工具名+参数+输出提取人类可读的 summary 和统计 chip。 */

export interface ToolMeta {
  /** 折叠时显示的精简描述(一行,带语义)。 */
  summary: string;
  /** 展开时显示的完整描述(可换行)。 */
  summaryFull?: string;
  /** 结果统计 chip,如 "+12 −3" / "3 处匹配" / "exit 0"。 */
  chip?: string;
}

const clip = (s: string, max = 64) => (s.length > max ? s.slice(0, max - 1) + "…" : s);
const lastSeg = (p: string) => p.split("/").filter(Boolean).pop() ?? p;

/** 从 output 里数匹配行(grep)或文件行数(read)。 */
function countMatches(output?: string[]): number {
  if (!output) return 0;
  return output.filter((l) => l.trim() && /:\d+/.test(l)).length;
}

/** 从 edit output 里数 +/- 行。 */
function countDiff(output?: string[]): { added: number; removed: number } {
  if (!output) return { added: 0, removed: 0 };
  let added = 0;
  let removed = 0;
  for (const line of output) {
    if (/^\s*\+/.test(line) && !/^\s*\+\+\+/.test(line)) added++;
    if (/^\s*-/.test(line) && !/^\s*---/.test(line)) removed++;
  }
  return { added, removed };
}

/**
 * 按工具类型提取显示元数据。
 * arg 可能是文件路径、命令、或 JSON 字符串。
 */
export function toolMeta(name: string, arg: string, output?: string[], status?: string): ToolMeta {
  const n = name.toLowerCase();
  const base: ToolMeta = { summary: arg, summaryFull: arg };

  switch (n) {
    case "read": {
      const lines = output?.find((l) => /行|lines|读取/.test(l)) ?? "";
      const m = lines.match(/(\d+)\s*行/);
      const cnt = m ? m[1] : output ? `${output.length}` : "";
      return {
        summary: lastSeg(arg),
        summaryFull: arg,
        chip: cnt ? `${cnt} 行` : undefined,
      };
    }
    case "write": {
      const size = output?.find((l) => /B|字节|bytes/.test(l)) ?? "";
      const m = size.match(/(\d+)\s*(B|字节)/);
      return {
        summary: lastSeg(arg),
        summaryFull: arg,
        chip: m ? `${m[1]} ${m[2]}` : "已创建",
      };
    }
    case "edit":
    case "multi_edit": {
      const { added, removed } = countDiff(output);
      return {
        summary: lastSeg(arg),
        summaryFull: arg,
        chip: status === "error" ? undefined : added || removed ? `+${added} −${removed}` : undefined,
      };
    }
    case "bash": {
      return {
        summary: clip(arg, 56),
        summaryFull: arg,
        chip: status === "error" ? "exit 1" : "exit 0",
      };
    }
    case "grep": {
      const matches = countMatches(output);
      return {
        summary: clip(arg, 56),
        summaryFull: arg,
        chip: matches ? `${matches} 处匹配` : "无匹配",
      };
    }
    case "glob":
    case "ls": {
      const cnt = output?.filter((l) => l.trim()).length ?? 0;
      return {
        summary: lastSeg(arg) || n,
        summaryFull: arg,
        chip: cnt ? `${cnt} 项` : undefined,
      };
    }
    default:
      return base;
  }
}
