# Round 1 — 需求分析

## 任务摘要
NEW 标记增加日期门槛：① 所有早于 2026-06-28 的文章永不显示 NEW；② 新用户注册后，注册前的文章也不显示 NEW，只有注册后入库的新文章才亮 NEW。

## 任务类型
浏览器验证

## 根因
N/A（规则补充，非 bug）

## 当前行为（源码分析）

**NEW 的判定链路**（[app.js:975-994](web-viewer/public/app.js#L975-L994)）：

```
refreshReadBadges()
  → 遍历所有 .card-stamp-new 元素
  → 取卡片 data-id → Auth.isRead(id) 查 reading_history 表
  → 未读过 → display:block（亮 NEW）
  → 已读过 → display:none（灭 NEW）
```

问题：当前只判断"是否已读"，没有日期门槛。用户登录后所有历史文章全亮 NEW。

**数据流**：
- [auth.js:81-85](web-viewer/public/auth.js#L81-L85)：`loadReadHistory()` 从 `reading_history` 表加载已读文章 ID
- [auth.js:88-102](web-viewer/public/auth.js#L88-L102)：`markAsRead(articleId)` 点进详情页时写入已读记录
- [app.js:345-395](web-viewer/public/app.js#L345-L395)：`card()` 渲染卡片 HTML，含 `.card-stamp-new` 元素
- [app.js:505-507](web-viewer/public/app.js#L505-L507)：`loadDetail()` 阅读文章后调 `markAsRead` + `refreshReadBadges`

## 怎么改

**改哪些文件**：
- `public/app.js` — 新增日期截止逻辑，卡片增加 data-date 属性

**每处改什么**：

### 1. [app.js 顶部常量区] 新增系统截止日期
在第 36 行（`PAGE_SIZE` 常量附近）新增：
```js
const SYSTEM_NEW_CUTOFF = '2026-06-28';
```

### 2. [app.js:345-349 card() 函数] 卡片元素增加 data-date 属性
在 `el.setAttribute('data-pipeline', a.pipeline)` 和 `el.setAttribute('data-id', a.id)` 之后新增：
```js
el.setAttribute('data-date', a.date || '');
```
目的：让 `refreshReadBadges()` 能读取每张卡片的文章日期。

### 3. [app.js:975-994 refreshReadBadges()] 重写判定逻辑
当前逻辑：
```
if (!user) → 全部隐藏
if (isRead) → 隐藏
else → 显示
```

新逻辑（两层过滤）：
```
effectiveCutoff = max(SYSTEM_NEW_CUTOFF, user注册日期)

if (!user) → 全部隐藏
if (article.date < effectiveCutoff) → 隐藏（日期门槛，不过）
if (isRead) → 隐藏
else → 显示
```

规则解释：
- **规则 1 "老文章不亮"**：`article.date < '2026-06-28'` → 系统截止日前的文章永不亮 NEW
- **规则 2 "新用户看不到 NEW"**：用户的 `created_at` > 系统截止日时，以用户注册日为准。注册日之前的文章对 ta 也不亮 NEW。只有注册后才入库的新文章才亮。
- 两层过滤后，再走原有的"已读/未读"判断（点进详情 → 写入 reading_history → NEW 消失）

**不需要改 auth.js**：`Auth.getUser()` 返回的 Supabase user 对象已包含 `created_at` 字段（ISO 8601 格式，取前 10 位即 `YYYY-MM-DD`），无需额外暴露。

**不需要改数据库**：`reading_history` 表结构不变，`auth.users.created_at` 已是 Supabase 内置字段。

## 验证方案
**改动触及**: 前端 UI（NEW 标记显隐逻辑）
**是否影响 Vercel 双环境**: 否（仅前端 JS 逻辑变更）

**验证步骤**:
1. `npm start` → 浏览器打开 `localhost:3000`
2. **未登录** → 确认无 NEW 标记（和之前一样）
3. **登录老用户 test@gameinfo.test** → 确认所有文章（date < 2026-06-28）无 NEW
4. 手动修改一篇文章的 date 为 2026-06-29（模拟新文章）→ 刷新 → 确认只有那一篇显示 NEW
5. 点击那篇 NEW 文章进入详情 → 返回 → 确认 NEW 消失
6. **退出登录** → NEW 全消失

**截图要点**:
- 未登录列表页（无 NEW）
- 老用户登录后列表页（无 NEW — 所有文章在截止日前）
- 有一篇 date ≥ 2026-06-28 的文章亮 NEW 的列表页
- 阅读后返回 NEW 消失

## → Round 2 阅读清单
- `public/app.js` — 理解 card()、refreshReadBadges()、现有的 NEW 显隐逻辑
- `public/auth.js` — 理解 Auth.getUser() 返回值包含 created_at

## 安全提醒
无（不改 API 路由，不涉及 token/secret）

## 用户确认
✅ 已确认

## 状态
已完成 - 2026-06-28
