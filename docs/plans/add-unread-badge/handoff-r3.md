# Round 3 — 验证

## 状态: ✅ 全部通过

## 修复历史
| 次数 | 反馈来源 | 本次修复 |
|------|---------|---------|
| 1 | R3 首次验证 | `refreshReadBadges()` 中 `stamp.style.display = ''` 无法覆盖 CSS `display:none` → 改为 `stamp.style.display = 'block'` |

## 验证结果

| 步骤 | 期望 | 实际 | 通过 |
|------|------|------|------|
| a. 未登录 | 无 NEW 戳记 | 15 个 stamp 全部 `display:none` | ✅ |
| b. 登录后 | 左上角显示红色旋转 NEW 戳记 | 14/15 visible，1 篇已读隐藏（之前测试遗留 reading_history） | ✅ |
| c. 读一篇后返回 | 该篇戳记消失，其余保留 | visible 13/15，hidden 2/15 | ✅ |
| d. 退出登录 | 戳记全消失 | 15 个 stamp 全 `display:none` | ✅ |

## 截图
截图中戳记正常显示在卡片左上角，红框衬线体、旋转 -6deg，视觉符合方案A朱砂戳记设计。

## 质检材料
- 启动: `npm start` → 端口 3000，125 篇文章，无 FATAL/ERROR
- Supabase reading_history 表 RLS 正常，读写无误
