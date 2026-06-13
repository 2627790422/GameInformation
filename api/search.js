/**
 * api/search.js — Vercel Serverless Function
 * 优先从预构建的 data/search-index.json 加载 MiniSearch 索引
 * JSON 不存在时回退到 scanner + lib/search
 */

const fs = require('fs');
const path = require('path');
const scanner = require('../lib/scanner');
const MiniSearch = require('minisearch');

// MiniSearch 配置（必须与构建时完全一致）
const MINISEARCH_OPTIONS = {
  fields: ['title', 'summary', 'tags', 'source', 'content'],
  storeFields: ['id'],
  searchOptions: {
    boost: { title: 4, summary: 3, tags: 2, source: 1.5, content: 1 },
    prefix: true,
    fuzzy: 0.2,
  },
  tokenize: (string) => {
    const tokens = [];
    const matches = string.match(/[一-鿿]|[a-zA-Z]+|\d+/g);
    if (matches) {
      for (const m of matches) {
        if (/[一-鿿]/.test(m)) {
          // 中文按单字切分
          tokens.push(...m.split(''));
        } else {
          tokens.push(m.toLowerCase());
        }
      }
    }
    return tokens;
  },
};

// 预构建数据
let miniSearch = null;
let articleList = null;
let prebuiltLoaded = false;

try {
  // MiniSearch.loadJSON 需要 JSON 字符串，不能用 require（require 会解析为对象）
  const indexPath = path.join(__dirname, '..', 'data', 'search-index.json');
  const indexJSON = fs.readFileSync(indexPath, 'utf-8');
  articleList = require('../data/articles-list.json');
  miniSearch = MiniSearch.loadJSON(indexJSON, MINISEARCH_OPTIONS);
  prebuiltLoaded = true;
  console.log('[api/search] 已加载预构建搜索索引:', articleList.length, '篇文章');
} catch (e) {
  console.warn('[api/search] 预构建索引不可用，回退到 scanner:', e.message);
  const search = require('../lib/search');
  const articles = scanner.scanAll();
  search.buildIndex(articles);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const q = req.query.q || '';
  const limit = parseInt(req.query.limit) || 20;
  const offset = parseInt(req.query.offset) || 0;
  const exclude = req.query.exclude || '';

  if (!q.trim()) return res.json({ total: 0, articles: [] });

  let results;

  if (prebuiltLoaded && miniSearch && articleList) {
    // 使用预构建的 MiniSearch 索引搜索
    const searchResults = miniSearch.search(q.trim(), {
      boost: { title: 4, summary: 3, tags: 2, source: 1.5, content: 1 },
      prefix: true,
      fuzzy: 0.2,
    });

    results = searchResults.map(r => ({
      ...articleList[r.id],
      _score: r.score,
    }));

    // 排除筛选
    if (exclude) {
      const excludes = exclude.split(',');
      results = results.filter(a => !excludes.includes(a.pipeline));
    }
  } else {
    // 回退：使用 scanner + lib/search
    const search = require('../lib/search');
    let articles = scanner.getArticles();

    if (exclude) {
      const excludes = exclude.split(',');
      articles = articles.filter(a => !excludes.includes(a.pipeline));
    }

    results = search.search(q, articles);
  }

  const total = results.length;
  const sliced = results.slice(offset, offset + limit);

  res.json({
    total,
    articles: sliced.map(a => ({
      id: a.id, title: a.title, pipeline: a.pipeline, stage: a.stage,
      date: a.date, summary: a.summary, tags: a.tags, source: a.source, url: a.url,
      _score: a._score,
    })),
  });
};
