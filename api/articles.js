/**
 * api/articles.js — Vercel Serverless Function
 * 优先从预构建的 data/*.json 读取数据，JSON 不存在时回退到 scanner
 */

const scanner = require('../lib/scanner');

// 预构建数据（Vercel 冷启动时加载一次，require 会缓存）
let articleList = null;
let detailMap = null;
let prebuiltLoaded = false;

try {
  articleList = require('../data/articles-list.json');
  detailMap = require('../data/articles-detail.json');
  prebuiltLoaded = true;
  console.log('[api/articles] 已加载预构建数据:', articleList.length, '篇文章');
} catch (e) {
  console.warn('[api/articles] 预构建数据不可用，回退到 scanner:', e.message);
  scanner.scanAll();
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id, pipeline, stage, sort, order, limit, offset, exclude } = req.query;

  if (id) {
    // 单篇文章详情
    if (prebuiltLoaded && detailMap && detailMap[id]) {
      return res.json(detailMap[id]);
    }

    // 回退：从 scanner 获取并实时渲染
    const article = scanner.getArticleById(id);
    if (!article) return res.status(404).json({ error: '文章未找到' });

    const { marked } = require('marked');
    const parser = require('../lib/parser');
    marked.setOptions({ breaks: true, gfm: true });

    let html = marked.parse(article._rawContent || article.content || '');
    html = parser.convertMermaidBlocks(html);

    // wiki-link 解析
    html = html.replace(/\[\[([^\]]+)\]\]/g, (_, filename) => {
      const targetId = scanner.getIdByFilename(filename.trim());
      return targetId ? `<a href="#d/${targetId}" class="wiki-card">${filename}</a>` : filename;
    });

    return res.json({ ...article, html, _rawContent: undefined, _filePath: undefined });
  }

  // 列表
  let articles;
  if (prebuiltLoaded && articleList) {
    articles = articleList;
  } else {
    articles = scanner.getArticles();
  }

  if (pipeline) {
    const pipes = pipeline.split(',');
    articles = articles.filter(a => pipes.includes(a.pipeline));
  }
  if (stage) {
    const stages = stage.split(',');
    articles = articles.filter(a => stages.includes(a.stage));
  }
  if (exclude) {
    const excludes = exclude.split(',');
    articles = articles.filter(a => !excludes.includes(a.pipeline));
  }

  const total = articles.length;

  const lim = parseInt(limit) || 100;
  const off = parseInt(offset) || 0;
  articles = articles.slice(off, off + lim);

  const list = articles.map(a => ({
    id: a.id, title: a.title, pipeline: a.pipeline, stage: a.stage,
    date: a.date, summary: (a.summary || '').replace(/<!--[\s\S]*?-->/g, '').trim(), tags: a.tags, source: a.source, url: a.url,
  }));

  res.json({ total, articles: list });
};
