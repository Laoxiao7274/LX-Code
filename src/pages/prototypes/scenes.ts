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

/** 长任务剧本:模拟「重构 React 项目」多轮对话,逐条流式播放。 */
const LONG_TASK_SCRIPT: { user: string; reply: import("./chat-store").ReplyScript }[] = [
  {
    user: "帮我重构这个 React 项目,把所有 class 组件改成函数组件 + hooks",
    reply: {
      think: "用户要重构整个项目。这是个大任务,我先扫描所有 class 组件,制定计划,再逐个迁移。先从入口 App.tsx 开始。",
      tools: [
        { name: "grep", arg: "extends Component", output: ["src/App.tsx:3", "src/pages/Home.tsx:5", "src/pages/Login.tsx:4", "src/components/Header.tsx:2", "src/components/Sidebar.tsx:2"], timing: "0.4s" },
        { name: "read", arg: "src/App.tsx", output: ["已读取 48 行"], timing: "0.3s" },
      ],
      text: "找到 5 个 class 组件。我先从入口 App.tsx 开始重构,它用了 state 和生命周期,需要转成 useState + useEffect。",
    },
  },
  {
    user: "好的,先做 App.tsx 吧",
    reply: {
      think: "App.tsx 有两个 state(count 和 user)和一个 componentDidMount(请求数据)。迁移方案:useState 替代 state 对象,useEffect 替代生命周期,空依赖数组触发一次。",
      tools: [
        { name: "edit", arg: "src/App.tsx", output: ["- class App extends Component", "+ function App() {", "+   const [count, setCount] = useState(0)", "+   useEffect(() => { fetchUser() }, [])"], timing: "1.2s" },
      ],
      text: "App.tsx 已重构完成。主要改动:state 拆成两个 useState,componentDidMount 转成 useEffect,render 方法直接 return。",
    },
  },
  {
    user: "继续做 Home.tsx",
    reply: {
      think: "Home.tsx 比较复杂,有多个生命周期方法和 ref。需要拆成多个 useEffect,注意清理函数。",
      tools: [
        { name: "read", arg: "src/pages/Home.tsx", output: ["已读取 124 行"], timing: "0.5s" },
        { name: "edit", arg: "src/pages/Home.tsx", output: ["重构完成,4 个 useEffect,1 个 useCallback"], timing: "2.1s" },
      ],
      text: "Home.tsx 完成。三个生命周期拆成了三个 useEffect:挂载时请求数据、props 变化时重新请求、卸载时清理订阅。",
    },
  },
  {
    user: "Login 组件呢?它用了 context",
    reply: {
      think: "Login 组件用了 Context.Consumer 和 withRouter HOC。Context.Consumer 在函数组件里可以直接 useContext,withRouter 可以用 useRouter hook 替代。",
      tools: [
        { name: "read", arg: "src/pages/Login.tsx", output: ["已读取 67 行"], timing: "0.3s" },
        { name: "edit", arg: "src/pages/Login.tsx", status: "error", output: ["Error: useRouter 只能在函数组件内使用,但 withRouter 包裹的仍是 class"], timing: "0.8s" },
        { name: "edit", arg: "src/pages/Login.tsx", output: ["移除 withRouter,改用 useRouter,Context.Consumer 改 useContext"], timing: "1.5s" },
      ],
      text: "Login.tsx 完成。遇到 withRouter 冲突已修复,Context.Consumer 换成 useContext 更简洁。",
    },
  },
  {
    user: "现在还剩 Header 和 Sidebar 两个组件",
    reply: {
      think: "这两个是纯展示组件,没有 state 和生命周期,迁移最简单,直接改成函数返回 JSX 即可。",
      tools: [
        { name: "edit", arg: "src/components/Header.tsx", output: ["重构完成"], timing: "0.6s" },
        { name: "edit", arg: "src/components/Sidebar.tsx", output: ["重构完成"], timing: "0.7s" },
        { name: "bash", arg: "pnpm build", output: ["> vite build", "✓ 42 modules transformed", "dist/ 186.4 KiB"], timing: "4.2s" },
      ],
      text: "全部 5 个 class 组件已重构为函数组件 + hooks,build 通过。",
    },
  },
];

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
      {
        id: "att-image",
        label: "发送图片消息",
        description: "加一张图片并发送",
        handler: () => {
          useChatStore.setState({ messages: [], input: "", pendingAttachments: [], isGenerating: false });
          const s = useChatStore.getState();
          s.addAttachment({ id: `img${Date.now()}`, kind: "image", name: "界面截图.png" });
          s.setInput("看下这个界面");
          s.send();
          return "已发送图片消息(含思考+工具回复)";
        },
      },
      {
        id: "att-file",
        label: "发送文件消息",
        description: "附一个文件并发送",
        handler: () => {
          useChatStore.setState({ messages: [], input: "", pendingAttachments: [], isGenerating: false });
          useChatStore.getState().addAttachment({ id: `file${Date.now()}`, kind: "file", name: "requirements.md", size: "4.2 KB" });
          useChatStore.getState().setInput("根据需求文档实现");
          useChatStore.getState().send();
          return "已发送文件消息";
        },
      },
      {
        id: "att-multi",
        label: "多附件预览",
        description: "一次发图+文件(看网格/卡片样式)",
        handler: () => {
          useChatStore.setState({ messages: [], input: "", pendingAttachments: [], isGenerating: false });
          const s = useChatStore.getState();
          s.addAttachment({ id: `a1`, kind: "image", name: "图1.png" });
          s.addAttachment({ id: `a2`, kind: "image", name: "图2.png" });
          s.addAttachment({ id: `a3`, kind: "file", name: "package.json", size: "1.1 KB" });
          s.setInput("看这三份");
          s.send();
          return "已发送多附件(2图+1文件)";
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
    description: "自动播放多轮对话(思考+工具+正文流式)",
    enter: () => {
      useChatStore.getState().playScript(LONG_TASK_SCRIPT);
    },
    events: [
      {
        id: "replay",
        label: "重新播放",
        description: "从头再演一遍长任务",
        handler: () => {
          useChatStore.getState().playScript(LONG_TASK_SCRIPT);
          return "重新播放长任务剧本";
        },
      },
      {
        id: "stop",
        label: "停止播放",
        description: "中断当前流式/播放",
        handler: () => {
          if (!useChatStore.getState().isGenerating) return "当前未在播放";
          useChatStore.getState().stopScript();
          return "已停止播放";
        },
      },
    ],
  },
];

/** 应用框架组件(所有场景共用同一个 AppShell,只切内部状态)。 */
export const AppFrame: ComponentType = AppShell;
