# LXCode 更新服务器

零依赖 Node.js HTTP 服务器,托管 LXCode 桌面端自动更新清单(`latest.json`)与安装包。

## 端点

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/` | 首页:版本列表 + 下载链接(网站) |
| GET | `/latest.json` | Tauri updater 更新清单 |
| GET | `/api/health` | 健康检查 |
| GET | `/api/versions` | 版本列表 JSON |
| GET | `/api/manifest` | 当前 latest.json(调试) |
| GET | `/releases/<ver>/<file>` | 静态产物(setup.exe / .sig) |
| POST | `/api/upload?version=&filename=` | 上传单个产物(Bearer token) |
| POST | `/api/manifest` | 写入 latest.json(Bearer token) |

## 部署

### 本地测试

```bash
cd apps/update-server
cp .env.example .env   # 改 PUBLISH_TOKEN
node server.mjs
```

### 生产(VPS + Caddy HTTPS)

Tauri updater **强制 HTTPS**。本服务只起 HTTP,用 Caddy 反代自动证书:

**1. 服务器:**

```bash
# VPS 上
cd apps/update-server
cp .env.example .env
# 编辑 .env:
#   PUBLISH_TOKEN=<生成一个长随机串>
#   PUBLIC_BASE_URL=https://updates.你的域名.dev
node server.mjs   # 或用 pm2/systemd 守护
```

**2. Caddyfile:**

```
updates.你的域名.dev {
  reverse_proxy localhost:8080
}
```

`caddy run` 即自动签 Let's Encrypt 证书。

### 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `PORT` | 8080 | 监听端口 |
| `PUBLISH_TOKEN` | (空) | 上传鉴权 token;空则禁止上传 |
| `PUBLIC_BASE_URL` | (推断 Host) | 写进 latest.json 的 URL 基址;HTTPS 部署务必设 |
| `SITE_TITLE` | LXCode 更新服务 | 首页标题 |

## 发布新版本

构建产物在 `apps/desktop/src-tauri/target/release/bundle/nsis/`:
- `LXCode_<version>_x64-setup.exe`(NSIS 安装包,Tauri updater 下载这个)
- `LXCode_<version>_x64-setup.exe.sig`(minisign 签名)

```bash
# 设环境变量
export UPDATE_SERVER_URL=https://updates.lxcode.dev
export PUBLISH_TOKEN=<你的 token>

# 发布 0.2.0
node scripts/publish-release.mjs \
  --version 0.2.0 \
  --setup apps/desktop/src-tauri/target/release/bundle/nsis/LXCode_0.2.0_x64-setup.exe
  # --sig 默认 <setup>.sig,通常不用指定
```

脚本会:
1. 上传 setup.exe 和 .sig 到 `releases/v0.2.0/`
2. 合并到 `latest.json`(保留其他平台条目,如 macOS)
3. 写回服务器

客户端启动时 Tauri updater 自动从 `https://updates.lxcode.dev/latest.json` 拉清单,校验签名后下载安装。

## 客户端配置

`apps/desktop/src-tauri/tauri.conf.json` 的 `plugins.updater.endpoints` 已配为多源(主服务器 + GitHub releases 兜底):

```json
"endpoints": [
  "https://updates.lxcode.dev/latest.json",
  "https://github.com/Laoxiao7274/LX-Code/releases/latest/download/latest.json"
]
```

把第一个改成你的域名即可。

## latest.json 格式

```json
{
  "version": "0.2.0",
  "pub_date": "2026-08-10T10:00:00.000Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "<minisign 签名>",
      "url": "https://updates.lxcode.dev/releases/v0.2.0/LXCode_0.2.0_x64-setup.exe"
    }
  }
}
```

## 数据存储

- `releases/<vX.Y.Z>/` — 每个版本的产物(setup.exe、.sig)
- `data/latest.json` — 当前最新清单

服务器无状态(除这两个),备份/迁移只需复制这两个目录。
