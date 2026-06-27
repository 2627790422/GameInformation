# Round 2 — 实现

## 任务类型
浏览器验证

## 修改文件清单
- `public/index.html` — 去掉 `mt-trigger` 折叠条，扁平化为两个 `mt-btn`
- `public/style.css` — 重写 `.module-toggle`：去掉 hover 展开，按钮始终可见
- `public/app.js` — 删除 open/close 状态管理、mt-current 更新、外部点击关闭

## 与 R1 方案的差异（如有）
无差异，严格按 R1 方案执行。

## 修复历史
| 次数 | 反馈来源 | 本次修复 |
|------|---------|---------|
| 1 | （首次实现） | — |

## 关键改动摘要
- HTML：删掉 `<div class="mt-trigger">` 及子元素，`.mt-panel` 提升为顶层直接子元素
- CSS：删掉 ~90 行 hover 展开/折叠样式（`.mt-trigger`、`.mt-current`、`.mt-arrow`、expand 动画等），替换为 40 行始终可见样式。按钮从 0.82rem → 0.92rem，padding 从 7px 30px → 8px 34px
- JS：删掉 `open` class 切换、`mt-current` 文本更新、document click 关闭监听

## → Round 3 要验证什么
- 启动: `cd web-viewer && npm start`
- 关键验证点: 主界面两个按钮始终可见、切换模块正常、detail 页隐藏
- 验证手段: 浏览器 DOM 检查 + 截图

## 质检材料
### 启动输出
npm start 正常监听端口 3000
