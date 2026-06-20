# 当前状态 — 2026-06-20

## 已上线

- [x] **Vercel 部署**：`game.yangjiehui.xyz`，预构建数据 + no-op buildCommand
- [x] **仓库公开**：GitHub Actions 无限免费，无需担心欠费暂停
- [x] **5 条流水线**：微信资讯 / 游戏跟踪 / 设计管线 / AI资讯 / 访谈跟踪
- [x] **自动更新**：ObsidianNote push → repository_dispatch → GameInformation workflow → Build data → Push → Vercel 部署
- [x] **下载**：`scripts/download-articles.js` — GitHub API 下载 5 个目录的 .md，不 clone 大仓库
- [x] **构建**：`scripts/build-data.js` — 扫描 → 渲染 HTML → 导出 JSON
- [x] **解析**：parser.js 支持 YAML `created:` 字段 + YAML 解析失败时正则兜底 + 排除"处理时间"匹配（BUG-002）
- [x] **BUG-002 修复**：正文"处理时间"被错误提取为文章日期，正则添加 `(?<!处理)` 负向后顾排除（2026-06-20）

## 架构

ObsidianNote push → deploy.yml repository_dispatch → GameInformation workflow (download → build → push) → Vercel deploy
