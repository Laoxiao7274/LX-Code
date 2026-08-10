#!/usr/bin/env node
/**
 * 发布脚本:把构建产物上传到更新服务器 + 生成 latest.json
 *
 * 用法:
 *   node scripts/publish-release.mjs --version 0.2.0 --setup <setup.exe> --sig <setup.exe.sig>
 *
 * 环境变量(或 .env):
 *   UPDATE_SERVER_URL   更新服务器基址,如 https://updates.lxcode.dev(必填)
 *   PUBLISH_TOKEN       上传 token(必填)
 *   PLATFORM            平台 key,默认 windows-x86_64
 *
 * 流程:
 *   1. 校验 setup.exe + .sig 存在
 *   2. POST /api/upload 上传 setup.exe 和 .sig 到 releases/v<version>/
 *   3. 读现有 latest.json(若没有则新建),合并本平台条目
 *   4. POST /api/manifest 写回 latest.json
 *
 * 上传是流式的,220MB setup.exe 不会全进内存。
 */
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";

const args = parseArgs(process.argv.slice(2));
const SERVER_URL = (process.env.UPDATE_SERVER_URL || args.server || "").replace(/\/+$/, "");
const TOKEN = process.env.PUBLISH_TOKEN || args.token || "";
const VERSION = args.version;
const SETUP = args.setup;
const SIG = args.sig || `${SETUP}.sig`;
const PLATFORM = process.env.PLATFORM || args.platform || "windows-x86_64";

if (!SERVER_URL || !TOKEN || !VERSION || !SETUP) {
  console.error(`用法: publish-release.mjs --version <ver> --setup <setup.exe> [--sig <.sig>] [--server <url>] [--token <tok>]
需要环境变量或参数:UPDATE_SERVER_URL / PUBLISH_TOKEN
  --version   版本号(如 0.2.0)
  --setup     NSIS setup.exe 路径
  --sig       签名文件(默认 <setup>.sig)
  --server    更新服务器 URL(或设 UPDATE_SERVER_URL)
  --token     上传 token(或设 PUBLISH_TOKEN)
  --platform  平台 key(默认 windows-x86_64)`);
  process.exit(1);
}

if (!existsSync(SETUP)) die(`setup not found: ${SETUP}`);
if (!existsSync(SIG)) die(`sig not found: ${SIG}`);

const tag = `v${VERSION}`;
const setupName = basename(SETUP);
const sigName = basename(SIG);

main().catch((e) => {
  console.error("[publish] failed:", e?.message || e);
  process.exit(1);
});

async function main() {
  console.log(`[publish] → ${SERVER_URL}`);
  console.log(`[publish] version=${tag} platform=${PLATFORM}`);
  console.log(`[publish] setup=${setupName} (${(statSync(SETUP).size / 1024 / 1024).toFixed(1)} MB)`);
  console.log(`[publish] sig=${sigName}`);

  // 1. 上传 setup.exe
  await uploadFile(SETUP, tag, setupName);
  // 2. 上传 .sig
  await uploadFile(SIG, tag, sigName);

  // 3. 读现有 latest.json,合并本平台
  const manifest = await fetchJson(`${SERVER_URL}/latest.json`);
  const signature = readFileSync(SIG, "utf8").trim();
  if (!signature) die("signature file is empty");
  const platforms = manifest.platforms || {};
  platforms[PLATFORM] = {
    signature,
    url: `${SERVER_URL}/releases/${encodeURIComponent(tag)}/${encodeURIComponent(setupName)}`,
  };
  const next = {
    version: VERSION,
    pub_date: new Date().toISOString(),
    notes: args.notes || manifest.notes || undefined,
    platforms,
  };
  // 4. 写 manifest
  await postJson(`${SERVER_URL}/api/manifest`, next, TOKEN);
  console.log(`[publish] ✓ latest.json updated → v${VERSION}`);
  console.log(`[publish]   ${PLATFORM}: ${platforms[PLATFORM].url}`);
}

async function uploadFile(path, version, filename) {
  const url = `${SERVER_URL}/api/upload?version=${encodeURIComponent(version)}&filename=${encodeURIComponent(filename)}`;
  const size = statSync(path).size;
  console.log(`[publish] uploading ${filename} ...`);
  const res = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${TOKEN}`, "content-length": String(size) },
    body: createReadStream(path),
    // Node 22 fetch 支持流式 body;duplex:'half' 对 Web ReadableStream
    duplex: "half",
  });
  if (!res.ok) die(`upload ${filename} failed: ${res.status} ${await res.text()}`);
  const body = await res.json();
  console.log(`[publish] ✓ ${filename} (${(body.bytes / 1024 / 1024).toFixed(1)} MB)`);
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) return { version: "0.0.0", platforms: {} };
    die(`GET ${url} failed: ${res.status}`);
  }
  return res.json();
}

async function postJson(url, body, token) {
  const res = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) die(`POST ${url} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i]?.replace(/^--/, "");
    out[k] = argv[i + 1];
  }
  return out;
}

function die(msg) {
  console.error(`[publish] ✗ ${msg}`);
  process.exit(1);
}
