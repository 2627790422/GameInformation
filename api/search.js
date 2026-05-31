/**
 * api/search.js — Vercel Serverless Function
 */

const scanner = require('../lib/scanner');
const search = require('../lib/search');

scanner.scanAll();

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const q = req.query.q || '';
  const limit = parseInt(req.query.limit) || 20;
  const offset = parseInt(req.query.offset) || 0;
  const exclude = req.query.exclude || '';

  if (!q.trim()) return res.json({ total: 0, articles: [] });

  let articles = scanner.getArticles();

  if (exclude) {
    const excludes = exclude.split(',');
    articles = articles.filter(a => !excludes.includes(a.pipeline));
  }

  const results = search.search(q, articles);
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
