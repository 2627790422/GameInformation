# 修复 Vercel 数据管线

**日期**: 2026-06-13
**状态**: 已完成
**类型**: Bug 修复

## 问题
Vercel 部署后 API 返回空数据，根因是 API 函数试图扫描 markdown 文件但文件不在 Vercel 上，且预构建的 JSON 文件被闲置。

## 方案
API 函数从"运行时扫描 .md"改为"读取预构建 JSON"，保留 scanner 回退兼容本地开发。

## 修改
- `api/articles.js` — JSON 优先
- `api/search.js` — MiniSearch.loadJSON
- `api/stats.js` — 直接读 stats.json
- `lib/scanner.js` — 跨平台兜底路径

## 验证
- 编译通过，4 个 API 端点返回正确数据
- 回退链路（无 JSON 时 scanner 扫描）正常
