/**
 * server.js — Express 服务器入口
 * 游戏资讯展示网页 Web 服务
 */

const express = require('express');
const path = require('path');
const { marked } = require('marked');
const scanner = require('./lib/scanner');
const search = require('./lib/search');
const { convertMermaidBlocks } = require('./lib/parser');

const app = express();
const PORT = process.env.PORT || 3000;

// ============ Marked 配置 ============

marked.setOptions({
  breaks: true,
  gfm: true,
});

// ============ 中间件 ============

// 静态文件
app.use(express.static(path.join(__dirname, 'public')));

// JSON 解析
app.use(express.json());

// ============ 启动扫描 ============

console.log('='.repeat(50));
console.log('  游戏资讯展示网页 - Game Information Viewer');
console.log('='.repeat(50));

const articles = scanner.scanAll();
search.buildIndex(articles);

// 用 scanner.getArticles() 作为动态数据源，确保 refresh 后能获取最新数据
function getArticles() {
  return scanner.getArticles();
}

// ============ API 路由 ============

/**
 * GET /api/articles
 * 文章列表，支持筛选和排序
 * Query params: pipeline, stage, tag, sort, order, limit, offset
 */
app.get('/api/articles', (req, res) => {
  let result = getArticles();
  const { pipeline, stage, tag, month, sort = 'date', order = 'desc', limit, offset, exclude } = req.query;

  // 月份筛选
  if (month) {
    const months = month.split(',');
    result = result.filter(a => a.date && months.some(m => a.date.startsWith(m)));
  }

  // 流水线筛选
  if (pipeline) {
    const pipelines = pipeline.split(',');
    result = result.filter(a => pipelines.includes(a.pipeline));
  }

  // 阶段筛选
  if (stage) {
    const stages = stage.split(',');
    result = result.filter(a => stages.includes(a.stage));
  }

  // 排除筛选（当用户点击了设计管线 chip 时不排除）
  if (exclude) {
    const excludes = exclude.split(',');
    result = result.filter(a => !excludes.includes(a.pipeline));
  }

  // 标签筛选
  if (tag) {
    const tags = tag.split(',');
    result = result.filter(a => a.tags && a.tags.some(t => tags.includes(t)));
  }

  // 排序
  if (sort === 'date') {
    result = [...result].sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return order === 'asc'
        ? a.date.localeCompare(b.date)
        : b.date.localeCompare(a.date);
    });
  } else if (sort === 'title') {
    result = [...result].sort((a, b) => {
      const cmp = a.title.localeCompare(b.title, 'zh-CN');
      return order === 'asc' ? cmp : -cmp;
    });
  }

  const total = result.length;

  // 分页
  if (offset) {
    const start = parseInt(offset) || 0;
    const end = limit ? start + parseInt(limit) : undefined;
    result = result.slice(start, end);
  } else if (limit) {
    result = result.slice(0, parseInt(limit));
  }

  // 返回列表时不包含完整 content，节省带宽
  const listItems = result.map(a => ({
    id: a.id,
    title: a.title,
    pipeline: a.pipeline,
    stage: a.stage,
    date: a.date,
    summary: a.summary,
    tags: a.tags,
    source: a.source,
    url: a.url,
  }));

  res.json({ total, articles: listItems });
});

/**
 * GET /api/articles/:id
 * 单篇文章详情，含渲染后的 HTML
 */
app.get('/api/articles/:id', (req, res) => {
  const article = scanner.getArticleById(req.params.id);
  if (!article) {
    return res.status(404).json({ error: '文章未找到' });
  }

  // 用 marked 渲染 Markdown 为 HTML
  let html = marked.parse(article.content || '');

  // 将 [[wiki-link]] 转换为文章卡片（复用时间线卡片样式）
  html = html.replace(/\[\[([^\]]+)\]\]/g, (_, filename) => {
    const targetId = scanner.getIdByFilename(filename.trim());
    if (!targetId) return filename;
    const target = scanner.getArticleById(targetId);
    if (!target) return filename;
    const tags = (target.tags || []).slice(0, 4);
    const desc = (target.summary || '').slice(0, 120);
    const pc = target.pipeline === '微信资讯' ? 'pipe-wx' :
                target.pipeline === '设计管线' ? 'pipe-pl' :
                target.pipeline === '游戏跟踪' ? 'pipe-tr' :
                target.pipeline === 'AI资讯' ? 'pipe-ai' :
                target.pipeline === '访谈跟踪' ? 'pipe-iv' : '';
    return `<a href="#d/${target.id}" class="wiki-card" data-pipeline="${target.pipeline}">
      <div class="card-top">
        <span class="card-badge ${pc}">${target.pipeline}</span>
        <span class="card-badge">${target.stage}</span>
        <span class="card-date">${target.date || ''}</span>
      </div>
      <div class="card-title">${target.title}</div>
      ${target.source ? `<div class="card-source">${target.source}</div>` : ''}
      ${desc ? `<div class="card-desc">${desc}</div>` : ''}
      ${tags.length ? `<div class="card-tags">${tags.map(t => `<span class="card-tag">${t}</span>`).join('')}</div>` : ''}
    </a>`;
  });

  // 将 Mermaid 代码块转为客户端渲染标签
  html = convertMermaidBlocks(html);

  res.json({
    ...article,
    html,
    // 列表返回时不包含原始 content
    content: undefined,
  });
});

/**
 * GET /api/search
 * 全文搜索
 * Query params: q (搜索关键词)
 */
app.get('/api/search', (req, res) => {
  const { q, exclude } = req.query;
  if (!q || q.trim().length === 0) {
    return res.json({ total: 0, articles: [] });
  }

  let articles = getArticles();

  if (exclude) {
    const excludes = exclude.split(',');
    articles = articles.filter(a => !excludes.includes(a.pipeline));
  }

  const results = search.search(q, articles);
  const listItems = results.map(a => ({
    id: a.id,
    title: a.title,
    pipeline: a.pipeline,
    stage: a.stage,
    date: a.date,
    summary: a.summary,
    tags: a.tags,
    source: a.source,
    url: a.url,
    _score: a._score,
  }));

  res.json({ total: listItems.length, articles: listItems });
});

/**
 * GET /api/stats
 * 统计面板数据
 */
app.get('/api/stats', (req, res) => {
  const allArts = getArticles();
  const pipelineCounts = {};
  const stageCounts = {};
  const allTags = new Map();
  let withDate = 0;
  let withoutDate = 0;

  for (const a of allArts) {
    // 流水线统计
    pipelineCounts[a.pipeline] = (pipelineCounts[a.pipeline] || 0) + 1;

    // 阶段统计
    const key = `${a.pipeline} - ${a.stage}`;
    stageCounts[key] = (stageCounts[key] || 0) + 1;

    // 日期统计
    if (a.date) {
      withDate++;
    } else {
      withoutDate++;
    }

    // 标签统计
    if (a.tags) {
      for (const tag of a.tags) {
        allTags.set(tag, (allTags.get(tag) || 0) + 1);
      }
    }
  }

  // 最近更新
  const dates = allArts
    .filter(a => a.date)
    .map(a => a.date)
    .sort()
    .reverse();

  // 热门标签
  const topTags = [...allTags.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([name, count]) => ({ name, count }));

  // 按月份统计
  const monthCounts = {};
  for (const a of allArts) {
    if (a.date) {
      const month = a.date.substring(0, 7); // YYYY-MM
      monthCounts[month] = (monthCounts[month] || 0) + 1;
    }
  }
  const monthEntries = Object.entries(monthCounts)
    .sort((a, b) => b[0].localeCompare(a[0]));

  res.json({
    total: articles.length,
    pipelineCounts,
    stageCounts,
    topTags,
    withDate,
    withoutDate,
    latestDate: dates[0] || null,
    earliestDate: dates[dates.length - 1] || null,
    monthDistribution: monthEntries.map(([month, count]) => ({ month, count })),
  });
});

/**
 * POST /api/refresh
 * 手动刷新缓存（重新扫描 Vault）
 */
app.post('/api/refresh', (req, res) => {
  try {
    const newArticles = scanner.refresh();
    search.buildIndex(newArticles);
    res.json({ success: true, total: newArticles.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ SPA 回退 ============

// 所有非 API / 非静态文件请求返回 index.html
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============ 启动服务器 ============

app.listen(PORT, () => {
  console.log(`[server] 服务已启动: http://localhost:${PORT}`);
  console.log(`[server] 文章总数: ${getArticles().length}`);
  console.log(`[server] 按 Ctrl+C 停止服务`);
});
