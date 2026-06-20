# 游戏资讯 · Game Research Archive

游戏设计研究文章聚合阅读器。从 ObsidianNote 仓库拉取 Markdown 文章，预渲染 HTML，部署到 Vercel。

- 域名：`game.yangjiehui.xyz`
- 数据源：[ObsidianNote](https://github.com/2627790422/ObsidianNote)（GitHub 仓库）
- 架构：Vercel Serverless + 预构建 JSON，每 6 小时自动更新

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2a. 本地开发（Express 模式，直接扫描本地 Obsidian Vault）
set VAULT_PATH=C:\Users\jiehuiyang\Documents\Obsidian Vault
npm start
# → http://localhost:3000

# 2b. Vercel Serverless 模拟（读取预构建 data/*.json）
npm run build     # 先构建数据
vercel dev        # 模拟 Vercel 环境
```

## 数据流

```
ObsidianNote push → GitHub Actions (deploy.yml)
  → repository_dispatch → GameInformation workflow (update-data.yml)
    → download-articles.js（GitHub API 下载 .md）
    → build-data.js（扫描 → 渲染 → 导出 JSON）
    → git push data/
  → Vercel 自动部署
```

## API

| 端点 | 说明 | 数据源 |
|------|------|--------|
| `GET /api/articles` | 文章列表，支持 `?pipeline=&stage=&tag=&month=&sort=date&order=desc&limit=&offset=&exclude=` | 优先 `data/articles-list.json`，回退 scanner |
| `GET /api/articles?id=xxx` | 文章详情，返回预渲染 HTML | 优先 `data/articles-detail.json`，回退 scanner |
| `GET /api/search?q=` | 全文搜索 | 优先 `data/search-index.json`（MiniSearch.loadJSON），回退 scanner |
| `GET /api/stats` | 统计面板数据 | 优先 `data/stats.json`，回退 scanner 动态计算 |

## 技术栈

- **后端**: Vercel Serverless Functions（`api/*.js`）+ 本地 Express（`server.js`）
- **解析**: gray-matter（YAML frontmatter）+ marked（Markdown → HTML）
- **搜索**: MiniSearch（中文全文搜索，预构建 JSON 索引）
- **图表**: Mermaid（CDN 客户端渲染）
- **前端**: 原生 HTML/CSS/JS，无框架，双主题（亮色/暗色）

## 5 条文章流水线

| 流水线 | 目录（ObsidianNote 仓库内） |
|--------|------|
| 微信资讯 | `游戏设计/游戏资讯/资讯` |
| 游戏跟踪 | `游戏设计/游戏跟踪/已分析` |
| 设计管线 | `游戏设计/管线/产出` |
| AI资讯 | `AI/AI资讯` |
| 访谈跟踪 | `外接大脑/访谈跟踪/已分析` |

## 项目结构

```
web-viewer/
├── server.js              # Express 服务入口（本地开发）
├── api/                   # Vercel Serverless Functions（生产环境）
│   ├── articles.js        # GET /api/articles
│   ├── search.js          # GET /api/search
│   └── stats.js           # GET /api/stats
├── lib/
│   ├── scanner.js         # Vault 文件扫描（本地开发 + 回退）
│   ├── parser.js          # Markdown 解析（支持 YAML frontmatter + Format B blockquote + 纯正文）
│   └── search.js          # 全文搜索引擎（本地开发回退）
├── scripts/
│   ├── build-data.js      # 数据构建脚本（扫描 → 渲染 → 导出 JSON）
│   └── download-articles.js # GitHub API 下载文章（不用 git clone）
├── data/                  # 预构建 JSON（已提交 git）
├── public/
│   ├── index.html         # SPA 主页面
│   ├── style.css          # 样式（亮/暗双主题）
│   └── app.js             # 前端逻辑
├── docs/                  # 项目文档
│   ├── STATUS.md          # 当前状态
│   ├── TODO.md            # 待办事项
│   ├── MIGRATION.md       # 迁移计划（已废弃）
│   ├── bug/               # Bug 记录
│   └── plans/             # 方案归档
├── supabase/migrations/   # 数据库迁移（预留，未使用）
├── reference/             # 下载的 .md 文件（gitignore）
├── .github/workflows/
│   └── update-data.yml    # 自动更新 workflow
└── vercel.json            # Vercel 部署配置
```

## 常见问题

- **网站返回 0 篇**：检查 `data/articles-list.json` 是否为空数组。若是，workflow 可能没跑通，看 Actions 日志。
- **workflow Download 步返回 404**：`GH_PAT` secret 未设置或过期。
- **设计管线文章无日期**：parser.js 支持 YAML `date:` 和 `created:` 字段（`date:` 优先，`created:` 作为备用），YAML 解析失败时正则兜底提取。
- **本地开发**：设 `VAULT_PATH` 环境变量指向本地 Obsidian Vault 根目录即可跳过 API 下载。
