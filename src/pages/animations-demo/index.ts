import type { ComponentType } from "react";
import { EntranceFadeDemo } from "./entrance-fade-demo";
import { ChatBubbleDemo } from "./chat-bubble-demo";
import { ButtonInteractionDemo } from "./button-interaction-demo";
import { EmptyStateDemo } from "./empty-state-demo";
import { SignalPulseDemo } from "./signal-pulse-demo";

export interface AnimationDef {
  id: string;
  label: string;
  description?: string;
  /** 在清单中显示的小标签,如「入场」「交互」「序列」。 */
  tag: "入场" | "交互" | "序列" | "滚动";
  Component: ComponentType;
}

/**
 * 动画演示清单。新增动画:写一个 *-demo.tsx + 在此注册。
 * 这些动画可被页面原型引用,也可在工作台「动画演示」Tab 中单独调试。
 */
export const ANIMATIONS: AnimationDef[] = [
  { id: "entrance-fade", label: "淡入上移", description: "stagger 列表入场", tag: "入场", Component: EntranceFadeDemo },
  { id: "chat-bubble", label: "对话气泡入场", description: "消息流 back.out 弹入", tag: "入场", Component: ChatBubbleDemo },
  { id: "empty-state", label: "空状态入场", description: "Logo+标题+卡片时间轴", tag: "序列", Component: EmptyStateDemo },
  { id: "button-interaction", label: "按钮交互", description: "hover 抬升 + 点击弹性", tag: "交互", Component: ButtonInteractionDemo },
  { id: "signal-pulse", label: "信号点脉冲", description: "GSAP 循环扩散光圈", tag: "交互", Component: SignalPulseDemo },
];
