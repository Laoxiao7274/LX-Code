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
          { id: "p2", role: "assistant", text: "我需要创建文件 src/test.ts,请确认权限。" },
        ],
        input: "",
        isGenerating: false,
      });
    },
    events: [
      {
        id: "allow",
        label: "允许执行",
        description: "放行此次工具调用",
        handler: () => {
          useChatStore.getState().setInput("好的,继续");
          return "已允许,工具执行中";
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
];

/** 应用框架组件(所有场景共用同一个 AppShell,只切内部状态)。 */
export const AppFrame: ComponentType = AppShell;
