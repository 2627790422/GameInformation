# 当前状态 — 2026-05-07

## 目标

将 Game Research Archive 从 Express + 本地文件扫描 迁移到 Vercel + Supabase PostgreSQL。

## 已完成

- [x] Supabase 项目创建：`gfzkhdhzqhphzteflxxk`
- [x] 数据库迁移 SQL：`supabase/migrations/001_init.sql`（articles、profiles、subscriptions 表 + RLS）
- [x] 导入脚本：`scripts/import.js`（通过 REST API 批量导入，绕过 supabase-js WebSocket 兼容问题）
- [x] Vercel API 路由：`api/articles.js`、`api/search.js`、`api/stats.js`
- [x] Vercel 配置：`vercel.json`
- [x] Supabase MCP 配置：`.mcp.json`
- [x] Agent skills 安装：`.claude/skills/supabase/`、`supabase-postgres-best-practices/`

## 待完成（按顺序）

### 1. 创建 articles 表

**问题**：表还不存在，导入脚本返回 404。

**方案 A（推荐）**：在 Supabase SQL Editor 中粘贴执行 `supabase/migrations/001_init.sql` 的全部内容：
https://supabase.com/dashboard/project/gfzkhdhzqhphzteflxxk/sql/new

**方案 B**：通过 MCP `execute_sql` 工具执行（需要先完成 MCP OAuth 认证，见下方）。

### 2. MCP OAuth 认证

`.mcp.json` 已配置，`claude mcp add` 已执行。状态：`! Needs authentication`。

在新会话中：
1. 运行 `/mcp` 或在对话中说"认证 Supabase MCP"
2. 调用 `mcp__supabase__authenticate` 获取授权 URL
3. 浏览器打开 URL 完成授权
4. 回调到 localhost 后 MCP 工具（`execute_sql`、`search_docs` 等）可用

> 注意：OAuth 回调端口是随机的（如 40939、44479），确保浏览器能访问 localhost 对应端口。

### 3. 导入数据

```bash
node scripts/import.js
```

导入 31 篇文章到 Supabase。脚本配置：
- URL: `https://gfzkhdhzqhphzteflxxk.supabase.co`
- Key: `sb_secret_9Eb8_sfmDlX2KuPel-mSsA_ahpeMo_D`（service_role，硬编码在脚本中）

### 4. 部署 Vercel

需要配置环境变量：
- `SUPABASE_URL` = `https://gfzkhdhzqhphzteflxxk.supabase.co`
- `SUPABASE_ANON_KEY` = 从 Supabase Dashboard > Settings > API 获取（anon public key）

部署方式：
```bash
vercel --prod
```
或通过 GitHub 集成自动部署。

## 关键凭据

| 凭据 | 值 | 位置 |
|------|-----|------|
| Supabase URL | `https://gfzkhdhzqhphzteflxxk.supabase.co` | scripts/import.js, vercel.json |
| Service Role Key | `sb_secret_9Eb8_sfmDlX2KuPel-mSsA_ahpeMo_D` | scripts/import.js（硬编码） |
| Dashboard | https://supabase.com/dashboard/project/gfzkhdhzqhphzteflxxk | - |
| SQL Editor | https://supabase.com/dashboard/project/gfzkhdhzqhphzteflxxk/sql/new | - |

## 文件结构

```
GameInformation/
├── supabase/migrations/001_init.sql   # 建表 SQL（待执行）
├── scripts/import.js                  # 数据导入脚本（待执行）
├── api/articles.js                    # Vercel API
├── api/search.js
├── api/stats.js
├── vercel.json                        # Vercel 部署配置
├── .mcp.json                          # Supabase MCP 配置
├── docs/STATUS.md                     # 本文件
├── docs/MIGRATION.md                  # 完整迁移方案
└── reference/                         # git submodule: ObsidianNote
```

## 在新机器上继续

```bash
git clone https://github.com/2627790422/GameInformation.git
cd GameInformation
npm install
git submodule update --init --recursive   # 拉取 reference/ObsidianNote
```

然后按上面"待完成"顺序执行。
