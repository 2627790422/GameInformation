# Round 2 — 实现

## 任务类型
浏览器验证

## 修改文件清单
- `public/style.css` — 删除 `.card-date` 的 `margin-left: auto`；重写 `.bm-star` 为 SVG 样式；替换 `.user-avatar-btn` 为 `.user-pill` + `.pill-avatar` + `.pill-arrow`；`.card.compact .card-title` 加 `padding-right: 30px`
- `public/app.js` — 新增模块级 SVG 常量；`card()` 和 `drawDetail()` 使用 SVG 星标；`toggleBookmark()` 和 `refreshBookmarkStars()` 操作 SVG fill/stroke；`setView()` 隐藏 toolbar 和 moduleToggle；`refreshUserDisplay()` 登录态渲染药丸按钮
- `public/index.html` — toolbar div 添加 `id="toolbar"`

## 与 R1 方案的差异
无

## 修复历史
| 次数 | 反馈来源 | 本次修复 |
|------|---------|---------|
| 1 | （首次实现） | — |

## 关键改动摘要
1. 日期 `margin-left: auto` 移除，不再抢占右上角
2. 星标从 ☆/★ 字符切换到 Feather icons SVG，fill/stroke 控制激活态
3. 登录后从 38px 红圆单字 → 药丸按钮（名字+头像+箭头）
4. 进入详情时 toolbar + moduleToggle 隐藏

## → Round 3 要验证什么
- 启动: `cd web-viewer && npm start`
- 关键验证点:
  1. 列表页标准卡片：星标在右上角、日期在 badge 旁边、不重叠
  2. 列表页紧凑卡片：星标位置正确
  3. 点击星标收藏 → 金色实心 + class active
  4. 再次点击取消收藏 → 灰色镂空
  5. 登录 → 工具栏右侧药丸按钮
  6. 进入详情 → 搜索框和 toolbar 消失，只留极简导航
  7. 暗色主题不崩
  8. 移动端不重叠

## 质检材料
### 启动输出
```
[scanner] 扫描完成，共 125 篇文章
[server] 服务已启动: http://localhost:3000
[server] 文章总数: 125
```
无 FATAL / ERROR
