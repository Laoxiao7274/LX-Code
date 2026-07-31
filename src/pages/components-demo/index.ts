import type { ComponentType } from "react";
import { ButtonDemo } from "./button-demo";
import { InputDemo } from "./input-demo";
import { TextareaDemo } from "./textarea-demo";
import { ScrollAreaDemo } from "./scroll-area-demo";
import { BadgeDemo } from "./badge-demo";
import { AvatarDemo } from "./avatar-demo";
import { SeparatorDemo } from "./separator-demo";

export interface ComponentDef {
  id: string;
  label: string;
  description?: string;
  Component: ComponentType;
}

/**
 * 组件调试场清单。新增组件:写一个 *-demo.tsx + 在此注册。
 * 页面原型只能使用这里已注册的组件来搭建。
 */
export const COMPONENTS: ComponentDef[] = [
  { id: "button", label: "Button 按钮", description: "6 种 variant + 4 种 size", Component: ButtonDemo },
  { id: "input", label: "Input 输入框", description: "单行文本输入", Component: InputDemo },
  { id: "textarea", label: "Textarea 多行输入", description: "多行文本输入", Component: TextareaDemo },
  { id: "scroll-area", label: "ScrollArea 滚动区", description: "自定义滚动条", Component: ScrollAreaDemo },
  { id: "badge", label: "Badge 徽标", description: "4 种 variant 状态标签", Component: BadgeDemo },
  { id: "avatar", label: "Avatar 头像", description: "图片 + 回退文字", Component: AvatarDemo },
  { id: "separator", label: "Separator 分隔线", description: "水平 / 垂直", Component: SeparatorDemo },
];
