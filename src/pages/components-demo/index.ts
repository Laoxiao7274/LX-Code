import type { ComponentType } from "react";
import { ButtonDemo } from "./button-demo";

export interface ComponentDef {
  id: string;
  label: string;
  description?: string;
  Component: ComponentType;
}

/**
 * 组件调试场清单。新增组件:写一个 *-demo.tsx + 在此注册。
 */
export const COMPONENTS: ComponentDef[] = [
  {
    id: "button",
    label: "Button 按钮",
    description: "shadcn/ui new-york 风格,6 种 variant + 4 种 size",
    Component: ButtonDemo,
  },
];
