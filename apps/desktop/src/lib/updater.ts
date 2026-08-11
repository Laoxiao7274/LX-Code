/**
 * App self-update.
 *
 * Channel 支持:
 * - stable:Tauri updater plugin 自动下载安装(plugin endpoints 指向 stable.json)
 * - beta:自己 fetch beta.json 比对版本 + 提示,install 打开下载页手动装
 *   (Tauri plugin 的 endpoints 编译期固定,无法运行时切到 beta.json,故 beta 不走 plugin 自动下载)
 *
 * 安全:无论 channel,plugin 下载的 setup.exe 都经 minisign 公钥验证(不可禁)。
 * HTTP 端点靠 tauri.conf.json 的 dangerousInsecureTransportProtocol 放行,签名兜底内容完整性。
 *
 * All plugin imports stay dynamic so the browser mock never loads Tauri internals.
 */

export type UpdateChannel = "stable" | "beta";

export type AppUpdate = {
  version: string;
  /** 更新日志(来自 manifest notes) */
  body?: string;
  /** beta 频道为手动下载(打开浏览器),stable 为自动下载安装并重启。 */
  manual?: boolean;
  /** Downloads, installs and relaunches the app. Resolves only on failure paths. */
  install: (onProgress?: (progress: AppUpdateInstallProgress) => void) => Promise<void>;
};

export type AppUpdateInstallProgress =
  | { phase: "downloading"; downloadedBytes: number; totalBytes: number | null }
  | { phase: "installing" };

let inFlightCheck: Promise<AppUpdate | null> | null = null;

/** 更新服务器基址(与 tauri.conf.json endpoints 主源一致)。 */
const UPDATE_SERVER = "http://123.57.129.111:8081";

type ChannelManifest = {
  version: string;
  pub_date?: string;
  notes?: string;
  platforms?: Record<string, { signature: string; url: string }>;
};

async function fetchChannelManifest(channel: UpdateChannel): Promise<ChannelManifest | null> {
  try {
    const res = await fetch(`${UPDATE_SERVER}/${channel}.json`, { cache: "no-store" });
    if (!res.ok) return null;
    const m = (await res.json()) as ChannelManifest;
    return m.version ? m : null;
  } catch {
    return null;
  }
}

/** 比较语义化版本:a < b 返回 -1,等返回 0,a > b 返回 1(支持 -beta 后缀,预发布 < 正式)。 */
function compareVersions(a: string, b: string): number {
  const pa = a.split(/[.-]/);
  const pb = b.split(/[.-]/);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = Number(pa[i]);
    const nb = Number(pb[i]);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) {
      if (na < nb) return -1;
      if (na > nb) return 1;
      continue;
    }
    // 非数字段(如 "beta"):有 < 无(0.2.1-beta < 0.2.1)
    const sa = pa[i] ?? "";
    const sb = pb[i] ?? "";
    if (sa === sb) continue;
    if (!sa) return 1;
    if (!sb) return -1;
    return sa < sb ? -1 : 1;
  }
  return 0;
}

async function runCheck(channel: UpdateChannel = "stable"): Promise<AppUpdate | null> {
  const { isTauri } = await import("@tauri-apps/api/core");
  if (!isTauri()) return null;

  const manifest = await fetchChannelManifest(channel);
  if (!manifest) return null;
  const { getVersion } = await import("@tauri-apps/api/app");
  const current = await getVersion();
  if (compareVersions(manifest.version, current) <= 0) return null;

  if (channel === "beta") {
    // beta:plugin 无法运行时切 endpoint,手动下载——打开下载页
    const url = manifest.platforms?.["windows-x86_64"]?.url;
    return {
      version: manifest.version,
      body: manifest.notes,
      manual: true,
      install: async () => {
        if (url) {
          const { open } = await import("@tauri-apps/plugin-shell");
          await open(url);
        }
      },
    };
  }

  // stable:plugin 自动下载安装(plugin endpoints 指向 stable.json)
  const { check } = await import("@tauri-apps/plugin-updater");
  const update = await check();
  if (!update) return null;
  return {
    version: update.version,
    body: manifest.notes ?? update.body,
    install: async (onProgress) => {
      let downloadedBytes = 0;
      let totalBytes: number | null = null;
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          downloadedBytes = 0;
          totalBytes = event.data.contentLength ?? null;
          onProgress?.({ phase: "downloading", downloadedBytes, totalBytes });
          return;
        }
        if (event.event === "Progress") {
          downloadedBytes += event.data.chunkLength;
          onProgress?.({ phase: "downloading", downloadedBytes, totalBytes });
          return;
        }
        onProgress?.({ phase: "installing" });
      });
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    },
  };
}

/** Checks the release feed; concurrent callers share one in-flight request. */
export function checkForAppUpdate(channel: UpdateChannel = "stable"): Promise<AppUpdate | null> {
  if (!inFlightCheck) {
    inFlightCheck = runCheck(channel).finally(() => {
      inFlightCheck = null;
    });
  }
  return inFlightCheck;
}
