# Vercel + Supabase 迁移计划（已废弃）

> ⚠️ 此方案已废弃。最终采用预构建数据方案。当前架构见 `STATUS.md` 和项目根 `CLAUDE.md`。

## 目标

将现有 Express + 本地文件扫描架构，迁移到 Vercel Serverless + Supabase PostgreSQL，同时预留用户注册/订阅入口。

## 架构对比

```
Before                          After
──────────────────────────────────────────────────
Express server.js               Vercel API Routes
本地 .md 文件扫描               Supabase articles 表
MiniSearch 内存索引             Supabase 全文搜索
内存缓存 (Map)                  Supabase 查询
Git pull 同步                   GitHub Action 导入脚本
```

## 项目结构

```
GameInformation/
├── public/                # 前端 SPA（不变）
├── api/                   # Vercel Serverless Functions
│   ├── articles.js        # GET /api/articles, /api/articles/:id
│   ├── search.js          # GET /api/search
│   └── stats.js           # GET /api/stats
├── scripts/
│   └── import.js          # 一次性导入：.md → Supabase
├── supabase/
│   └── migrations/        # 数据库迁移文件
├── lib/                   # 共享工具（保留 parser.js）
└── vercel.json            # Vercel 配置
```

## 数据表设计

```sql
-- 文章表
CREATE TABLE articles (
  id          TEXT PRIMARY KEY,        -- base64url 编码的文件路径
  title       TEXT NOT NULL,
  pipeline    TEXT NOT NULL,           -- 微信资讯 | 自主采集 | 游戏跟踪
  stage       TEXT NOT NULL,           -- 资讯 | 探索 | 研究 | 拆解 | 分析
  date        TEXT,                    -- YYYY-MM-DD
  summary     TEXT,
  tags        TEXT[],                  -- PostgreSQL array
  source      TEXT,
  url         TEXT,
  content     TEXT,                    -- 原始 Markdown
  html        TEXT,                    -- 渲染后的 HTML
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 全文搜索索引
CREATE INDEX idx_articles_fulltext ON articles
  USING GIN (to_tsvector('simple', title || ' ' || summary || ' ' || content));

-- 用户表（由 Supabase Auth 自动创建，这里只做扩展）
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan        TEXT DEFAULT 'free',     -- free | pro | premium
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 预留：订阅表
CREATE TABLE subscriptions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_customer   TEXT,
  stripe_sub        TEXT,
  status            TEXT DEFAULT 'inactive',  -- active | cancelled | past_due
  current_period_end TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 策略（文章公开读，用户表仅本人）
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "articles_public_read" ON articles FOR SELECT USING (true);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_owner" ON profiles FOR ALL USING (auth.uid() = id);
```

## 实施步骤

### Phase 1 — Supabase 建库（先做）

- [ ] 创建 Supabase 项目
- [ ] 运行 migrations 建表
- [ ] 编写 `scripts/import.js`，扫描 reference/ 目录，解析 → upsert 到 Supabase
- [ ] 跑导入，验证数据

### Phase 2 — Vercel API（先做）

- [ ] 初始化 Vercel 项目，配置 Supabase 环境变量
- [ ] 实现 `/api/articles`（查询 + 筛选 + 分页）
- [ ] 实现 `/api/articles/[id]`（详情 + wiki-link 渲染）
- [ ] 实现 `/api/search`（全文搜索）
- [ ] 实现 `/api/stats`（统计聚合）
- [ ] 前端 SPA 部署到 Vercel 静态托管

### Phase 3 — 登录系统（后做）

- [ ] 接入 Supabase Auth（邮箱注册 + GitHub OAuth）
- [ ] 前端登录/注册 UI（弹窗或独立页面）
- [ ] profile 表联动（注册时自动创建）

### Phase 4 — 订阅付费（后做）

- [ ] Stripe 集成
- [ ] Webhook 同步订阅状态
- [ ] `is_premium` 字段，付费文章仅展示摘要
- [ ] 升级引导页

## 环境变量

```
# Vercel
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # 仅导入脚本用
```

## 数据同步策略

不再需要 reference/ 目录在运行时。改为：
1. reference 仓库有新文章 → push 到 GitHub
2. GitHub Action 触发 → 运行 import.js → upsert 到 Supabase
3. Vercel 前端直接从 Supabase 读，永远最新

## 兼容性

- `lib/parser.js` 保留复用，传给 import 脚本
- wiki-link 解析逻辑移到 Vercel API 层（从 Supabase 查 filename → article 映射）
- 前端 `public/` 几乎不改，只改 API base URL
