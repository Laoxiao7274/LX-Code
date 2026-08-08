/** Sidebar collapse preferences — localStorage-backed, safe in non-DOM tests. */

/** 旧品牌 key(pideck.*) → 新 key(lxcode.*) 映射,读取时 fallback 兼容,不丢已存布局偏好。 */
function legacyKey(key: string): string | null {
  return key.startsWith("lxcode.") ? `pideck.${key.slice("lxcode.".length)}` : null;
}

export function sidebarPref(key: string): boolean {
  try {
    const value = globalThis.localStorage?.getItem(key);
    if (value !== null && value !== undefined) return value === "1";
    const legacy = legacyKey(key);
    if (legacy) return globalThis.localStorage?.getItem(legacy) === "1";
    return false;
  } catch {
    return false;
  }
}

export function setSidebarPref(key: string, value: boolean): void {
  try {
    globalThis.localStorage?.setItem(key, value ? "1" : "0");
  } catch {
    /* ignore */
  }
}
