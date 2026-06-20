# TODO

## 运维

- [x] **自动更新** — ObsidianNote → repository_dispatch → workflow → Vercel（2026-06-13 完成）
- [x] **仓库公开** — 2026-06-19 设为公开，Actions 无限免费
- [x] **设计管线日期** — parser.js 支持 `created:` 字段 + YAML 解析失败正则兜底（2026-06-19）
- [x] **日期提取排除"处理时间"** — parser.js 正则添加 `(?<!处理)` 负向后顾，修正 BUG-002（2026-06-20）
- [ ] **workflow 稳定性** — push 步骤偶尔因 rebase 冲突，本地构建后 force push 作为 workaround
- [ ] **中文文件名编码** — download-articles.js 部分文件名含特殊 Unicode 字符导致 raw URL 404
