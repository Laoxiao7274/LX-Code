import type { ComponentType } from "react";
import type { WorkbenchEvent } from "@/components/workbench/events-sidebar";
import { AppShell } from "./app-shell";
import { useChatStore } from "./chat-store";
import { useSessionStore } from "./session-store";

export interface SceneDef {
  id: string;
  label: string;
  description?: string;
  /** 进入场景时执行:把应用置成对应状态 */
  enter?: () => void;
  /** 该场景可触发的事件 */
  events: WorkbenchEvent[];
  eventsHint?: string;
}

/** 构造一段长任务对话历史(6+ 轮,含多段思考+工具+长正文),用于验证对话堆叠后的样式。 */
function buildLongTaskMessages(): import("./chat-store").ChatMessage[] {
  let n = 0;
  const id = () => `lt${++n}`;
  const mk = (
    role: "user" | "assistant",
    parts?: import("./chat-store").MessagePart[],
    text?: string,
  ): import("./chat-store").ChatMessage => ({ id: id(), role, parts, text });
  return [
    mk("user", undefined, "帮我重构这个 React 项目,把所有 class 组件改成函数组件 + hooks。"),
    mk("assistant", [
      { type: "thinking", id: id(), text: "用户要重构整个项目。这是个大任务,我先扫描所有 class 组件,制定计划,再逐个迁移。先从入口 App.tsx 开始。", streaming: false },
      { type: "tool", id: id(), name: "grep", arg: "extends Component|extends React.Component", status: "ok", timing: "0.4s", output: ["src/App.tsx:3", "src/pages/Home.tsx:5", "src/pages/Login.tsx:4", "src/components/Header.tsx:2", "src/components/Sidebar.tsx:2"] },
      { type: "tool", id: id(), name: "read", arg: "src/App.tsx", status: "ok", timing: "0.3s", output: ["已读取 48 行"] },
      { type: "text", id: id(), text: "找到 5 个 class 组件。我先从入口 App.tsx 开始重构,它用了 state 和生命周期,需要转成 useState + useEffect。", streaming: false },
    ]),
    mk("user", undefined, "好的,先做 App.tsx 吧"),
    mk("assistant", [
      { type: "thinking", id: id(), text: "App.tsx 有两个 state(count 和 user)和一个 componentDidMount(请求数据)。迁移方案:useState 替代 state 对象,useEffect 替代生命周期,空依赖数组触发一次。", streaming: false },
      { type: "tool", id: id(), name: "edit", arg: "src/App.tsx", status: "ok", timing: "1.2s", output: ["- class App extends Component", "+ function App() {", "+   const [count, setCount] = useState(0)", "+   const [user, setUser] = useState(null)", "+   useEffect(() => { fetchUser() }, [])"] },
      { type: "text", id: id(), text: "App.tsx 已重构完成。主要改动:state 拆成两个 useState,componentDidMount 转成 useEffect(空依赖),render 方法直接 return。", streaming: false },
    ]),
    mk("user", undefined, "继续做 Home.tsx"),
    mk("assistant", [
      { type: "thinking", id: id(), text: "Home.tsx 比较复杂,有多个生命周期方法(componentDidMount + componentDidUpdate + componentWillUnmount)和 ref。需要拆成多个 useEffect,注意清理函数。", streaming: false },
      { type: "tool", id: id(), name: "read", arg: "src/pages/Home.tsx", status: "ok", timing: "0.5s", output: ["已读取 124 行"] },
      { type: "tool", id: id(), name: "edit", arg: "src/pages/Home.tsx", status: "ok", timing: "2.1s", output: ["重构完成,4 个 useEffect,1 个 useCallback"] },
      { type: "text", id: id(), text: "Home.tsx 完成。三个生命周期拆成了三个 useEffect:挂载时请求数据、props.userId 变化时重新请求、卸载时清理订阅。ref 转成了 useRef。", streaming: false },
    ]),
    mk("user", undefined, "Login 组件呢?它用了 context"),
    mk("assistant", [
      { type: "thinking", id: id(), text: "Login 组件用了 Context.Consumer 和 withRouter HOC。Context.Consumer 在函数组件里可以直接 useContext,withRouter 可以用 useRouter hook 替代。", streaming: false },
      { type: "tool", id: id(), name: "read", arg: "src/pages/Login.tsx", status: "ok", timing: "0.3s", output: ["已读取 67 行"] },
      { type: "tool", id: id(), name: "edit", arg: "src/pages/Login.tsx", status: "error", timing: "0.8s", output: ["Error: useRouter 只能在函数组件内使用,但 withRouter 包裹的仍是 class"] },
      { type: "thinking", id: id(), text: "报错了。我需要先去掉 withRouter 包裹,把组件改成函数,再用 useRouter。重新写一遍。", streaming: false },
      { type: "tool", id: id(), name: "edit", arg: "src/pages/Login.tsx", status: "ok", timing: "1.5s", output: ["移除 withRouter,改用 useRouter hook,Context.Consumer 改 useContext"] },
      { type: "text", id: id(), text: "Login.tsx 完成。遇到 withRouter 冲突已修复,Context.Consumer 换成 useContext 更简洁。", streaming: false },
    ]),
    mk("user", undefined, "现在还剩 Header 和 Sidebar 两个组件"),
    mk("assistant", [
      { type: "thinking", id: id(), text: "这两个是纯展示组件,没有 state 和生命周期,迁移最简单,直接改成函数返回 JSX 即可。", streaming: false },
      { type: "tool", id: id(), name: "edit", arg: "src/components/Header.tsx", status: "ok", timing: "0.6s", output: ["重构完成"] },
      { type: "tool", id: id(), name: "edit", arg: "src/components/Sidebar.tsx", status: "ok", timing: "0.7s", output: ["重构完成"] },
      { type: "tool", id: id(), name: "bash", arg: "pnpm build", status: "ok", timing: "4.2s", output: ["> vite build", "✓ 42 modules transformed", "dist/ 186.4 KiB"] },
      { type: "text", id: id(), text: "全部 5 个 class 组件已重构为函数组件 + hooks,build 通过。总结:App.tsx(2 个 useState + 1 个 useEffect)、Home.tsx(3 个 useEffect + useRef)、Login.tsx(useContext + useRouter)、Header/Sidebar(纯函数)。", streaming: false },
    ]),
  ];
}

/** 默认渲染整个应用框架。场景只切换应用内部状态。 */
export const SCENES: SceneDef[] = [
  {
    id: "idle",
    label: "空闲状态",
    description: "应用初始,无生成任务",
    enter: () => {
      useChatStore.getState().clear();
    },
    eventsHint: "应用级交互(点击生效于中栏应用)",
    events: [
      {
        id: "new-session",
        label: "新建会话",
        description: "左侧栏新增一条会话",
        handler: () => {
          useSessionStore.getState().create();
          return "已在侧栏新增会话";
        },
      },
      {
        id: "seed-msg",
        label: "填入示例对话",
        description: "加入两条示例消息",
        handler: () => {
          // 直接重置成示例消息
          useChatStore.setState({
            messages: [
              { id: "demo1", role: "user", text: "帮我看一下这个函数" },
              { id: "demo2", role: "assistant", text: "好的,请把代码贴出来。" },
            ],
            input: "",
            isGenerating: false,
          });
          return "已填入示例对话";
        },
      },
    ],
  },
  {
    id: "generating",
    label: "生成中",
    description: "正在流式生成回复",
    enter: () => {
      useChatStore.getState().clear();
      useChatStore.getState().setInput("解释这段代码");
      useChatStore.getState().send();
    },
    events: [
      {
        id: "abort",
        label: "中断生成",
        description: "停止当前流式回复",
        handler: () => {
          if (!useChatStore.getState().isGenerating) return "当前未在生成";
          useChatStore.getState().abort();
          return "已中断生成";
        },
      },
      {
        id: "send-another",
        label: "追加发送一条",
        description: "生成中排队一条消息",
        handler: () => {
          if (!useChatStore.getState().isGenerating) return "当前未在生成";
          return "已排队(生成完成后发送)";
        },
      },
    ],
  },
  {
    id: "permission",
    label: "权限请求",
    description: "工具调用触发权限确认",
    enter: () => {
      useChatStore.setState({
        messages: [
          { id: "p1", role: "user", text: "帮我创建 src/test.ts 文件" },
          {
            id: "p2",
            role: "assistant",
            streaming: false,
            parts: [
              {
                type: "thinking",
                id: "pt1",
                text: "用户要创建 src/test.ts。需要调用 write 工具,但这是文件写入操作,应先请求权限。",
                streaming: false,
              },
              {
                type: "tool",
                id: "pt2",
                name: "write",
                arg: "src/test.ts",
                status: "running",
              },
              {
                type: "text",
                id: "pt3",
                text: "需要创建文件 src/test.ts,等待你确认权限。",
                streaming: false,
              },
            ],
          },
        ],
        input: "",
        isGenerating: true,
      });
    },
    events: [
      {
        id: "allow",
        label: "允许执行",
        description: "放行此次工具调用",
        handler: () => {
          const msgs = useChatStore.getState().messages;
          useChatStore.setState({
            isGenerating: false,
            messages: msgs.map((m) =>
              m.id === "p2"
                ? {
                    ...m,
                    streaming: false,
                    parts: m.parts?.map((p) =>
                      p.type === "tool" && p.id === "pt2"
                        ? { ...p, status: "ok" as const, timing: "1.2s", output: ["已创建 src/test.ts (0 B)"] }
                        : p,
                    ),
                  }
                : m,
            ),
          });
          return "已允许,write 执行完成";
        },
      },
      {
        id: "deny",
        label: "拒绝执行",
        description: "拒绝此次工具调用",
        handler: () => "已拒绝,告知 agent 停止",
      },
    ],
  },
  {
    id: "long-task",
    label: "长任务",
    description: "多轮对话 + 思考 + 工具调用堆叠(看滚动/间距样式)",
    enter: () => {
      useChatStore.setState({
        messages: buildLongTaskMessages(),
        input: "",
        isGenerating: false,
      });
    },
    events: [
      {
        id: "scroll-top",
        label: "滚到顶部",
        description: "查看对话开头",
        handler: () => "已滚动到顶部(请手动滚查看历史)",
      },
      {
        id: "add-round",
        label: "追加一轮对话",
        description: "再加一轮完整对话(含思考+工具)",
        handler: () => {
          const msgs = useChatStore.getState().messages;
          let n = Date.now();
          const nid = () => `add${++n}`;
          useChatStore.setState({
            messages: [
              ...msgs,
              { id: nid(), role: "user", text: "帮我加上 TypeScript 类型定义" },
              {
                id: nid(),
                role: "assistant",
                parts: [
                  { type: "thinking", id: nid(), text: "需要给所有组件加 props 类型。先定义公共类型,再逐个组件加。", streaming: false },
                  { type: "tool", id: nid(), name: "read", arg: "src/types.ts", status: "ok", timing: "0.2s", output: ["文件不存在"] },
                  { type: "tool", id: nid(), name: "write", arg: "src/types.ts", status: "ok", timing: "0.4s", output: ["已创建 src/types.ts"] },
                  { type: "text", id: nid(), text: "已创建类型定义文件,并为每个组件的 props 加上了 TypeScript interface。", streaming: false },
                ],
              },
            ],
          });
          return "已追加一轮对话";
        },
      },
    ],
  },
];

/** 应用框架组件(所有场景共用同一个 AppShell,只切内部状态)。 */
export const AppFrame: ComponentType = AppShell;
