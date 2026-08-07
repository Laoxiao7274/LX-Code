// @ts-nocheck
/**
 * 浏览器打开辅助 —— pi 扩展通过 ctx.ui.setStatus 发事件给前端,
 * 前端监听 extensionStatuses 的 "lx:open-browser" key,收到 URL 后开内置浏览器。
 *
 * 这样 pi 扩展(工具/curator)能触发前端开内置浏览器加载 URL,不弹系统浏览器。
 * 完成后调 closeBrowser 清除 status。
 */
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

const STATUS_KEY = "lx:open-browser";

/** 通知前端开内置浏览器加载 url。返回 true 表示已发出(前端是否收到取决于事件机制)。 */
export function openBrowserInApp(ctx: ExtensionContext | undefined, url: string): boolean {
  if (!ctx?.ui?.setStatus) return false;
  try {
    // 用 setStatus 发 URL 给前端,前端监听 extensionStatuses["lx:open-browser"] 开浏览器
    ctx.ui.setStatus(STATUS_KEY, url);
    return true;
  } catch {
    return false;
  }
}

/** 通知前端关闭浏览器(清除 status)。 */
export function closeBrowserInApp(ctx: ExtensionContext | undefined): void {
  if (!ctx?.ui?.setStatus) return;
  try {
    ctx.ui.setStatus(STATUS_KEY, undefined);
  } catch {
    // 静默
  }
}
