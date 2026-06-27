# Round 1 — 需求分析

## 任务摘要
已登录用户在文章卡片上看到"NEW"标记，标识自己尚未阅读的文章。进入详情页自动标记为已读，NEW 标记消失。

## 任务类型
浏览器验证

## 根因
N/A（新功能）

## 怎么改

**改哪些文件**：
- `public/auth.js` — 新增阅读记录方法（markAsRead、getReadArticles、isRead），与现有 bookmarks 模式一致
- `public/app.js` — 卡片渲染时显示 NEW 徽章，进入详情页标记已读
- `public/style.css` — NEW 徽章样式
- Supabase — 新建 `reading_history` 表（通过 MCP migration）

**每处改什么**：

### 1. Supabase 数据库 — 新建 `reading_history` 表
```sql
CREATE TABLE reading_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  article_id TEXT NOT NULL,
  read_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, article_id)
);
-- RLS: 用户只能读写自己的记录
```

### 2. `public/auth.js` — 新增阅读追踪方法
- 在 State 区新增 `_readArticles = new Set()`
- 在 `init()` 中登录后调用 `loadReadHistory()`
- 在 `onAuthStateChange` 中退出时清空 `_readArticles`
- 新增方法：
  - `loadReadHistory()` — 从 Supabase 查询当前用户的所有 `article_id`
  - `markAsRead(articleId)` — 插入 `reading_history`，忽略重复
  - `isRead(articleId)` — 检查 Set
  - 暴露到 `window.Auth`

### 3. `public/app.js` — 卡片 NEW 戳记 + 阅读标记
- **card() 函数**（约第 360 行）：在卡片 HTML 最前面插入 `<span class="card-stamp-new">NEW</span>`，当 `Auth.isRead(a.id)` 返回 false 时显示；同时给 `.card` 添加类 `has-new`
- **loadDetail() 函数**（约第 506 行）：加载文章详情后调用 `Auth.markAsRead(id)`，然后 `refreshReadBadges()` 更新页面上的戳记
- **init()**（约第 999 行）：Auth 初始化完成后调用 `refreshReadBadges()`
- **refreshBookmarkStars()**：在其末尾追加 `refreshReadBadges()` 调用
- 新增 `refreshReadBadges()` 函数：遍历所有 `.card-stamp-new`，根据 `Auth.isRead()` 切换显隐

### 4. `public/style.css` — 朱砂戳记样式（方案A）
- **`.card-stamp-new`**：绝对定位 `top:10px; left:-6px`，衬线体（Noto Serif SC），`0.66rem/800`，空心红框 `border:2px solid #c0392b`，`transform:rotate(-6deg)`，`z-index:5`
- **进场动画**：`@keyframes stampIn` — 从放大+透明 → 缩小+不透明，0.35s
- **暗色主题**：边框和文字改为 `#f07050`
- **`.card` 容器**：需添加 `overflow:visible` 以允许戳记超出卡片边界

## 验证方案
**改动触及**: 前端 UI + Supabase 数据
**是否影响 Vercel 双环境**: 否（纯前端 + Supabase 变更，不涉及 API 路由）

**验证步骤**:
1. `npm start` → 浏览器打开 `localhost:3000`
2. 未登录状态 → 确认无 NEW 标记显示
3. 登录 test@gameinfo.test → 确认所有文章显示橙色 "NEW" 徽章
4. 点击一篇文章进入详情 → 返回列表 → 确认该文章的 NEW 标记消失
5. 退出登录 → 确认 NEW 标记全部消失
6. 切换模块（游戏/AI）→ 确认 NEW 标记正确显示

**视觉风格**: 方案A — 朱砂戳记。详见 `visual-draft.html`（浏览器打开查看）
- 左上角定位 · 衬线体 · 空心红框 · -6°旋转 · 报纸印章美学
- 亮色: 红框 `#c0392b` · 暗色: 橙框 `#f07050`
- 进场动画: 0.35s 印章盖下

**截图要点**:
- 未登录列表页（无戳记）
- 登录后列表页（左上角红色 NEW 印章，轻微倾斜）
- 阅读后返回列表页（已读文章印章消失）
- 详情页（无戳记）
- 切换亮/暗主题各截一张

## → Round 2 阅读清单
- `public/auth.js` — 理解现有 bookmarks 模式，阅读追踪完全复用这个模式
- `public/app.js` — 理解 card() 函数结构、loadDetail() 流程、refreshBookmarkStars() 刷新模式
- `public/style.css` — 理解现有 badge 样式（card-badge、card-top），NEW 标记走同样的设计语言
- `public/index.html` — 了解 CDN 引用和脚本加载顺序

## 验证命令（从项目说明书获取）
- 启动: `cd web-viewer && npm start`
- 编译: 无
- 测试: 无，用浏览器验证
- 打包: 无

## 安全提醒
- Supabase ANON KEY 已在 `public/auth.js` 中，是公开匿名密钥，不算泄露
- 新增 `reading_history` 表需启用 RLS，确保用户只能读写自己的记录

## 用户确认
✅ 已确认 — 方案A（朱砂戳记），进入 R2 实现。

## 状态
已完成 - 2026-06-28
