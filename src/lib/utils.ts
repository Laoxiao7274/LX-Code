import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * 合并 Tailwind 类名:处理条件类 + 去重冲突。
 * shadcn/ui 所有组件的样式拼接基础。
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
