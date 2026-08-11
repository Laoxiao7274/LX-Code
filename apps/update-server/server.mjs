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
// channel 清单:stable.json(正式)、beta.json(测试);latest.json 兼容=stable
const CHANNELS = ["stable", "beta"];
const manifestPath = (ch) => join(DATA_DIR, `${ch}.json`);

const PORT = Number(process.env.PORT || 8080);
// 管理账号登录(页面用)
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
// CLI 发布 token(scripts/publish-release.mjs 用,与登录密码分开)
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

/** 按扩展名设 content-type,流式返回静态文件(前端 dist)。 */
function serveStatic(res, abs) {
  const ext = abs.slice(abs.lastIndexOf(".") + 1).toLowerCase();
  const types = {
    html: "text/html; charset=utf-8",
    js: "text/javascript; charset=utf-8",
    css: "text/css; charset=utf-8",
    png: "image/png", jpg: "image/jpeg", svg: "image/svg+xml",
    ico: "image/x-icon", json: "application/json; charset=utf-8",
    woff2: "font/woff2", woff: "font/woff", map: "application/json",
  };
  res.writeHead(200, {
    "content-type": types[ext] || "application/octet-stream",
    "cache-control": ext === "html" ? "no-cache" : "public, max-age=3600",
  });
  createReadStream(abs).pipe(res);
}

function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k) out[k] = decodeURIComponent(v.join("="));
  }
  return out;
}

/** 鉴权:Bearer token(CLI 发布)或 cookie session(管理页面账号密码登录)。 */
function checkAuth(req) {
  // Bearer token(CLI 脚本 publish-release.mjs)——与登录密码独立
  if (PUBLISH_TOKEN) {
    const auth = req.headers.authorization || "";
    if (auth.startsWith("Bearer ") && auth.slice(7) === PUBLISH_TOKEN) {
      return { ok: true, via: "bearer" };
    }
  }
  // cookie session(管理页面账号密码登录)
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
      channel: meta.channel || "stable",
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

  // GET /stable.json | /beta.json | /latest.json(=stable,兼容)— Tauri updater 端点
  if (req.method === "GET" && /^(?:\/stable|\/beta|\/latest)\.json$/.test(path)) {
    const ch = path === "/latest.json" ? "stable" : path.slice(1, -5);
    const manifest = readJsonSafe(manifestPath(ch), { version: "0.0.0", pub_date: null, platforms: {} });
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

  // 静态前端(web/dist,SPA):首页、admin 等都由 React 接管。
  // dev 时前端跑在 5173 代理 API,生产由这里 serve dist。
  if (req.method === "GET" && !path.startsWith("/api") && !path.startsWith("/releases") && !/\.(?:stable|beta|latest)\.json$/.test(path)) {
    const WEB_DIST = join(ROOT, "web", "dist");
    if (!existsSync(WEB_DIST)) {
      return sendText(res, 503, "前端未构建:在 apps/update-server/web 跑 `pnpm build`");
    }
    // 精确匹配静态文件
    const rel = safeSegs(...path.split("/").filter(Boolean));
    const abs = join(WEB_DIST, rel);
    if (abs.startsWith(WEB_DIST) && existsSync(abs) && statSync(abs).isFile()) {
      return serveStatic(res, abs);
    }
    // SPA fallback → index.html(前端路由 #/admin 等)
    const index = join(WEB_DIST, "index.html");
    if (existsSync(index)) return serveStatic(res, index);
    return sendText(res, 404, "index.html missing");
  }

  // ===== 登录/登出 =====
  if (path === "/api/login" && req.method === "POST") {
    if (!ADMIN_PASSWORD) return sendJson(res, 503, { error: "server has no ADMIN_PASSWORD" });
    let body;
    try {
      body = JSON.parse((await readBody(req)).toString("utf8"));
    } catch {
      return sendJson(res, 400, { error: "invalid JSON" });
    }
    if (body.username === ADMIN_USERNAME && body.password === ADMIN_PASSWORD) {
      const sid = randomUUID();
      sessions.set(sid, { created: Date.now() });
      res.setHeader("set-cookie", `lxcode_admin=${sid}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_TTL_MS / 1000}`);
      return sendJson(res, 200, { ok: true });
    }
    return sendJson(res, 401, { error: "账号或密码错误" });
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
      channel: body.channel === "beta" || existing.channel === "beta" ? "beta" : "stable",
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
    // 从两个 channel 清单 + latest.json 移除指向该版本的条目
    for (const ch of ["stable", "beta", "latest"]) {
      const mPath = manifestPath(ch);
      const manifest = readJsonSafe(mPath, null);
      if (manifest?.platforms) {
        const prefix = `/releases/${encodeURIComponent(tag)}/`;
        let changed = false;
        for (const [k, v] of Object.entries(manifest.platforms)) {
          if (typeof v.url === "string" && v.url.includes(prefix)) {
            delete manifest.platforms[k];
            changed = true;
          }
        }
        if (changed) writeFileSync(mPath, JSON.stringify(manifest, null, 2));
      }
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
  // GET /api/admin/manifest — 返回两个 channel 的清单
  if (path === "/api/admin/manifest" && req.method === "GET") {
    if (!checkAuth(req).ok) return sendJson(res, 401, { error: "not authenticated" });
    return sendJson(res, 200, {
      stable: readJsonSafe(manifestPath("stable"), { version: "0.0.0", platforms: {} }),
      beta: readJsonSafe(manifestPath("beta"), { version: "0.0.0", platforms: {} }),
    });
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
    // channel 从版本 meta 读,默认 stable;客户端按 channel 拉对应清单
    const meta = readJsonSafe(join(verDir, "meta.json"), {});
    const channel = meta.channel === "beta" ? "beta" : "stable";
    const mPath = manifestPath(channel);
    const manifest = readJsonSafe(mPath, { platforms: {} });
    manifest.version = version;
    manifest.pub_date = new Date().toISOString();
    manifest.notes = meta.notes || manifest.notes || undefined;
    manifest.platforms = manifest.platforms || {};
    manifest.platforms[platform] = {
      signature,
      url: `${publicBase(req)}/releases/${encodeURIComponent(tag)}/${encodeURIComponent(setup)}`,
    };
    writeFileSync(mPath, JSON.stringify(manifest, null, 2));
    // stable 额外同步到 latest.json(老客户端兼容)
    if (channel === "stable") writeFileSync(manifestPath("latest"), JSON.stringify(manifest, null, 2));
    return sendJson(res, 200, { ok: true, version, channel, platform, manifest });
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
const server = createServer(handler);
server.listen(PORT, () => {
  console.log(`[lxcode-update-server] listening on http://localhost:${PORT}`);
  console.log(`  ADMIN: ${ADMIN_USERNAME} / ${ADMIN_PASSWORD ? "set" : "(empty — login disabled)"}`);
  console.log(`  PUBLISH_TOKEN: ${PUBLISH_TOKEN ? "set" : "(empty — CLI uploads disabled)"}`);
  console.log(`  PUBLIC_BASE_URL: ${PUBLIC_BASE_URL || "(inferred from Host)"}`);
});
