import type { ComponentType } from "react";
import type { WorkbenchEvent } from "@/components/workbench/events-sidebar";
import { ChatPrototype } from "./chat";

export interface PrototypeDef {
  id: string;
  label: string;
  description?: string;
  Component: ComponentType;
  events: WorkbenchEvent[];
  eventsHint?: string;
}

/**
 * 页面原型清单。新增原型:写一个 .tsx + 在此注册即可,
 * 工作台左栏自动出现入口、右栏自动出事件。
 */
export const PROTOTYPES: PrototypeDef[] = [
  {
    id: "chat",
    label: "对话页",
    description: "主聊天界面:消息流 + 输入框",
    Component: ChatPrototype,
    events: [
      { id: "send", label: "发送消息", description: "提交当前输入" },
      { id: "abort", label: "中断生成", description: "停止当前流式回复" },
      { id: "retry", label: "重试上一条", description: "重新生成" },
      { id: "clear", label: "清空对话", description: "清除所有消息" },
    ],
    eventsHint: "对话页常见交互(占位)",
  },
];
