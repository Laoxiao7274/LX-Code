import { create } from "zustand";

/** 任务状态。 */
export type TaskStatus = "running" | "done" | "waiting" | "error";

/** 任务执行流的一个步骤。 */
export interface TaskStep {
  id: string;
  type: "goal" | "thinking" | "tool" | "text";
  text?: string;
  /** tool 步骤专用。 */
  toolName?: string;
  toolArg?: string;
  toolOutput?: string[];
  toolStatus?: "running" | "ok" | "error";
  toolTiming?: string;
  streaming?: boolean;
}

/** 一个 Agent 任务(等价于 Agent 模式的"会话")。 */
export interface AgentTask {
  id: string;
  /** 一句话目标。 */
  title: string;
  status: TaskStatus;
  /** 已完成步骤数 / 总步骤数(进度)。 */
  doneSteps: number;
  totalSteps: number;
  updatedAt: number;
  steps: TaskStep[];
}

interface AgentState {
  tasks: AgentTask[];
  activeId: string | null;
  select: (id: string) => void;
  create: () => void;
  /** 在当前任务追加一个模拟的执行流(思考→工具→结果)。 */
  runTask: (goal: string) => void;
}

let seed = 0;
const nid = () => `task${++seed}`;

const NOW = Date.now();

const DEMO_TASKS: AgentTask[] = [
  {
    id: "task-demo1",
    title: "给 filter 函数加单元测试",
    status: "done",
    doneSteps: 4,
    totalSteps: 4,
    updatedAt: NOW - 3600_000,
    steps: [
      { id: "s1", type: "goal", text: "给 filter 函数加单元测试" },
      { id: "s2", type: "thinking", text: "先看 filter 函数实现,再设计测试用例:正常过滤、空数组、无匹配。" },
      { id: "s3", type: "tool", toolName: "read", toolArg: "src/utils/filter.ts", toolStatus: "ok", toolTiming: "0.4s", toolOutput: ["已读取 7 行"] },
      { id: "s4", type: "tool", toolName: "write", toolArg: "tests/filter.test.ts", toolStatus: "ok", toolTiming: "0.6s", toolOutput: ["已创建 tests/filter.test.ts (412 B)"] },
      { id: "s5", type: "text", text: "已添加 3 个测试用例,覆盖正常过滤、空数组、无匹配场景。" },
    ],
  },
  {
    id: "task-demo2",
    title: "重构 API 模块用 fetch 替代 axios",
    status: "running",
    doneSteps: 2,
    totalSteps: 5,
    updatedAt: NOW - 120_000,
    steps: [
      { id: "s1", type: "goal", text: "重构 API 模块用 fetch 替代 axios" },
      { id: "s2", type: "thinking", text: "扫描所有 axios 引用,逐个替换为 fetch,保持接口兼容。", streaming: false },
      { id: "s3", type: "tool", toolName: "grep", toolArg: "import.*axios", toolStatus: "ok", toolTiming: "0.3s", toolOutput: ["src/api/client.ts:1", "src/api/user.ts:2"] },
      { id: "s4", type: "tool", toolName: "edit", toolArg: "src/api/client.ts", toolStatus: "running" },
    ],
  },
];

export const useAgentStore = create<AgentState>((set, get) => ({
  tasks: DEMO_TASKS,
  activeId: "task-demo2",

  select: (id) => set({ activeId: id }),

  create: () => {
    const id = nid();
    const task: AgentTask = {
      id,
      title: "新任务",
      status: "waiting",
      doneSteps: 0,
      totalSteps: 0,
      updatedAt: Date.now(),
      steps: [],
    };
    set({ tasks: [task, ...get().tasks], activeId: id });
  },

  runTask: (goal) => {
    const id = get().activeId;
    if (!id) return;
    const stepId = () => `s${++seed}`;

    // 在当前任务下追加执行流
    const appendStep = (step: TaskStep) =>
      set({
        tasks: get().tasks.map((t) =>
          t.id === id ? { ...t, steps: [...t.steps, step], updatedAt: Date.now() } : t,
        ),
      });
    const updateTask = (patch: Partial<AgentTask>) =>
      set({ tasks: get().tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) });

    updateTask({ title: goal, status: "running", totalSteps: 3, doneSteps: 0 });
    appendStep({ id: stepId(), type: "goal", text: goal });

    // 思考
    const thinkId = stepId();
    appendStep({ id: thinkId, type: "thinking", text: "", streaming: true });
    const THINK = "分析任务,制定执行计划:先读取相关文件,再做修改,最后验证。";
    let i = 0;
    const thinkTimer = setInterval(() => {
      i += 2;
      set({
        tasks: get().tasks.map((t) =>
          t.id === id
            ? { ...t, steps: t.steps.map((s) => (s.id === thinkId ? { ...s, text: THINK.slice(0, i) } : s)) }
            : t,
        ),
      });
      if (i >= THINK.length) {
        clearInterval(thinkTimer);
        set({
          tasks: get().tasks.map((t) =>
            t.id === id
              ? { ...t, steps: t.steps.map((s) => (s.id === thinkId ? { ...s, streaming: false } : s)) }
              : t,
          ),
        });

        // 工具调用
        const toolId = stepId();
        appendStep({ id: toolId, type: "tool", toolName: "read", toolArg: "src/main.ts", toolStatus: "running" });
        setTimeout(() => {
          set({
            tasks: get().tasks.map((t) =>
              t.id === id
                ? {
                    ...t,
                    doneSteps: 1,
                    steps: t.steps.map((s) =>
                      s.id === toolId
                        ? { ...s, toolStatus: "ok", toolTiming: "0.7s", toolOutput: ["已读取 src/main.ts"] }
                        : s,
                    ),
                  }
                : t,
            ),
          });

          // 结果
          const textId = stepId();
          appendStep({ id: textId, type: "text", text: "", streaming: true });
          const RESULT = "任务完成。已读取相关文件并完成修改。";
          let j = 0;
          const textTimer = setInterval(() => {
            j += 2;
            set({
              tasks: get().tasks.map((t) =>
                t.id === id
                  ? { ...t, steps: t.steps.map((s) => (s.id === textId ? { ...s, text: RESULT.slice(0, j) } : s)) }
                  : t,
              ),
            });
            if (j >= RESULT.length) {
              clearInterval(textTimer);
              updateTask({ status: "done", doneSteps: 3 });
              set({
                tasks: get().tasks.map((t) =>
                  t.id === id
                    ? { ...t, steps: t.steps.map((s) => (s.id === textId ? { ...s, streaming: false } : s)) }
                    : t,
                ),
              });
            }
          }, 30);
        }, 800);
      }
    }, 24);
  },
}));
