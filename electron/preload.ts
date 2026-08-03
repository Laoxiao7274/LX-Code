import { contextBridge } from "electron";

/**
 * 预加载脚本:通过 contextBridge 暴露安全 API 给渲染进程。
 * 当前为最小占位,pi-core 接入时扩展 agent IPC 通道。
 */
contextBridge.exposeInMainWorld("lxcode", {
  version: "0.1.0",
  platform: process.platform,
  // 后续在此暴露 agent.prompt / agent.abort / onEvent 等
});
