-- 001_init.sql — 初始化数据库表

-- 文章表
CREATE TABLE articles (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  pipeline    TEXT NOT NULL,
  stage       TEXT NOT NULL,
  date        TEXT,
  summary     TEXT,
  tags        TEXT[],
  source      TEXT,
  url         TEXT,
  content     TEXT,
  html        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 全文搜索索引
CREATE INDEX idx_articles_fulltext ON articles
  USING GIN (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(summary,'') || ' ' || coalesce(content,'')));

-- 日期索引（按日排序 + 筛选）
CREATE INDEX idx_articles_date ON articles (date DESC);

-- 流水线索引
CREATE INDEX idx_articles_pipeline ON articles (pipeline);

-- 用户扩展表（Supabase Auth 自动创建 auth.users，这里只做扩展）
CREATE TABLE profiles (
  id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan  TEXT DEFAULT 'free',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 预留：订阅表
CREATE TABLE subscriptions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_customer   TEXT,
  stripe_sub        TEXT,
  status            TEXT DEFAULT 'inactive',
  current_period_end TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- RLS：文章公开可读
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY articles_public_read ON articles FOR SELECT USING (true);

-- RLS：用户扩展仅本人可读写
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_owner ON profiles FOR ALL USING (auth.uid() = id);

-- RLS：订阅仅本人可读
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY subscriptions_owner ON subscriptions FOR SELECT USING (auth.uid() = user_id);
