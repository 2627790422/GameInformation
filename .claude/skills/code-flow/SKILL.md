---
name: code-flow
description: >
  GameInformation 专属代码修改流程，带质量门控。把每次改动拆成需求分析→实现→验证→收尾四轮，
  每轮独立子Agent 执行 + 独立质检，防止跳过规划和验证的随手修复。Round 4 自动执行洁癖审查
  （安全扫描 + 文档同步 + 一致性检查 + 记忆更新）。触发词：改代码、修 bug、实现功能、
  加功能、重构、code-flow、fix、implement、refactor。只要用户描述了一个需要落到代码上的改动，
  就该触发，即使没说"走流程"。
---

# GameInformation 代码修改流程

## 为什么需要这个流程

GameInformation 是一个无编译步骤、无测试框架、无打包产物的"三无"项目。通用 code-flow 假设项目有 jest + tsc + dist/，直接套用会产生大量"编译: 无 / 测试: 无"的冗余字段，TDD 策略也无法执行。

这个项目定制版保留了四轮质量门控骨架（R1 分析 → R2 实现 → R3 验证 → R4 收尾+审查），但把所有验证手段替换为项目实际可用的工具：`npm start`、curl、浏览器截图。同时把 neat-freak 的文档审查逻辑合并到 Round 4，确保每次改动完成后文档和记忆都跟上。

## 全局铁律

1. **Bug 不许猜** — 没找到根因的修复等于埋新雷。必须定位到具体文件:行号。
2. **不许脑补验证** — `npm start` + 浏览器实际操作，拿截图或 curl 输出当证据。
3. **大改动先出方案** — 涉及多文件或架构变化，等用户点头再动手。
4. **密钥不落盘** — PAT、Supabase key 只在环境变量或 GitHub Secrets 里存在。

## 快速 vs 标准判定

满足**全部**条件走快速通道（主Agent 直接改，不写 handoff，不 spawn 子Agent），否则走标准四轮：

| 条件 | 要求 |
|------|------|
| 改动范围 | 单文件 |
| 接口变更 | 无 |
| 运行时验证 | 不需要新增验证步骤 |
| 预估行数 | < 30 行 |
| **兜底** | **拿不准就走标准流程** |

## 任务类型：项目能真实执行的策略

不是照搬通用 code-flow 的"TDD / 诊断优先 / 重构"——项目没有测试框架，TDD 不可行。用这四种：

| 类型 | 适用场景 | R2 策略 |
|------|---------|---------|
| **诊断优先** | UI 渲染 bug、样式问题、后端逻辑 bug（parser/scanner/search 行为异常） | 复现 → 定位到代码行 → 修复 → 浏览器截图或 curl 确认 |
| **浏览器验证** | `public/` 前端新功能 | 写代码 → `npm start` → 浏览器走全流程 → 截图关键状态 |
| **运行时验证** | `api/` / `scripts/` / `lib/` 新增功能 | 写代码 → `node` 直跑 或 curl 端点 → 检查输出 |
| **重构** | 不改变行为的代码整理 | 确认 `npm start` 无报错 + 浏览器功能无退化 |

## 命令速查

| 命令 | 用途 | 执行目录 |
|------|------|---------|
| `npm start` | 启动 Express → `localhost:3000` | `web-viewer/` |
| `npm run build` | 手动构建 `data/*.json` | `web-viewer/` |
| `node scripts/build-data.js` | 同 build，直接调用 | `web-viewer/` |
| `node scripts/download-articles.js` | 从 GitHub API 下载 .md | `web-viewer/` |
| `curl localhost:3000/api/articles?limit=5` | 验证列表 API | — |
| `curl localhost:3000/api/search?q=游戏` | 验证搜索 API | — |
| `curl localhost:3000/api/stats` | 验证统计 API | — |

## 验证策略：改什么文件，用什么手段

| 改动文件 | 验证方式 |
|---------|---------|
| `public/*` | `npm start` → 浏览器操作 → 截图关键状态 |
| `server.js` | `npm start` → curl API + 浏览器确认 |
| `api/*.js` | `npm start` → curl 端点 → 浏览器确认。**额外检查 Vercel 兼容性**：`require` 语句在顶层，不要在 handler 外同步调用 `fs`/`path` 等 Node 原生模块 |
| `lib/parser.js` | `node -e "require('./lib/parser')"` 无报错 → `npm start` → 检查文章解析 |
| `lib/scanner.js` | 设 `VAULT_PATH` → `npm start` → 检查文章数量和日期 |
| `lib/search.js` | `npm start` → curl 搜索端点 → 检查返回 |
| `scripts/*.js` | `node scripts/xxx.js` 看输出 |
| `.github/workflows/*.yml` | push 后看 Actions 日志 |

## 产出目录

所有文件放在 `web-viewer/docs/plans/<task-slug>/`，一个任务一个文件夹：

```
web-viewer/docs/plans/<task-slug>/
├── handoff-r1.md    (R1 → R2)
├── handoff-r2.md    (R2 → R3)
├── handoff-r3.md    (R3 → R4)
└── handoff-r4.md    (最终总结)
```

task-slug：R1 确定，2-4 个小写单词连字符（如 `fix-date-parser`、`add-bookmark-search`）。R4 完成后保留。

**相关路径**：

| 用途 | 路径 |
|------|------|
| 方案/手递文件 | `web-viewer/docs/plans/<task-slug>/` |
| Bug 记录 | `web-viewer/docs/bug/BUG-XXX.md` |
| Bug 索引 | `web-viewer/docs/bug/Index` |
| 文档索引 | `web-viewer/docs/Index.md` |

---

## Round 1 — 需求分析

**执行者**：主Agent，不 spawn 子Agent。分析需要广上下文，且 R1 后要跟用户确认。

**操作步骤**：

1. 读 `e:\TryAI\GameInformation\CLAUDE.md` 获取项目约定
2. 读相关源码，将根因定位到**具体文件和行号**（别猜）
3. 从四种任务类型中选定一个
4. **安全审查**：方案如果涉及写入 token 或 Supabase key → 阻断，改用环境变量
5. 如果改 `api/*.js`：标注本地 Express vs Vercel Serverless 双环境差异
6. 定 task-slug，创建 `web-viewer/docs/plans/<slug>/`，写 `handoff-r1.md`
7. **用大白话向用户展示**：因果链 → 怎么改 → 怎么验证
8. 用户确认后，更新 `web-viewer/docs/Index.md`

**handoff-r1.md 模板**：

```markdown
# Round 1 — 需求分析

## 任务摘要
[一句话]

## 任务类型
[诊断优先 / 浏览器验证 / 运行时验证 / 重构]

## 根因
[文件:行号 + 技术原因；新功能写 N/A]

## 怎么改
**改哪些文件**：
- `path/to/file` — [改什么，为什么]

**每处改什么**：
1. [文件] [第N行]：[当前行为] → [目标行为]，[原因]

## 验证方案
**改动触及**: [前端 UI / Express 路由 / Vercel API / 脚本 / 数据管线]
**是否影响 Vercel 双环境**: [是 / 否]
**验证步骤**:
1. [步骤] → 期望 [结果]
**截图要点**: [需要截哪些状态，如不需要写"无"]

## → Round 2 阅读清单
- [文件] — [读完要知道什么]

## 安全提醒
[涉及 token/key 写具体风险；没有就写"无"]

## 用户确认
[等用户打勾]
```

**主Agent 自检清单**（5 项）：

| # | 检查项 |
|---|--------|
| C1 | "怎么改"具体到文件和行号？用户读完知道改什么、为什么？ |
| C2 | 根因定位到代码行，不是泛泛而谈？ |
| C3 | 验证方案写了具体步骤和期望结果？ |
| C4 | 改动触及 `api/*.js` 时标注了 Vercel 双环境？ |
| C5 | 安全审查已过（无 token/key 落盘）？ |

---

## Round 2 — 定位 & 实现

**执行者**：general-purpose 子Agent。上下文从零开始，只装 handoff + 源文件，无讨论噪音。

**子Agent prompt 模板**（把 ## 方案 后的内容替换为 handoff-r1 全文）：

```
你是 Round 2 实现 agent。你是独立子Agent，只读到本 prompt 的内容，
没有其他上下文。按以下方案写代码。

## 方案
[粘贴 handoff-r1 全文]

## 操作步骤
1. 读阅读清单中的源文件
2. 按任务类型写代码：
   - 诊断优先: 复现 → 定位根因 → 修复 → 截图/curl 确认。禁止猜测。
     3 次不过停下来质疑架构。
   - 浏览器验证/运行时验证: 写最小实现 → 启动服务确认无报错
   - 重构: 不改行为 → 启动服务确认无报错 + 功能正常
3. cd web-viewer && npm start（确认无 FATAL/ERROR，端口 3000 监听）
4. 返回结果

注意事项：
- 只改方案中列出的文件（新增文件需记录原因）
- 小偏差自己调并记录差异；遇到方案没覆盖的大问题，记录但不自行扩大范围
- 改 api/*.js 时检查 Vercel 兼容性（handler 外用 Node API 会导致 serverless 启动失败）

## 返回格式
## 改动摘要
[改了什么，为什么]
## 修改文件清单
- path/to/file — 说明
## 与 R1 方案的差异（如有）
[差异 + 原因]
## 启动验证
[npm start 输出，确认无 FATAL/ERROR]
```

**handoff-r2.md 模板**：

```markdown
# Round 2 — 实现

## 任务类型
[与 R1 一致]

## 修改文件清单
- xxx

## 与 R1 方案的差异（如有）
[差异 + 原因]

## 修复历史
| 次数 | 反馈来源 | 本次修复 |
|------|---------|---------|
| 1 | （首次实现） | — |

## 关键改动摘要
[要点]

## → Round 3 要验证什么
- 启动: `cd web-viewer && npm start`
- 关键验证点: [最易出问题的场景]
- 验证手段: [浏览器 / curl / 截图]

## 质检材料
### 启动输出
[原始 npm start 输出]
```

**QA checklist**（Explore 子Agent 只读 handoff-r2.md，5 项）：

| # | 检查项 |
|---|--------|
| C1 | 代码解决了 R1 的根因？偏差有记录？ |
| C2 | npm start 无 FATAL/ERROR？ |
| C3 | 改动有对应的验证步骤？ |
| C4 | 文件清单与 R1 方案基本一致？ |
| C5 | → R3 的验证指令明确具体？ |

---

## Round 3 — 构建 & 验收

**执行者**：general-purpose 子Agent。**R3 不改代码，只发现问题。**

**子Agent prompt 模板**：

```
你是 Round 3 验证 agent。你是独立子Agent，只读到本 prompt 的内容。
跑验证，不改代码。

## 改动信息
[粘贴 handoff-r2 全文]

## R1 验证方案
[粘贴 handoff-r1 的"验证方案"章节]

## 操作步骤
1. cd web-viewer && npm start（确认启动正常）
2. 严格按 R1 验证方案执行：
   - 前端改动: 打开浏览器访问 localhost:3000，执行用户操作流程，截图关键状态
   - API 改动: curl 端点，检查返回值和 HTTP 状态码
   - 脚本改动: node scripts/xxx.js，检查 stdout
3. 改了什么截什么（列表页/详情页/搜索结果/报错页/关键交互态）
4. 返回结果

## 返回格式
## 构建结果
- [x] 启动: [端口 3000 监听 / 失败原因]

## 真实验证
### 验证步骤与结果
| 步骤 | 期望 | 实际 | 通过 |
|------|------|------|------|
| 1. xxx | xxx | xxx | ✓/✗ |

### 截图说明
[每张截图：什么状态、验证什么、结果]

## 整体结论
[✅ 通过 / ❌ 不通过]
```

**handoff-r3.md 模板**：

✅ 全部通过：
```markdown
# Round 3 — 验证
## 状态: ✅ 全部通过
## 验证结果
[步骤表 + 截图说明]
## 质检材料
[npm start 输出]
```

❌ 验证失败：
```markdown
# Round 3 — 验证
## 状态: ❌ 验证不通过
## 失败清单
- [步骤] → 期望 xxx / 实际 xxx
## 建议方向
[R3 分析，R2 自己判断是否采纳]
```

**QA checklist**（Explore 子Agent，5 项）：

| # | 检查项 |
|---|--------|
| C1 | 启动无 FATAL/ERROR？ |
| C2 | 验证步骤与 R1 方案一致？ |
| C3 | 期望 vs 实际逐条有结论？ |
| C4 | 前端改动有截图？ |
| C5 | 失败项有明确描述和建议？ |

---

## Round 4 — 收尾 + 洁癖审查

**执行者**：general-purpose 子Agent。

**做两件事**：① 业务收尾（Bug 记录 / 方案标记 / 变更摘要）② 洁癖审查（安全扫描 + 文档同步 + 一致性检查 + 记忆更新）。

**子Agent prompt 模板**：

```
你是 Round 4 收尾 agent。你是独立子Agent，只读到本 prompt 的内容。
做业务收尾 + 洁癖审查。

## 改动信息
[粘贴 handoff-r2 全文]
## 验证结果
[粘贴 handoff-r3 全文]

## 操作步骤

### A. 业务收尾（按任务类型选一条）

**Bug 修复**:
1. 读 web-viewer/docs/bug/Index，确定下一可用 ID（目录不存在则创建）
2. 写 web-viewer/docs/bug/BUG-XXX.md，包含：状态(fixed)、日期、
   严重程度(critical/major/minor/cosmetic)、来源、现象、根因(文件:行号)、
   修复说明、修改文件清单
3. 更新 web-viewer/docs/bug/Index 追加一行

**新功能**:
1. 在方案文件夹末尾追加 "## 状态\n已完成 - YYYY-MM-DD"

**重构**:
1. 从 handoff-r2/r3 提取变更摘要

4. 更新 web-viewer/docs/Index.md

### B. 洁癖审查

5. **安全扫描** — 在本次改动的文件中搜索敏感信息：
   grep -nE "(github_pat_|sb_secret_|sk-[A-Za-z0-9]{20,})" <改动的文件>
   注意：public/auth.js 中的 SUPABASE_ANON_KEY 是公开匿名密钥，不算泄露。
   发现敏感信息立即报告。

6. **文档同步** — 检查是否需要更新：
   - 改了 api/*.js → README.md 的 API 表需要更新吗？
   - 改了 scanner.js 流水线 → CLAUDE.md 的流水线表需要更新吗？
   - 加了新依赖 → package.json 一致，README 技术栈需要更新吗？
   → 需要就改

7. **一致性检查（5 项）**:
   - C1: CLAUDE.md 项目结构与实际目录一致？
   - C2: docs/Index.md 链接了所有 docs/ 下的文档？
   - C3: 5 条流水线在 CLAUDE.md、README.md、scanner.js 中一致？
   - C4: vercel.json buildCommand 是 "echo prebuilt"？
   - C5: 无相对时间残留（grep "今天|昨天|刚刚|最近|上周" 清零）？

8. **记忆更新** — 检查是否需要更新：
   ~/.claude/projects/e--TryAI-GameInformation/memory/MEMORY.md
   ~/.claude/projects/e--TryAI-GameInformation/memory/*.md
   有过期事实就更新，相对时间改绝对日期（如 2026-06-28）

## 返回格式
## 业务收尾
- [做了什么]

## 洁癖审查
### 安全扫描
[通过 / 发现问题（具体描述）]

### 文档同步
[需要改的文件 + 改了什么，或"无需变更"]

### 一致性检查
| # | 结果 | 说明 |
|---|------|------|
| C1 | ✓/✗ | |
| C2 | ✓/✗ | |
| C3 | ✓/✗ | |
| C4 | ✓/✗ | |
| C5 | ✓/✗ | |

### 记忆更新
[改了什么，或"无需变更"]

## 产物
[路径列表]
```

**handoff-r4.md** 写法同上返回格式。

**QA checklist**（Explore 子Agent，4 项）：

| # | 检查项 |
|---|--------|
| C1 | 业务收尾与任务类型匹配？Bug 写了记录 / 新功能标了完成 / 重构有摘要 |
| C2 | 安全扫描执行了且有明确结果？ |
| C3 | 一致性检查 5 项都有结论（✓/✗ + 说明）？ |
| C4 | 产物路径完整？ |

---

## R3→R2 回环

R3 验证失败时，spawn R2 修复子Agent：

```
你是 Round 2 修复 agent。独立子Agent。R3 验证未通过。

## 原始方案
[粘贴 handoff-r1 全文]

## R3 失败清单
[粘贴 handoff-r3 失败清单]

## 操作步骤
1. 只修失败项，不扩大范围
2. cd web-viewer && npm start（确认无报错）
3. 在 handoff-r2 "修复历史" 末尾追加一行
4. 返回改动摘要 + 启动输出
```

任一轮 spawn ≥3 次 → 升级给用户决策。

---

## 特殊规则

1. **PAT 最高优先级** — 发现 token 写入文件立即阻断
2. **DESIGN.md 不更新** — 项目初期历史文档，只确认过时标注存在
3. **docs/MIGRATION.md 不删除** — 保留供参考
4. **Supabase 相关代码未启用** — `import.js`、`migrate.js`、`supabase/` 是预留代码，不删但安全风险要标注
5. **Vercel 双环境** — 改 `api/*.js` 时必提醒：本地 Express 用 scanner 扫描，Vercel 优先读 `data/*.json`
6. **parser.js 日期优先级** — `date:` > `created:` > 正文 `发布时间` > 标题 > 文件名；正则要排除"处理时间"
