# Round 2 — 实现

## 任务类型
浏览器验证

## 修改文件清单
- `public/app.js` — 新增 SYSTEM_NEW_CUTOFF 常量 + card() 加 data-date + refreshReadBadges() 重写日期门槛

## 与 R1 方案的差异
无差异，完全按方案实施。

## 修复历史
| 次数 | 反馈来源 | 本次修复 |
|------|---------|---------|
| 1 | 首次实现 | 三处改动：常量 + data-date + 双门槛判定 |

## 关键改动摘要

### 改动 1 — [app.js:38](web-viewer/public/app.js#L38) 新增截止常量
```js
const SYSTEM_NEW_CUTOFF = '2026-06-28';
```

### 改动 2 — [app.js:353](web-viewer/public/app.js#L353) 卡片增加日期属性
```js
el.setAttribute('data-date', a.date || '');
```

### 改动 3 — [app.js:978-1007](web-viewer/public/app.js#L978) refreshReadBadges() 双门槛判定
```
effectiveCutoff = max(SYSTEM_NEW_CUTOFF, user.created_at)

article.date < effectiveCutoff  → 隐藏
Auth.isRead(id)                 → 隐藏
否则                            → 显示
```

## → Round 3 要验证什么
- 启动: `cd web-viewer && npm start`
- 关键验证点:
  1. 未登录 → 无 NEW
  2. 老用户登录 → 所有 date < 2026-06-28 的文章无 NEW
  3. 手动修改一篇 date ≥ 2026-06-28 → 只有这篇亮 NEW
  4. 点击阅读那篇 → NEW 消失
- 验证手段: 浏览器 + 截图

## 质检材料
### 启动输出
```
[scanner] 扫描完成，共 125 篇文章
[server] 服务已启动: http://localhost:3000
[server] 文章总数: 125
[server] 按 Ctrl+C 停止服务
```
