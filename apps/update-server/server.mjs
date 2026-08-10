#!/usr/bin/env node
/**
 * LXCode 更新服务器(零依赖,Node 22+)
 *
 * 端点:
 *   GET  /                         首页:版本列表 + 下载链接(网站)
 *   GET  /latest.json               Tauri updater 更新清单
 *   GET  /api/health                健康检查
 *   GET  /api/versions              版本列表 JSON
 *   GET  /releases/<ver>/<file>     静态产物(setup.exe / .sig / manifest)
 *   POST /api/upload?version=&filename=  上传单个产物(Bearer token,流式)
 *   POST /api/manifest              上传/替换 latest.json(Bearer token,JSON body)
 *
 * 环境变量见 .env.example。HTTPS 由前置反代(Caddy/nginx)提供,本服务只起 HTTP。
 */
import { createServer } from "node:http";
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
  renameSync,
} from "node:fs";
import { join, dirname, normalize, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const RELEASES_DIR = join(ROOT, "releases");
const DATA_DIR = join(ROOT, "data");
const LATEST_JSON = join(DATA_DIR, "latest.json");
const VERSIONS_JSON = join(DATA_DIR, "versions.json");

const PORT = Number(process.env.PORT || 8080);
const PUBLISH_TOKEN = process.env.PUBLISH_TOKEN || "";
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || "";
const SITE_TITLE = process.env.SITE_TITLE || "LXCode 更新服务";

mkdirSync(RELEASES_DIR, { recursive: true });
mkdirSync(DATA_DIR, { recursive: true });

// ---- helpers ----
function readJsonSafe(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

function publicBase(req) {
  if (PUBLIC_BASE_URL) return PUBLIC_BASE_URL.replace(/\/+$/, "");
  // 从 Host 头推断(http),HTTPS 部署时务必设 PUBLIC_BASE_URL
  const proto = req.headers["x-forwarded-proto"] || "http";
  const host = req.headers.host || `localhost:${PORT}`;
  return `${proto}://${host}`;
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj, null, 2);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(body);
}

function sendText(res, status, text) {
  res.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
  res.end(text);
}

function sendHtml(res, status, html) {
  res.writeHead(status, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
}

function checkAuth(req) {
  if (!PUBLISH_TOKEN) return { ok: false, reason: "server has no PUBLISH_TOKEN" };
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  return token === PUBLISH_TOKEN
    ? { ok: true }
    : { ok: false, reason: "invalid or missing Bearer token" };
}

/** 安全化 version/filename,防路径穿越 */
function safeSegs(...segs) {
  const cleaned = segs
    .map((s) => normalize(String(s)).replace(/^(\.\.[/\\])+/, ""))
    .join("/");
  return cleaned;
}

/** 列出已发布版本(目录名 v<semver>) */
function listVersions() {
  const out = [];
  for (const entry of readdirSync(RELEASES_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const name = entry.name;
    if (!/^v?\d+\.\d+\.\d+/.test(name)) continue;
    const dir = join(RELEASES_DIR, name);
    const files = readdirSync(dir);
    const setup = files.find((f) => /setup\.exe$/i.test(f));
    const sig = files.find((f) => /\.sig$/i.test(f));
    const mtime = statSync(dir).mtimeMs;
    out.push({ version: name, dir, setup, sig, files, mtime });
  }
  return out.sort((a, b) => b.mtime - a.mtime);
}

// ---- 路由 ----
async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const path = decodeURIComponent(url.pathname);

  // CORS(发布脚本/调试用)
  res.setHeader("access-control-allow-origin", "*");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // GET /api/health
  if (path === "/api/health" && req.method === "GET") {
    return sendJson(res, 200, {
      ok: true,
      service: "lxcode-update-server",
      versions: listVersions().length,
    });
  }

  // GET /latest.json —— Tauri updater 端点
  if (path === "/latest.json" && req.method === "GET") {
    const manifest = readJsonSafe(LATEST_JSON, null);
    if (!manifest) return sendJson(res, 200, { version: "0.0.0", pub_date: null, platforms: {} });
    return sendJson(res, 200, manifest);
  }

  // GET /api/versions —— 版本列表 JSON
  if (path === "/api/versions" && req.method === "GET") {
    const versions = listVersions().map((v) => ({
      version: v.version,
      files: v.files,
      mtime: new Date(v.mtime).toISOString(),
    }));
    return sendJson(res, 200, { versions });
  }

  // GET /api/manifest —— 查看当前 latest.json(调试)
  if (path === "/api/manifest" && req.method === "GET") {
    return sendJson(res, 200, readJsonSafe(LATEST_JSON, { version: "0.0.0", platforms: {} }));
  }

  // GET /releases/<ver>/<file...> —— 静态产物
  if (path.startsWith("/releases/") && req.method === "GET") {
    const rel = safeSegs(...path.slice("/releases/".length).split("/"));
    const abs = join(RELEASES_DIR, rel);
    if (!abs.startsWith(RELEASES_DIR) || !existsSync(abs) || statSync(abs).isDirectory()) {
      return sendText(res, 404, "not found");
    }
    const stat = statSync(abs);
    res.writeHead(200, {
      "content-type": "application/octet-stream",
      "content-length": stat.size,
      "cache-control": "public, max-age=3600",
    });
    createReadStream(abs).pipe(res);
    return;
  }

  // POST /api/upload?version=&filename= —— 上传单个产物(流式)
  if (path === "/api/upload" && req.method === "POST") {
    const auth = checkAuth(req);
    if (!auth.ok) return sendJson(res, 401, { error: auth.reason });
    const version = url.searchParams.get("version");
    const filename = url.searchParams.get("filename");
    if (!version || !filename || /[\\/]/.test(filename)) {
      return sendJson(res, 400, { error: "version and filename required (filename no slash)" });
    }
    const verDir = join(RELEASES_DIR, safeSegs(version));
    if (!verDir.startsWith(RELEASES_DIR)) return sendJson(res, 400, { error: "bad version" });
    mkdirSync(verDir, { recursive: true });
    const dest = join(verDir, filename);
    const tmp = `${dest}.${process.pid}.tmp`;
    // 临时 token 形式:正文即文件流
    const out = createWriteStream(tmp);
    await new Promise((resolve, reject) => {
      req.pipe(out);
      req.on("error", reject);
      out.on("error", reject);
      out.on("finish", resolve);
    });
    renameSync(tmp, dest);
    return sendJson(res, 200, { ok: true, version, filename, bytes: statSync(dest).size });
  }

  // POST /api/manifest —— 写入 latest.json
  if (path === "/api/manifest" && req.method === "POST") {
    const auth = checkAuth(req);
    if (!auth.ok) return sendJson(res, 401, { error: auth.reason });
    const chunks = [];
    for await (const c of req) chunks.push(c);
    let manifest;
    try {
      manifest = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch (e) {
      return sendJson(res, 400, { error: "invalid JSON: " + (e?.message || e) });
    }
    if (typeof manifest.version !== "string" || typeof manifest.platforms !== "object") {
      return sendJson(res, 400, { error: "manifest needs version + platforms" });
    }
    const tmp = `${LATEST_JSON}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(manifest, null, 2));
    renameSync(tmp, LATEST_JSON);
    return sendJson(res, 200, { ok: true, version: manifest.version });
  }

  // GET / —— 首页
  if (path === "/" && req.method === "GET") {
    return sendHtml(res, 200, renderHome());
  }

  return sendText(res, 404, "not found");
}

// 首页 HTML:版本列表 + 下载链接
function renderHome() {
  const versions = listVersions();
  const latest = readJsonSafe(LATEST_JSON, null);
  const base = PUBLIC_BASE_URL ? PUBLIC_BASE_URL.replace(/\/+$/, "") : "";
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const versionRows = versions.length
    ? versions
        .map((v) => {
          const filesHtml = v.files
            .map((f) => {
              const url = `${base}/releases/${encodeURIComponent(v.version)}/${encodeURIComponent(f)}`;
              const size = (() => {
                try {
                  return (statSync(join(v.dir, f)).size / 1024 / 1024).toFixed(1) + " MB";
                } catch {
                  return "";
                }
              })();
              return `<a href="${esc(url)}">${esc(f)}</a> <span class="size">${esc(size)}</span>`;
            })
            .join("<br>");
          return `<tr><td class="ver">${esc(v.version)}</td><td class="date">${esc(
            new Date(v.mtime).toISOString().slice(0, 19).replace("T", " "),
          )}</td><td class="files">${filesHtml}</td></tr>`;
        })
        .join("")
    : `<tr><td colspan="3" class="empty">还没有发布任何版本</td></tr>`;

  const latestBadge = latest?.version
    ? `<div class="latest">当前最新:<strong>v${esc(latest.version)}</strong>${
        latest.pub_date ? ` <span class="date">(${esc(String(latest.pub_date).slice(0, 19))})</span>` : ""
      }</div>`
    : `<div class="latest muted">尚未配置 latest.json</div>`;

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(SITE_TITLE)}</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;font-family:-apple-system,"Segoe UI","Microsoft YaHei",system-ui,sans-serif;background:#0d1117;color:#c9d1d9;line-height:1.6}
  .wrap{max-width:960px;margin:0 auto;padding:48px 24px}
  h1{font-size:28px;margin:0 0 8px;font-weight:600}
  h1 .mark{color:#58a6ff}
  .sub{color:#8b949e;margin-bottom:24px}
  .latest{padding:12px 16px;background:#161b22;border:1px solid #30363d;border-radius:8px;margin-bottom:32px}
  .latest strong{color:#58a6ff}
  .latest.muted{color:#8b949e}
  table{width:100%;border-collapse:collapse;background:#161b22;border:1px solid #30363d;border-radius:8px;overflow:hidden}
  th,td{padding:12px 16px;text-align:left;border-bottom:1px solid #21262d;vertical-align:top}
  th{background:#0d1117;color:#8b949e;font-weight:500;font-size:13px;text-transform:uppercase;letter-spacing:.05em}
  tr:last-child td{border-bottom:none}
  .ver{color:#58a6ff;font-weight:600;white-space:nowrap}
  .date{color:#8b949e;font-size:13px;font-family:ui-monospace,SFMono-Regular,monospace}
  .files a{color:#58a6ff;text-decoration:none;font-family:ui-monospace,SFMono-Regular,monospace;font-size:13px}
  .files a:hover{text-decoration:underline}
  .size{color:#6e7681;font-size:12px;margin-left:8px}
  .empty{color:#8b949e;text-align:center;padding:32px}
  .foot{margin-top:32px;color:#6e7681;font-size:12px}
  code{background:#21262d;padding:2px 6px;border-radius:4px;font-size:12px}
</style>
</head>
<body>
<div class="wrap">
  <h1><span class="mark">LX</span>Code 更新服务</h1>
  <div class="sub">LXCode 桌面端自动更新与安装包分发</div>
  ${latestBadge}
  <table>
    <thead><tr><th>版本</th><th>发布时间</th><th>下载</th></tr></thead>
    <tbody>${versionRows}</tbody>
  </table>
  <div class="foot">
    更新清单:<code>/latest.json</code> · 健康检查:<code>/api/health</code> · 版本 API:<code>/api/versions</code><br>
    客户端(Tauri updater)从 <code>/latest.json</code> 拉取清单,校验 minisign 签名后下载对应平台安装包。
  </div>
</div>
</body>
</html>`;
}

const server = createServer(handler);
server.listen(PORT, () => {
  console.log(`[lxcode-update-server] listening on http://localhost:${PORT}`);
  console.log(`  PUBLISH_TOKEN: ${PUBLISH_TOKEN ? "set" : "(empty — uploads disabled)"}`);
  console.log(`  PUBLIC_BASE_URL: ${PUBLIC_BASE_URL || "(inferred from Host)"}`);
});
