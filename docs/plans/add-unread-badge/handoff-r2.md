# Round 2 — 实现

## 任务类型
浏览器验证

## 修改文件清单
- `public/auth.js` — 新增 `_readArticles` Set、`loadReadHistory()`、`markAsRead(articleId)`、`isRead(articleId)`。在 `init()`/`onAuthStateChange`/`signIn()`/`signUp()` 中加载历史，在 `signOut()` 和登出回调中清空。暴露 `markAsRead` 和 `isRead` 到 `window.Auth`
- `public/app.js` — `card()` 插入戳记 `<span class="card-stamp-new">NEW</span>`；`loadDetail()` 成功后调 `markAsRead()` + `refreshReadBadges()`；新增 `refreshReadBadges()` 遍历戳记控制 `has-new` 类；`refreshBookmarkStars()` 末尾调用 `refreshReadBadges()`
- `public/style.css` — 朱砂戳记 CSS：`.card.has-new { overflow:visible }`、`.card-stamp-new` 左上角旋转、红框衬线体、暗色适配、`stampIn` 进场动画

## 与 R1 方案的差异（如有）
无实质性差异。严格按方案实现。

## 修复历史
| 次数 | 反馈来源 | 本次修复 |
|------|---------|---------|
| 1 | （首次实现） | — |

## 关键改动摘要
1. **auth.js**：完全复用 bookmarks 模式 — `_readArticles` Set 同级 `_bookmarks`，`loadReadHistory()`/`markAsRead()`/`isRead()` 与 `loadBookmarks()`/`addBookmark()`/`isBookmarked()` 对称
2. **app.js card()**：戳记插入卡片最前面，带 `data-id`，`refreshReadBadges()` 遍历所有戳记同步登录态和已读状态
3. **style.css**：朱砂戳记绝对定位 `top:10px; left:-6px`，`transform:rotate(-6deg)`，进场 `stampIn` 动画，卡片 `.has-new` 时 `overflow:visible`

## → Round 3 要验证什么
- 启动: `cd web-viewer && npm start`
- 关键验证点:
  1. 未登录 → 无戳记
  2. 登录 test@gameinfo.test → 全部文章显示红色 NEW 印章
  3. 点一篇进详情 → 返回 → 该文印章消失
  4. 退出登录 → 印章全部消失
  5. 切换模块（游戏/AI）→ 戳记正确显示
  6. 亮/暗双主题 → 戳记颜色切换
- 验证手段: 浏览器实际操作 + 截图

## 质检材料
### 启动输出
```
npm start → 端口 3000（或备用 3001），扫描 125 篇文章，无 FATAL/ERROR
Supabase reading_history 表已创建且 RLS 启用
```
