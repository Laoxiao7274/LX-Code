import type { ComponentType } from "react";
import type { WorkbenchEvent } from "@/components/workbench/events-sidebar";
import { ChatPrototype } from "./chat";
import { useChatStore } from "./chat-store";

export interface PrototypeDef {
  id: string;
  label: string;
  description?: string;
  Component: ComponentType;
  events: WorkbenchEvent[];
  eventsHint?: string;
}

/**
 * 页面原型清单。新增原型:写一个 .tsx + 一个 store + 在此注册,
 * 工作台左栏自动出现入口、右栏自动出事件并真实触发。
 */
export const PROTOTYPES: PrototypeDef[] = [
  {
    id: "chat",
    label: "对话页",
    description: "主聊天界面:消息流 + 输入框",
    Component: ChatPrototype,
    eventsHint: "点击事件,效果实时反映在预览区",
    events: [
      {
        id: "send",
        label: "发送消息",
        description: "发送当前输入并生成回复",
        handler: () => {
          const { input, isGenerating, send } = useChatStore.getState();
          if (isGenerating) return "生成中,无法发送";
          if (!input.trim()) {
            // 没内容就塞一条默认消息再发
            useChatStore.getState().setInput("帮我重构这段代码");
          }
          send();
          return "已发送一条用户消息";
        },
      },
      {
        id: "abort",
        label: "中断生成",
        description: "停止正在流式生成的回复",
        handler: () => {
          if (!useChatStore.getState().isGenerating) return "当前没有正在生成的回复";
          useChatStore.getState().abort();
          return "已中断流式生成";
        },
      },
      {
        id: "retry",
        label: "重试上一条",
        description: "删掉最后一条助手回复并重新生成",
        handler: () => {
          if (useChatStore.getState().isGenerating) return "生成中,无法重试";
          useChatStore.getState().retry();
          return "已重新生成最后一条回复";
        },
      },
      {
        id: "clear",
        label: "清空对话",
        description: "清除所有消息",
        handler: () => {
          useChatStore.getState().clear();
          return "已清空全部消息";
        },
      },
    ],
  },
];
