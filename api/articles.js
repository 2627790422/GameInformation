/**
 * api/articles.js — Vercel Serverless Function
 * 直接扫描本地 reference 目录，无需 Supabase
 */

const scanner = require('../lib/scanner');
const parser = require('../lib/parser');
const { marked } = require('marked');

marked.setOptions({ breaks: true, gfm: true });

// 初始化（Vercel 上每个冷启动只执行一次）
scanner.scanAll();

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id, pipeline, stage, sort, order, limit, offset, exclude } = req.query;

  if (id) {
    const article = scanner.getArticleById(id);
    if (!article) return res.status(404).json({ error: '文章未找到' });

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
  let articles = scanner.getArticles();

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
    date: a.date, summary: a.summary, tags: a.tags, source: a.source, url: a.url,
  }));

  res.json({ total, articles: list });
};
