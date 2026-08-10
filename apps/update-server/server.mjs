#!/usr/bin/env node
/**
 * LXCode 更新服务器(零依赖,Node 22+)
 *
 * 公开端点:
 *   GET  /                         首页:版本列表 + 下载链接(网站)
 *   GET  /latest.json               Tauri updater 更新清单
 *   GET  /api/health                健康检查
 *   GET  /api/versions              版本列表 JSON(含更新日志)
 *   GET  /releases/<ver>/<file>     静态产物(setup.exe / .sig)
 *
 * 管理端点(需登录,cookie session 或 Bearer token):
 *   GET  /admin                     管理后台页面(HTML)
 *   POST /api/login                 { token } 登录,设 cookie
 *   POST /api/logout                登出
 *   GET  /api/admin/auth            检查登录状态
 *   GET  /api/admin/versions        版本列表(含 notes/元数据)
 *   POST /api/admin/version         { version, notes, label } 创建/更新版本元数据
 *   DELETE /api/admin/version?v=    删除版本(目录 + manifest 条目)
 *   POST /api/admin/upload?v=&f=    上传文件到版本(流式)
 *   GET  /api/admin/manifest        当前 latest.json
 *   POST /api/admin/publish         { version, platform? } 发布某版本为最新
 *
 * CLI 发布(Bearer token,供 scripts/publish-release.mjs):
 *   POST /api/upload?version=&filename=
 *   POST /api/manifest
 *
 * 环境变量见 .env.example。HTTPS 由前置反代(Caddy/nginx)提供,本服务只起 HTTP。
 */
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
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
const ADMIN_HTML = join(ROOT, "admin.html");

const PORT = Number(process.env.PORT || 8080);
const PUBLISH_TOKEN = process.env.PUBLISH_TOKEN || "";
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || "";
const SITE_TITLE = process.env.SITE_TITLE || "LXCode 更新服务";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 天

mkdirSync(RELEASES_DIR, { recursive: true });
mkdirSync(DATA_DIR, { recursive: true });

// 内存 session(重启清空,需重新登录;足够单管理员用)
const sessions = new Map(); // sid -> { created }

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

function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k) out[k] = decodeURIComponent(v.join("="));
  }
  return out;
}

/** 鉴权:Bearer token(CLI)或 cookie session(管理页面)。 */
function checkAuth(req) {
  if (!PUBLISH_TOKEN) return { ok: false, reason: "server has no PUBLISH_TOKEN" };
  // Bearer token(CLI 脚本)
  const auth = req.headers.authorization || "";
  if (auth.startsWith("Bearer ") && auth.slice(7) === PUBLISH_TOKEN) {
    return { ok: true, via: "bearer" };
  }
  // cookie session(管理页面)
  const sid = parseCookies(req).lxcode_admin;
  if (sid && sessions.has(sid)) {
    const s = sessions.get(sid);
    if (Date.now() - s.created > SESSION_TTL_MS) {
      sessions.delete(sid);
    } else {
      return { ok: true, via: "session" };
    }
  }
  return { ok: false, reason: "not authenticated" };
}

function safeSegs(...segs) {
  return segs.map((s) => normalize(String(s)).replace(/^(\.\.[/\\])+/, "")).join("/");
}

/** 列版本目录,合并 meta.json(notes/label)。 */
function listVersions() {
  const out = [];
  if (!existsSync(RELEASES_DIR)) return out;
  for (const entry of readdirSync(RELEASES_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const name = entry.name;
    if (!/^v?\d+\.\d+\.\d+/.test(name)) continue;
    const dir = join(RELEASES_DIR, name);
    const files = readdirSync(dir).filter((f) => f !== "meta.json");
    const meta = readJsonSafe(join(dir, "meta.json"), {});
    out.push({
      version: name,
      label: meta.label || "",
      notes: meta.notes || "",
      createdAt: meta.createdAt || statSync(dir).mtimeMs,
      files,
    });
  }
  return out.sort((a, b) => b.createdAt - a.createdAt);
}

async function readBody(req, limit = 5 * 1024 * 1024) {
  const chunks = [];
  let total = 0;
  for await (const c of req) {
    total += c.length;
    if (total > limit) throw new Error("body too large");
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}

// ---- 路由 ----
async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const path = decodeURIComponent(url.pathname);

  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-headers", "authorization, content-type");
  res.setHeader("access-control-allow-methods", "GET,POST,PUT,DELETE,OPTIONS");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // ===== 公开端点 =====
  if (path === "/api/health" && req.method === "GET") {
    return sendJson(res, 200, { ok: true, service: "lxcode-update-server", versions: listVersions().length });
  }

  if (path === "/latest.json" && req.method === "GET") {
    const manifest = readJsonSafe(LATEST_JSON, { version: "0.0.0", pub_date: null, platforms: {} });
    return sendJson(res, 200, manifest);
  }

  if (path === "/api/versions" && req.method === "GET") {
    return sendJson(res, 200, { versions: listVersions() });
  }

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
      "content-disposition": `attachment; filename="${basename(abs)}"`,
      "cache-control": "public, max-age=3600",
    });
    createReadStream(abs).pipe(res);
    return;
  }

  if (path === "/" && req.method === "GET") {
    return sendHtml(res, 200, renderHome());
  }

  // ===== 登录/登出 =====
  if (path === "/api/login" && req.method === "POST") {
    if (!PUBLISH_TOKEN) return sendJson(res, 503, { error: "server has no PUBLISH_TOKEN" });
    let body;
    try {
      body = JSON.parse((await readBody(req)).toString("utf8"));
    } catch {
      return sendJson(res, 400, { error: "invalid JSON" });
    }
    if (body.token === PUBLISH_TOKEN) {
      const sid = randomUUID();
      sessions.set(sid, { created: Date.now() });
      res.setHeader("set-cookie", `lxcode_admin=${sid}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_TTL_MS / 1000}`);
      return sendJson(res, 200, { ok: true });
    }
    return sendJson(res, 401, { error: "token 错误" });
  }

  if (path === "/api/logout" && req.method === "POST") {
    const sid = parseCookies(req).lxcode_admin;
    if (sid) sessions.delete(sid);
    res.setHeader("set-cookie", "lxcode_admin=; Path=/; HttpOnly; Max-Age=0");
    return sendJson(res, 200, { ok: true });
  }

  if (path === "/api/admin/auth" && req.method === "GET") {
    return sendJson(res, 200, { authed: checkAuth(req).ok });
  }

  // ===== 管理端点(需鉴权)=====
  if (path.startsWith("/api/admin") || path === "/api/upload" || path === "/api/manifest") {
    const auth = checkAuth(req);
    if (!auth.ok && req.method !== "GET") {
      return sendJson(res, 401, { error: auth.reason });
    }
    // /api/upload 和 /api/manifest 保留给 CLI(Bearer),admin 用 /api/admin/upload + /api/admin/publish
  }

  // GET /admin → 管理页面 HTML
  if (path === "/admin" && req.method === "GET") {
    if (!existsSync(ADMIN_HTML)) return sendText(res, 404, "admin.html missing");
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    createReadStream(ADMIN_HTML).pipe(res);
    return;
  }

  // GET /api/admin/versions
  if (path === "/api/admin/versions" && req.method === "GET") {
    if (!checkAuth(req).ok) return sendJson(res, 401, { error: "not authenticated" });
    return sendJson(res, 200, { versions: listVersions() });
  }

  // POST /api/admin/version { version, notes, label } — 创建/更新版本元数据
  if (path === "/api/admin/version" && req.method === "POST") {
    if (!checkAuth(req).ok) return sendJson(res, 401, { error: "not authenticated" });
    let body;
    try {
      body = JSON.parse((await readBody(req)).toString("utf8"));
    } catch {
      return sendJson(res, 400, { error: "invalid JSON" });
    }
    const version = String(body.version || "").trim();
    if (!/^\d+\.\d+\.\d+$/.test(version)) {
      return sendJson(res, 400, { error: "version must be x.y.z" });
    }
    const tag = `v${version}`;
    const verDir = join(RELEASES_DIR, safeSegs(tag));
    if (!verDir.startsWith(RELEASES_DIR)) return sendJson(res, 400, { error: "bad version" });
    mkdirSync(verDir, { recursive: true });
    const existing = readJsonSafe(join(verDir, "meta.json"), {});
    const meta = {
      version,
      label: String(body.label ?? existing.label ?? ""),
      notes: String(body.notes ?? existing.notes ?? ""),
      createdAt: existing.createdAt || Date.now(),
    };
    writeFileSync(join(verDir, "meta.json"), JSON.stringify(meta, null, 2));
    return sendJson(res, 200, { ok: true, meta });
  }

  // DELETE /api/admin/version?v=x.y.z — 删除版本
  if (path === "/api/admin/version" && req.method === "DELETE") {
    if (!checkAuth(req).ok) return sendJson(res, 401, { error: "not authenticated" });
    const version = url.searchParams.get("v");
    if (!version) return sendJson(res, 400, { error: "v required" });
    const tag = version.startsWith("v") ? version : `v${version}`;
    const verDir = join(RELEASES_DIR, safeSegs(tag));
    if (!verDir.startsWith(RELEASES_DIR) || !existsSync(verDir)) {
      return sendJson(res, 404, { error: "version not found" });
    }
    rmSync(verDir, { recursive: true, force: true });
    // 从 latest.json 移除指向该版本的条目
    const manifest = readJsonSafe(LATEST_JSON, null);
    if (manifest?.platforms) {
      const prefix = `/releases/${encodeURIComponent(tag)}/`;
      for (const [k, v] of Object.entries(manifest.platforms)) {
        if (typeof v.url === "string" && v.url.includes(prefix)) delete manifest.platforms[k];
      }
      writeFileSync(LATEST_JSON, JSON.stringify(manifest, null, 2));
    }
    return sendJson(res, 200, { ok: true });
  }

  // POST /api/admin/upload?v=x.y.z&f=filename — 上传文件到版本目录(流式)
  if (path === "/api/admin/upload" && req.method === "POST") {
    if (!checkAuth(req).ok) return sendJson(res, 401, { error: "not authenticated" });
    const version = url.searchParams.get("v");
    const filename = url.searchParams.get("f");
    if (!version || !filename || /[\\/]/.test(filename)) {
      return sendJson(res, 400, { error: "v and f required (f no slash)" });
    }
    const tag = version.startsWith("v") ? version : `v${version}`;
    const verDir = join(RELEASES_DIR, safeSegs(tag));
    if (!verDir.startsWith(RELEASES_DIR)) return sendJson(res, 400, { error: "bad version" });
    mkdirSync(verDir, { recursive: true });
    const dest = join(verDir, filename);
    const tmp = `${dest}.${process.pid}.tmp`;
    const out = createWriteStream(tmp);
    await new Promise((resolve, reject) => {
      req.pipe(out);
      req.on("error", reject);
      out.on("error", reject);
      out.on("finish", resolve);
    });
    renameSync(tmp, dest);
    return sendJson(res, 200, { ok: true, version: tag, filename, bytes: statSync(dest).size });
  }

  // GET /api/admin/manifest
  if (path === "/api/admin/manifest" && req.method === "GET") {
    if (!checkAuth(req).ok) return sendJson(res, 401, { error: "not authenticated" });
    return sendJson(res, 200, readJsonSafe(LATEST_JSON, { version: "0.0.0", platforms: {} }));
  }

  // POST /api/admin/publish { version, platform? } — 发布某版本为最新
  if (path === "/api/admin/publish" && req.method === "POST") {
    if (!checkAuth(req).ok) return sendJson(res, 401, { error: "not authenticated" });
    let body;
    try {
      body = JSON.parse((await readBody(req)).toString("utf8"));
    } catch {
      return sendJson(res, 400, { error: "invalid JSON" });
    }
    const version = String(body.version || "").replace(/^v/, "");
    if (!/^\d+\.\d+\.\d+$/.test(version)) return sendJson(res, 400, { error: "version must be x.y.z" });
    const platform = body.platform || "windows-x86_64";
    const tag = `v${version}`;
    const verDir = join(RELEASES_DIR, safeSegs(tag));
    if (!existsSync(verDir)) return sendJson(res, 400, { error: `version ${tag} not found` });
    const files = readdirSync(verDir);
    const setup = files.find((f) => /setup\.exe$/i.test(f));
    const sig = files.find((f) => /\.sig$/i.test(f));
    if (!setup || !sig) {
      return sendJson(res, 400, { error: `version ${tag} missing setup.exe or .sig` });
    }
    const signature = readFileSync(join(verDir, sig), "utf8").trim();
    if (!signature) return sendJson(res, 400, { error: "signature file is empty" });
    const manifest = readJsonSafe(LATEST_JSON, { platforms: {} });
    manifest.version = version;
    manifest.pub_date = new Date().toISOString();
    manifest.notes = readJsonSafe(join(verDir, "meta.json"), {}).notes || manifest.notes || undefined;
    manifest.platforms = manifest.platforms || {};
    manifest.platforms[platform] = {
      signature,
      url: `${publicBase(req)}/releases/${encodeURIComponent(tag)}/${encodeURIComponent(setup)}`,
    };
    writeFileSync(LATEST_JSON, JSON.stringify(manifest, null, 2));
    return sendJson(res, 200, { ok: true, version, platform, manifest });
  }

  // ===== CLI 发布端点(Bearer token,publish-release.mjs 用)=====
  if (path === "/api/upload" && req.method === "POST") {
    const auth = checkAuth(req);
    if (!auth.ok) return sendJson(res, 401, { error: auth.reason });
    const version = url.searchParams.get("version");
    const filename = url.searchParams.get("filename");
    if (!version || !filename || /[\\/]/.test(filename)) {
      return sendJson(res, 400, { error: "version and filename required" });
    }
    const tag = version.startsWith("v") ? version : `v${version}`;
    const verDir = join(RELEASES_DIR, safeSegs(tag));
    if (!verDir.startsWith(RELEASES_DIR)) return sendJson(res, 400, { error: "bad version" });
    mkdirSync(verDir, { recursive: true });
    const dest = join(verDir, filename);
    const tmp = `${dest}.${process.pid}.tmp`;
    const out = createWriteStream(tmp);
    await new Promise((resolve, reject) => {
      req.pipe(out);
      req.on("error", reject);
      out.on("error", reject);
      out.on("finish", resolve);
    });
    renameSync(tmp, dest);
    return sendJson(res, 200, { ok: true, version: tag, filename, bytes: statSync(dest).size });
  }

  if (path === "/api/manifest" && req.method === "POST") {
    const auth = checkAuth(req);
    if (!auth.ok) return sendJson(res, 401, { error: auth.reason });
    let manifest;
    try {
      manifest = JSON.parse((await readBody(req, 10 * 1024 * 1024)).toString("utf8"));
    } catch (e) {
      return sendJson(res, 400, { error: "invalid JSON: " + (e?.message || e) });
    }
    if (typeof manifest.version !== "string" || typeof manifest.platforms !== "object") {
      return sendJson(res, 400, { error: "manifest needs version + platforms" });
    }
    writeFileSync(LATEST_JSON, JSON.stringify(manifest, null, 2));
    return sendJson(res, 200, { ok: true, version: manifest.version });
  }

  return sendText(res, 404, "not found");
}

// ---- 首页 HTML ----
function renderHome() {
  const versions = listVersions();
  const latest = readJsonSafe(LATEST_JSON, null);
  const base = PUBLIC_BASE_URL ? PUBLIC_BASE_URL.replace(/\/+$/, "") : "";
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmtNotes = (n) =>
    esc(n).replace(/\r?\n/g, "<br>").replace(/`([^`]+)`/g, "<code>$1</code>");

  const versionRows = versions.length
    ? versions
        .map((v) => {
          const filesHtml = v.files
            .map((f) => {
              const url = `${base}/releases/${encodeURIComponent(v.version)}/${encodeURIComponent(f)}`;
              let size = "";
              try {
                size = (statSync(join(RELEASES_DIR, v.version, f)).size / 1024 / 1024).toFixed(1) + " MB";
              } catch {}
              return `<a href="${esc(url)}">${esc(f)}</a> <span class="size">${esc(size)}</span>`;
            })
            .join("<br>");
          const isLatest = latest?.version && `v${latest.version}` === v.version;
          return `<tr>
            <td class="ver">${esc(v.version)}${isLatest ? ' <span class="badge">最新</span>' : ""}${v.label ? `<span class="label">${esc(v.label)}</span>` : ""}</td>
            <td class="date">${esc(new Date(v.createdAt).toISOString().slice(0, 19).replace("T", " "))}</td>
            <td class="files">${filesHtml}</td>
          </tr>${v.notes ? `<tr class="notes-row"><td colspan="3"><div class="notes">${fmtNotes(v.notes)}</div></td></tr>` : ""}`;
        })
        .join("")
    : `<tr><td colspan="3" class="empty">还没有发布任何版本</td></tr>`;

  const latestBadge = latest?.version
    ? `<div class="latest">当前最新:<strong>v${esc(latest.version)}</strong>${
        latest.pub_date ? ` <span class="date">(${esc(String(latest.pub_date).slice(0, 19))})</span>` : ""
      }</div>`
    : `<div class="latest muted">尚未配置 latest.json</div>`;

  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(SITE_TITLE)}</title>
<style>
*{box-sizing:border-box}body{margin:0;font-family:-apple-system,"Segoe UI","Microsoft YaHei",system-ui,sans-serif;background:#0d1117;color:#c9d1d9;line-height:1.6}
.wrap{max-width:960px;margin:0 auto;padding:48px 24px}
h1{font-size:28px;margin:0 0 8px;font-weight:600}h1 .mark{color:#58a6ff}
.sub{color:#8b949e;margin-bottom:24px}
.latest{padding:12px 16px;background:#161b22;border:1px solid #30363d;border-radius:8px;margin-bottom:32px}.latest strong{color:#58a6ff}.latest.muted{color:#8b949e}
table{width:100%;border-collapse:collapse;background:#161b22;border:1px solid #30363d;border-radius:8px;overflow:hidden}
th,td{padding:12px 16px;text-align:left;border-bottom:1px solid #21262d;vertical-align:top}
th{background:#0d1117;color:#8b949e;font-weight:500;font-size:13px;text-transform:uppercase;letter-spacing:.05em}
tr:last-child td{border-bottom:none}.notes-row td{padding:0 16px 12px}.notes{background:#0d1117;border-left:3px solid #30363d;padding:10px 14px;border-radius:4px;font-size:13px;color:#8b949e;white-space:pre-wrap}
.ver{color:#58a6ff;font-weight:600;white-space:nowrap}.badge{display:inline-block;background:#238636;color:#fff;font-size:11px;padding:1px 8px;border-radius:10px;font-weight:600;vertical-align:middle}
.label{display:inline-block;background:#1f6feb33;color:#58a6ff;font-size:11px;padding:1px 8px;border-radius:4px;margin-left:6px}
.date{color:#8b949e;font-size:13px;font-family:ui-monospace,SFMono-Regular,monospace}
.files a{color:#58a6ff;text-decoration:none;font-family:ui-monospace,SFMono-Regular,monospace;font-size:13px}.files a:hover{text-decoration:underline}
.size{color:#6e7681;font-size:12px;margin-left:8px}
.empty{color:#8b949e;text-align:center;padding:32px}
.foot{margin-top:32px;color:#6e7681;font-size:12px}code{background:#21262d;padding:2px 6px;border-radius:4px;font-size:12px}
.admin-link{float:right;color:#484f58;font-size:13px;text-decoration:none}.admin-link:hover{color:#8b949e}
</style></head><body><div class="wrap">
<a class="admin-link" href="/admin">管理</a>
<h1><span class="mark">LX</span>Code 更新服务</h1>
<div class="sub">LXCode 桌面端自动更新与安装包分发</div>
${latestBadge}
<table><thead><tr><th>版本</th><th>发布时间</th><th>下载</th></tr></thead><tbody>${versionRows}</tbody></table>
<div class="foot">更新清单:<code>/latest.json</code> · 健康检查:<code>/api/health</code> · 版本 API:<code>/api/versions</code></div>
</div></body></html>`;
}

const server = createServer(handler);
server.listen(PORT, () => {
  console.log(`[lxcode-update-server] listening on http://localhost:${PORT}`);
  console.log(`  PUBLISH_TOKEN: ${PUBLISH_TOKEN ? "set" : "(empty — uploads disabled)"}`);
  console.log(`  PUBLIC_BASE_URL: ${PUBLIC_BASE_URL || "(inferred from Host)"}`);
});
