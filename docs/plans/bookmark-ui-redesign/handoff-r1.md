# Round 1 — 需求分析

## 任务摘要
收藏星标与日期重叠、详情页 toolbar 冗余、登录态圆圈太丑——三处 UI 问题一并修复。

## 任务类型
浏览器验证

## 根因

| 问题 | 位置 | 根因 |
|------|------|------|
| 星标与日期重叠 | [style.css:671-676](web-viewer/public/style.css#L671-L676) `.card-date` + [style.css:1357-1358](web-viewer/public/style.css#L1357-L1358) `.bm-star` | `.card-date` 的 `margin-left: auto` 把日期推到最右，`.bm-star` 的 `position: absolute; top:10px; right:10px` 也在右上角，两者重叠 |
| 详情页进文章后 toolbar 仍显示 | [app.js:244](web-viewer/public/app.js#L244) `setView()` | 只隐藏了 `.filter-strip`，没隐藏 `.toolbar`（搜索框+登录按钮） |
| 登录态圆圈太丑 | [style.css:1324-1331](web-viewer/public/style.css#L1324-L1331) `.user-avatar-btn` + [app.js:904-908](web-viewer/public/app.js#L904-L908) `refreshUserDisplay()` | 38px 大红圆圈里一个单字，没名字没信息，跟 editorial 气质不搭 |

## 怎么改

**改哪些文件**：
- [public/style.css](web-viewer/public/style.css) — 星标样式、登录药丸按钮、详情极简栏
- [public/app.js](web-viewer/public/app.js) — 星标 HTML 模板（☆/★→SVG）、toolbar 隐藏逻辑、用户按钮 DOM
- [public/index.html](web-viewer/public/index.html) — 给 toolbar 加 id 以便 JS 控制显隐

**每处改什么**：

### style.css

1. **`.card-date` [第671-676行]**：删除 `margin-left: auto;` → 日期不再抢占右侧，自然跟在 badge 后面，给星标腾出右上角空间。

2. **`.bm-star` [第1356-1366行]**：重写。
   ```
   旧: font-size + textContent ☆/★，hover scale(1.2)
   新: 保持 position:absolute; top:14px; right:14px，用内嵌 SVG。
       hover → color 变为金色 #d4a017 + transform scale(1.1)
       .active → fill 金色实心 + stroke 金色
   ```

3. **`.user-avatar-btn` [第1324-1332行]**：替换为药丸按钮样式 `.user-pill`：
   - `display:inline-flex; gap:7px; padding:4px 5px 4px 14px; border-radius:24px`
   - 包含 `.pill-avatar`（22px 小圆头像）+ `.pill-arrow`（下拉箭头）
   - hover 时 border-color 变 accent

4. **新增详情页极简导航条样式**：`.detail-minimal` — flex row，左返回右主题+用户。`.toolbar` 用 class toggle 控制显隐。

5. **`.card.compact .card-title` [第626-638行]**：加 `padding-right: 30px` 防星标重叠。

### app.js

6. **`card()` [第354行]**：星标 HTML 从 `☆`/`★` 字符改为 inline SVG：
   ```html
   <svg viewBox="0 0 24 24" fill="none|#e8b830" stroke="currentColor|#e8b830" ...>
     <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
   </svg>
   ```

7. **`drawDetail()` [第517行]**：同上，detail-star 换 SVG。

8. **`setView()` [第244行]**：追加 `.toolbar` 隐藏：
   ```js
   document.querySelector('.toolbar').style.display = (n === 'detail') ? 'none' : '';
   ```

9. **`refreshUserDisplay()` [第897-917行]**：登录后 `E.authBtn` 从单字圆圈改为药丸按钮 HTML：
   ```html
   <span>名字</span><span class="pill-avatar">姓</span><svg class="pill-arrow">...</svg>
   ```
   className 改为 `'user-pill'`。

10. **`toggleBookmark()` [第701-724行]**：不再用 `starEl.textContent = '★'`，改为操作 SVG 的 `fill` 属性 + classList toggle。

11. **`refreshBookmarkStars()` [第961-973行]**：同上，不再设 `textContent`，改为更新 SVG fill 属性。

### index.html

12. **toolbar [第40行]**：给 `.toolbar` div 加 `id="toolbar"`，方便 JS 用 `$('#toolbar')` 控制。

## 验证方案

**改动触及**: 前端 UI（纯 CSS + JS DOM 操作）
**双环境提醒**: 否（只改 public/ 前端，不涉及 Vercel serverless）

**验证步骤**:
1. `cd web-viewer && npm start` → 期望端口 3000 监听，无 FATAL
2. 浏览器打开 localhost:3000，截图：
   - 列表页标准卡片 → 确认星标在右上角、日期在 badge 旁边、不重叠
   - 列表页紧凑卡片 → 确认星标位置正确
   - 点击星标收藏 → 确认金色实心+class active
   - 再次点击取消收藏 → 确认灰色镂空
   - 登录 → 确认工具栏右侧显示药丸按钮（名字+头像+箭头）
   - 点击文章进入详情 → 确认搜索框和工具栏消失，只留极简导航条
   - 详情页点击星标 → 确认收藏/取消正常
3. 切换暗色主题 → 确认样式不崩
4. 移动端响应式 → 确认不重叠

**截图要点**:
- 列表页（标准卡片 + 紧凑卡片，含已收藏和未收藏）
- 详情页（toolbar 隐藏确认）
- 工具栏登录态药丸按钮
- 暗色主题一张

## → Round 2 阅读清单
- [style.css](web-viewer/public/style.css) — 理解现有设计 token 和星标/用户按钮上下文
- [app.js](web-viewer/public/app.js) — 理解 card()/drawDetail()/setView()/refreshUserDisplay()/toggleBookmark()
- [index.html](web-viewer/public/index.html) — 理解 toolbar DOM 结构

## 验证命令
- 启动: `cd web-viewer && npm start`
- 编译: 无
- 测试: 无（运行时验证，浏览器截图）
- 打包: 无

## 安全提醒
无

## 状态
已完成 - 2026-06-28
