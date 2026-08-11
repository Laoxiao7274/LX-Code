// 更新服务器 API 客户端

export type VersionInfo = {
  version: string; // "v0.2.0"
  label: string;
  notes: string;
  channel: "stable" | "beta";
  createdAt: number;
  files: string[];
};

export type Manifest = {
  version: string;
  pub_date: string | null;
  notes?: string;
  platforms: Record<string, { signature: string; url: string }>;
};

export type ChannelManifests = {
  stable: Manifest;
  beta: Manifest;
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: "same-origin", ...init });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || res.statusText);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const apiClient = {
  health: () => api<{ ok: boolean; versions: number }>("/api/health"),
  getVersions: () => api<{ versions: VersionInfo[] }>("/api/versions"),
  getManifest: () => api<Manifest>("/stable.json"),
  getBetaManifest: () => api<Manifest>("/beta.json"),

  // admin
  checkAuth: () => api<{ authed: boolean }>("/api/admin/auth"),
  login: (username: string, password: string) =>
    api<{ ok: boolean }>("/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    }),
  logout: () => api<{ ok: boolean }>("/api/logout", { method: "POST" }),
  adminVersions: () => api<{ versions: VersionInfo[] }>("/api/admin/versions"),
  adminManifest: () => api<ChannelManifests>("/api/admin/manifest"),
  createVersion: (body: { version: string; label?: string; notes?: string; channel?: "stable" | "beta" }) =>
    api<{ ok: boolean; meta: unknown }>("/api/admin/version", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  deleteVersion: (v: string) =>
    api<{ ok: boolean }>(`/api/admin/version?v=${encodeURIComponent(v)}`, {
      method: "DELETE",
    }),
  uploadFile: (v: string, f: string, file: File, onProgress?: (pct: number) => void) =>
    new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `/api/admin/upload?v=${encodeURIComponent(v)}&f=${encodeURIComponent(f)}`);
      xhr.withCredentials = true;
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`上传失败: ${xhr.status}`));
      };
      xhr.onerror = () => reject(new Error("上传失败: 网络错误"));
      xhr.send(file);
    }),
  publish: (version: string, platform = "windows-x86_64") =>
    api<{ ok: boolean; manifest: Manifest; channel: string }>("/api/admin/publish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ version, platform }),
    }),
};
