import type { Electron } from "electron";

/** 渲染进程通过 contextBridge 暴露的 LXCode API。 */
export interface LxcodeAPI {
  version: string;
  platform: string;
}

declare global {
  interface Window {
    lxcode: LxcodeAPI;
  }
}
