// @ts-nocheck
/**
 * chrome-cookies stub —— Gemini Web(浏览器 cookie 搜索)第一期不实现,空实现满足依赖。
 * 原 pi-web-access 用 Chrome 的 Google cookies 免费搜 Gemini,LXCode 暂不做。
 */
export async function getGoogleCookies(_options: unknown): Promise<null> {
  return null;
}
export function buildCookieHeader(_cookies: unknown): string {
  return "";
}
export function getLastGoogleCookieDiagnostic(): string | null {
  return "Gemini Web (browser cookies) disabled in LXCode";
}
