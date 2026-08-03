import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** 合并 className(照抄设计原型)。 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 是否在 Electron 环境(有 window.lxcode)。 */
export function isElectron(): boolean {
  return typeof window !== "undefined" && !!window.lxcode?.agent;
}
