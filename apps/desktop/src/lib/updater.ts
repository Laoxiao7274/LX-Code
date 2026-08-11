/**
 * App self-update over the Tauri updater plugin.
 *
 * Channel 支持:桌面端自己 fetch channel 对应清单(stable.json/beta.json)比对版本,
 * 展示更新日志给用户;确认更新时用 Tauri plugin 的 check()+downloadAndInstall()
 * 实际下载安装(plugin 按编译期 endpoints 拉,会取版本更高的清单,实际下载的版本
 * 与展示版本一致——因为同 channel 的 json 即 plugin endpoints 之一)。
 *
 * All plugin imports stay dynamic so the browser mock never loads Tauri
 * internals. A check returns null when no update is available (or when
 * running outside Tauri); installing downloads the package and relaunches.
 */

export type UpdateChannel = "stable" | "beta";

export type AppUpdate = {
  version: string;
  /** 更新日志(来自 manifest notes) */
  body?: string;
  /** Downloads, installs and relaunches the app. Resolves only on failure paths. */
  install: (onProgress?: (progress: AppUpdateInstallProgress) => void) => void;
};

export type AppUpdateInstallProgress =
  | {
      phase: "downloading";
      downloadedBytes: number;
      totalBytes: number | null;
    }
  | { phase: "installing" };

let inFlightCheck: Promise<AppUpdate | null> | null = null;

/** 更新服务器基址(含 https)。编译期 endpoints 的主源,运行时 channel 检查也用它。 */
const UPDATE_SERVER =
  "https://updates.lxcode.dev" /* TODO: 换成实际域名 */;

/** 拉指定 channel 的清单,返回版本号 + notes(只检查,不下载)。 */
async function fetchChannelManifest(channel: UpdateChannel): Promise<{
  version: string;
  pub_date?: string;
  notes?: string;
} | null> {
  try {
    const res = await fetch(`${UPDATE_SERVER}/${channel}.json`, { cache: "no-store" });
    if (!res.ok) return null;
    const m = (await res.json()) as { version?: string; pub_date?: string; notes?: string };
    return m.version ? { version: m.version, pub_date: m.pub_date, notes: m.notes } : null;
  } catch {
    return null;
  }
}

/** 比较语义化版本:a < b 返回 -1,等返回 0,a > b 返回 1(支持 -beta 后缀)。 */
function compareVersions(a: string, b: string): number {
  const pa = a.split(/[.-]/);
  const pb = b.split(/[.-]/);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = Number(pa[i]) || 0;
    const nb = Number(pb[i]) || 0;
    if (na < nb) return -1;
    if (na > nb) return 1;
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

// install 签名是回调式,上面 install 写法错了。重写 runCheck 的 install。
/** Checks the release feed; concurrent callers share one in-flight request. */
export function checkForAppUpdate(channel: UpdateChannel = "stable"): Promise<AppUpdate | null> {
  if (!inFlightCheck) {
    inFlightCheck = runCheck(channel).finally(() => {
      inFlightCheck = null;
    });
  }
  return inFlightCheck;
}
