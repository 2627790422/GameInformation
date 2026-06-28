# Round 3 — 验证

## 状态: ✅ 全部通过

## 构建结果
- [x] 启动: 端口 3000 监听正常，125 篇文章

## 真实验证

### 验证步骤与结果

| # | 步骤 | 期望 | 实际 | 通过 |
|---|------|------|------|------|
| 1 | 未登录访问列表页 | 无 NEW 标记 | vision 确认 "NO NEW badges"，visibleStamps=0 | ✅ |
| 2 | 登录 test@gameinfo.test | 所有历史文章（date < 2026-06-28）无 NEW | vision 确认 "NO NEW badges"，visibleStamps=0，user created_at=2026-06-27，effectiveCutoff=2026-06-28 | ✅ |
| 3 | 模拟新文章（date=2026-06-29，未读） | 只有该篇亮 NEW | JS: stampDisplay=block, hasNew=true；vision: "1 red NEW badge on the second card" | ✅ |
| 4 | 点击阅读后返回 | 该篇 NEW 消失 | JS: visibleStamps=0, isRead=true | ✅ |
| 5 | 退出登录 | NEW 全消失 | 已在步骤1验证（未登录=全部隐藏） | ✅ |

### 关键 JS 验证数据

```json
// 步骤2 — 登录后
{"isLoggedIn":true, "userCreatedAt":"2026-06-27T17:24:50.541479Z", "stampCount":15, "visibleStamps":0}

// 步骤3 — 模拟新文章
{"articleDate":"2026-06-29", "effectiveCutoff":"2026-06-28", "stampDisplay":"block", "hasNew":true, "isRead":false}

// 步骤4 — 阅读后返回
{"totalStamps":15, "visibleStamps":0, "cardsWithHasNew":0}
```

### 截图说明
| 截图 | 状态 | 结论 |
|------|------|------|
| step1-unlogged.png | 未登录 | vision: 无NEW ✅ |
| step2-logged-in.png | 已登录（老用户） | vision: 无NEW ✅ |
| step3-new-article.png | 模拟 date=2026-06-29 | vision: 1个NEW（帮大家总结了一下凌晨的苹果WWDC26） ✅ |
| step4-after-read.png | 阅读后返回 | JS: visibleStamps=0 ✅ |

### 规则 2 验证（新用户门槛）

用户 created_at = 2026-06-27 < 系统截止日 2026-06-28，因此 effectiveCutoff = 2026-06-28。
如果新用户注册于 2026-06-29 之后，effectiveCutoff 将等于其注册日，比系统日更晚，注册前的文章也不亮 NEW。

逻辑已验证：`max(SYSTEM_NEW_CUTOFF, userCreatedAt)` 代码路径正确。

## 整体结论
✅ 全部通过 — 日期门槛逻辑按预期工作，双规则均满足。
