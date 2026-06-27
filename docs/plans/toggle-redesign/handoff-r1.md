# Round 1 — 需求分析

## 任务摘要
模块切换栏从"hover 展开"改为"始终可见 pill 组"，让新用户一眼就能发现游戏/AI 频道切换。

## 任务类型
浏览器验证

## 根因
[style.css:434-448] `.mt-panel` 默认 `max-height: 0; opacity: 0`，两个模块按钮被藏在 hover 才能看到的折叠面板里。新用户只见 26px 灰字 "A I ▾"，完全察觉不到点击后能切换频道。

## 怎么改

**改哪些文件**：
- `public/index.html` — 简化 HTML，去掉 `mt-trigger` 折叠条，扁平化为两个按钮
- `public/style.css` — 重写 `.module-toggle` 样式，去掉 hover 展开逻辑，按钮常显
- `public/app.js` — 删除 open/close 状态管理、mt-current 更新、外部点击关闭逻辑

**每处改什么**：
1. `index.html` 第 17-26 行：`mt-trigger` + `mt-panel` 嵌套 → 扁平 `.mt-panel` + 两个 `.mt-btn`（去掉 trigger 层）
2. `style.css` 第 382-480 行：hover 展开 26px 高 → 始终可见 ~44px 高，按钮常显，选中沿用 accent pill
3. `app.js` 第 107-121 行：click 处理折叠/展开 + 模块切换 → 只保留模块切换逻辑
4. `app.js` 第 138-144 行：删除 `mt-current` 标签更新（不再需要）
5. `app.js` 第 124-126 行：删除 `document click` 关闭 toggle（不再需要）

## 验证方案
**改动触及**: 前端 UI
**是否影响 Vercel 双环境**: 否
**验证步骤**:
1. `npm start` → 打开浏览器访问 `localhost:3000`
2. 主界面：确认两个 pill 按钮 "游 戏" / "A I" 始终可见
3. 模块切换：点击 "游 戏" → 列表切换 → active 态更新
4. 点击文章进入 detail → 确认 toggle 栏 + toolbar 隐藏
5. 返回列表 → toggle 栏重新出现
6. 切换亮/暗主题 → 确认两种主题都正常
**截图要点**: 主界面（AI 激活）、主界面（游戏激活）、detail 页（隐藏）、暗色主题

## → Round 2 阅读清单
- `public/index.html` 17-26 行 — module toggle HTML 结构
- `public/style.css` 382-480 行 — module toggle CSS
- `public/app.js` 107-126, 138-144, 250-258 行 — 模块切换逻辑 + setView 隐藏逻辑

## 安全提醒
无
