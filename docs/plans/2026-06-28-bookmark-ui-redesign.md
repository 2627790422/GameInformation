# 收藏星标与登录态 UI 改版

**日期**: 2026-06-28
**状态**: 已完成

---

## 背景

三个 UI 问题：

| 问题 | 根因 |
|------|------|
| 收藏星标与日期重叠 | `.card-date` 的 `margin-left: auto` 把日期推到最右，`.bm-star` 的 `position: absolute` 也在右上角 |
| 详情页仍显示搜索框和登录头像 | `setView()` 只隐藏了 `.filter-strip`，没隐藏 `.toolbar` |
| 登录后单字圆圈太丑 | `.user-avatar-btn` 是 38px 红圆+单字，无名字 |

## 方案

1. `.card-date` 删除 `margin-left: auto`，日期自然跟在 badge 后面
2. 星标 ☆/★ 字符 → Feather SVG，保持右上角 absolute，激活态金色填充
3. 登录态从单字圆圈 → 药丸按钮：名字 + 小头像 + 下拉箭头
4. 详情页隐藏 toolbar + moduleToggle，只留返回+主题+用户

## 修改文件

- `public/style.css` — 星标/用户按钮/详情导航样式
- `public/app.js` — SVG 星标 + toolbar 隐藏 + 用户按钮 DOM
- `public/index.html` — toolbar 加 id

## 验证

npm start + 浏览器截图，GLM-4.6V 逐项检查，9/9 通过。

## 详情

→ [handoff 文件](bookmark-ui-redesign/handoff-r1.md)
