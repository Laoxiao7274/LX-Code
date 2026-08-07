// @ts-nocheck
/**
 * activity monitor stub —— LXCode 不用 TUI activity monitor,空实现满足依赖。
 */
export const activityMonitor = {
  clear() {},
  record(_entry: unknown) {},
  start() {},
  stop() {},
  logStart(_label: string, _url: string) {},
  logComplete(_label: string, _url: string, _ms: number) {},
  logError(_label: string, _url: string, _error: string) {},
};
