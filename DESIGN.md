# 游戏资讯展示网页 — 设计方案

## 一、项目背景

用户拥有一个高度自动化的游戏资讯采集分析系统，数据存储在 Obsidian Vault 中，包含三条流水线：

| 流水线 | 约数量 | 数据特征 |
|--------|--------|----------|
| 微信资讯 | ~30篇 | 微信公众号文章采集+AI分析，Format B（blockquote元数据 + Phase 3-6 + 设计笔记） |
| 自主采集 | ~80篇 | 探索→研究→拆解三阶段，拆解文件有 YAML frontmatter，四层拆解模型 |
| 游戏跟踪 | 3字幕+1分析 | B站UP主视频追踪，分析格式与微信资讯一致 |

所有数据为 Markdown 文件，由 `openclaw cron` + AI Agent 自动产出，通过 Git 同步。

## 二、技术选型

| 库 | 用途 |
|---|---|
| `express` | Web 服务器框架 |
| `gray-matter` | 解析 Markdown 文件的 YAML frontmatter |
| `marked` | Markdown 转 HTML |
| `minisearch` | 轻量级全文搜索引擎（支持中文） |
| `mermaid` (CDN) | 客户端渲染 Mermaid 图表 |

## 三、数据格式统一抽象

三条流水线虽格式不同，统一抽象为 Article 模型：

```typescript
interface Article {
  id: string;           // 文件路径唯一标识（URL安全的base64编码）
  title: string;        // 标题
  pipeline: string;     // "微信资讯" | "自主采集" | "游戏跟踪"
  stage: string;        // 阶段：资讯/思想/探索/研究/拆解/字幕/分析
  date: string;         // 发布日期 (YYYY-MM-DD)
  summary: string;      // 摘要（Phase 3 概要总览 或 核心内容前200字）
  tags: string[];       // 标签
  source: string;       // 来源（公众号名/游戏名/UP主名）
  url: string;          // 原始链接（如有）
  content: string;      // 完整 Markdown 内容
}
```

## 四、项目文件结构

```
E:\TryAI\GameInformation\web-viewer\
├── server.js                # Express 服务入口
├── package.json             # 依赖配置
├── DESIGN.md                # 本设计文档
├── lib\
│   ├── parser.js            # Markdown 解析器（统一解析三种格式）
│   ├── scanner.js           # 文件扫描器（读取 Vault 目录）
│   └── search.js            # 全文搜索引擎
└── public\
    ├── index.html           # 主页面（SPA）
    ├── style.css            # 深色主题样式
    └── app.js               # 前端逻辑（时间线、详情、搜索、筛选）
```

## 五、核心模块设计

### 5.1 scanner.js — 文件扫描器

**职责**：扫描 Obsidian Vault 目录，递归读取所有 `.md` 文件，构建内存缓存。

**数据源配置**：
- Vault 根路径：`C:/Users/jiehuiyang/Documents/Obsidian Vault/游戏设计`
- 7 个子流水线路径分别映射到不同的 pipeline 和 stage

**缓存策略**：
- 启动时全量扫描一次
- 提供 `refresh()` 方法手动刷新
- 所有文章存入内存 Map，按 ID 索引

### 5.2 parser.js — Markdown 解析器

**职责**：统一解析三种不同格式的 Markdown 文件。

**解析策略**（按优先级尝试）：

1. **YAML frontmatter 文件**（自主采集-拆解、部分研究文件）
   - 用 `gray-matter` 提取 frontmatter
   - 取 `title`、`date`、`tags`、`source`、`game` 字段

2. **Format B blockquote 文件**（微信资讯、游戏跟踪分析）
   - 从正文首部 blockquote（`> ` 开头行）正则提取：
     - `来源：` → source
     - `发布时间：` → date
     - `原始链接：` → url
   - 从第一个 `# ` 标题提取 title

3. **纯正文文件**（探索结果、研究结果、字幕文件）
   - 从文件名提取 title（去掉扩展名）
   - 从第一个 `# ` 标题确认/覆盖 title
   - 从文件修改时间推断 date
   - 从正文前 200 字提取 summary

**摘要提取**：
- 优先查找 `Phase 3` 或 `概要总览` 段落
- 其次查找 `核心内容` 段落
- 最后取正文前 200 字符

**Mermaid 处理**：
- 将 ```` ```mermaid ```` 代码块转为 `<pre class="mermaid">...</pre>` 标签
- 供前端 `mermaid.run()` 渲染

### 5.3 search.js — 搜索引擎

**职责**：基于 minisearch 实现中文全文搜索。

**索引字段及权重**：
- title：权重 4（最高）
- summary：权重 3
- tags：权重 2
- content：权重 1

**API**：
- `buildIndex(articles)` — 全量重建索引
- `search(query)` — 返回匹配结果，含相关度评分

### 5.4 server.js — Express 服务器

**路由设计**：

| 路由 | 方法 | 说明 |
|------|------|------|
| `/` | GET | 返回 SPA 主页面 |
| `/api/articles` | GET | 文章列表，支持 `?pipeline=&stage=&tag=&sort=date&order=desc` |
| `/api/articles/:id` | GET | 单篇文章详情，含渲染后的 HTML |
| `/api/search?q=xxx` | GET | 全文搜索 |
| `/api/stats` | GET | 统计面板数据 |

**静态文件**：`public/` 目录作为静态资源。

### 5.5 前端 — SPA 单页应用

**设计风格**：深色主题，适合游戏资讯的沉浸式阅读体验。

**配色方案**：
- 背景：`#1a1a2e`（深邃蓝黑）
- 卡片：`#16213e`（深蓝灰）
- 强调色：`#e94560`（霓虹红，用于高亮和交互）
- 次要强调：`#0f3460`（深蓝）
- 文字：`#eee` / `#a0a0b0`

**三个核心视图**：

1. **时间线视图**（主页）
   - 顶部：搜索框 + 流水线/阶段筛选标签
   - 中间：文章卡片流（按日期倒序）
   - 卡片内容：标题、日期、来源徽章、摘要（截断 200 字）、标签

2. **文章详情页**
   - 返回按钮
   - 文章元数据区（标题、日期、来源、标签）
   - 渲染后的 Markdown 正文
   - Mermaid 图表自动渲染

3. **统计面板**（顶栏下拉或侧边栏）
   - 各流水线文章数量
   - 各阶段分布
   - 最近更新日期

**交互特性**：
- 搜索实时过滤 + 搜索建议
- 流水线/阶段标签点击筛选（多选）
- 卡片点击进入详情，ESC 或返回按钮回到列表
- URL hash 路由（`#detail/xxx` 进入详情，支持直接链接）

## 六、数据流

```
启动 server.js
    │
    ▼
scanner.scanAll()
    │ 扫描 Vault 目录下所有 .md 文件
    │ 对每个文件调用 parser.parse()
    ▼
articles[] (内存缓存)
    │
    ▼
search.buildIndex(articles)
    │
    ▼
Express 路由就绪，等待请求
    │
    ├── GET /api/articles → 返回 articles[]（支持筛选排序）
    ├── GET /api/articles/:id → 找到单篇，marked渲染，返回HTML
    ├── GET /api/search?q= → search.search(q)，返回匹配文章
    └── GET /api/stats → 统计 articles 分布
```

## 七、Mermaid 渲染流程

```
Markdown 原文中的 ```mermaid 代码块
        │
        ▼
parser.js: 转换为 <pre class="mermaid">原始代码</pre>
        │
        ▼
marked 渲染时保留 <pre class="mermaid">
        │
        ▼
HTML 返回给前端
        │
        ▼
app.js: 页面加载后调用 mermaid.run({ querySelector: '.mermaid' })
        │
        ▼
Mermaid CDN 库将 <pre> 替换为 SVG 图表
```

## 八、边界情况处理

| 场景 | 处理方式 |
|------|----------|
| 文件无 frontmatter 也无 blockquote | 从文件名和正文推断元数据 |
| 日期格式不统一 | 尝试多种格式解析，失败则用文件修改时间 |
| 文件包含非 UTF-8 字符 | 读取时指定 UTF-8，异常时跳过 |
| 搜索无结果 | 返回空数组，前端显示"未找到相关文章" |
| 文章内容非常大 | summary 截断到 200 字，详情页用分页/懒加载 |
| Vault 路径不存在 | 启动时 warn，返回空文章列表 |
| Mermaid 图表语法错误 | 浏览器端 mermaid 会显示错误提示，不阻塞页面 |

## 九、实施步骤

1. ✅ 初始化项目：创建目录、`npm init`、安装依赖
2. ⬜ 实现 `lib/parser.js`：统一解析三种格式
3. ⬜ 实现 `lib/scanner.js`：扫描 Vault 目录
4. ⬜ 实现 `lib/search.js`：全文搜索索引
5. ⬜ 实现 `server.js`：Express 路由和 API
6. ⬜ 实现前端页面：HTML + CSS + JS
7. ⬜ 测试验证：启动服务器，验证所有功能
