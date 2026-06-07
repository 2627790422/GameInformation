/**
 * scripts/build-data.js
 * 数据构建脚本：从 GitHub 拉取 Obsidian Vault，预渲染 HTML，导出 JSON 数据文件
 * 本地：可选设置 VAULT_PATH 环境变量指向本地 vault
 * Vercel：自动 clone ObsidianNote 仓库
 */

try { (function main() {

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { marked } = require('marked');

marked.setOptions({ breaks: true, gfm: true });

const DATA_DIR = path.join(__dirname, '..', 'data');
const REF_DIR = path.join(__dirname, '..', 'reference');

// ============ 获取 Vault ============

const OBSIDIAN_REPO = process.env.GITHUB_TOKEN
  ? `https://${process.env.GITHUB_TOKEN}@github.com/2627790422/ObsidianNote.git`
  : 'https://github.com/2627790422/ObsidianNote.git';

if (process.env.VAULT_PATH) {
  // 本地开发：使用环境变量指定的路径
  console.log('[build] 使用本地 Vault:', process.env.VAULT_PATH);
} else if (fs.existsSync(path.join(REF_DIR, '.git'))) {
  // Vercel 已有缓存：更新 remote URL 然后 git pull
  console.log('[build] git pull 最新笔记...');
  execSync(`git remote set-url origin ${OBSIDIAN_REPO}`, { cwd: REF_DIR, stdio: 'pipe' });
  execSync('git pull --ff-only', { cwd: REF_DIR, stdio: 'inherit' });
} else {
  // Vercel 首次构建：clone（如果目录有残留则先清理）
  if (fs.existsSync(REF_DIR)) {
    console.log('[build] 清理残留目录...');
    fs.rmSync(REF_DIR, { recursive: true, force: true });
  }
  console.log('[build] clone Obsidian Vault...');
  try {
    execSync(`git clone --depth 1 ${OBSIDIAN_REPO} reference`, {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
    });
  } catch (gitError) {
    console.error('[build] git clone 失败:', gitError.stderr?.toString());
    throw gitError;
  }
}

// 设置 scanner 读取路径
process.env.VAULT_PATH = process.env.VAULT_PATH || path.join(REF_DIR, '游戏设计');
const scanner = require('../lib/scanner');

// ============ 扫描 ============

console.log('[build] 扫描 Vault:', process.env.VAULT_PATH);
const articles = scanner.scanAll();

// ============ 构建 filename→ID 映射 ============

const articleMap = new Map();
const filenameMap = new Map();
for (const a of articles) {
  articleMap.set(a.id, a);
  const fname = (a._filePath || '').replace(/\\/g, '/').split('/').pop().replace(/\.md$/i, '');
  if (fname) filenameMap.set(fname, a.id);
}

// ============ 转换 Mermaid 代码块 ============

function convertMermaidBlocks(html) {
  return html.replace(
    /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g,
    '<pre class="mermaid">$1</pre>'
  );
}

// ============ 预渲染所有文章 ============

console.log('[build] 渲染 HTML...');
const detailMap = {};
for (const a of articles) {
  let html = marked.parse(a.content || '');

  // 处理 [[wiki-link]]
  html = html.replace(/\[\[([^\]]+)\]\]/g, (_, filename) => {
    const targetId = filenameMap.get(filename.trim());
    if (!targetId) return filename;
    const target = articleMap.get(targetId);
    if (!target) return filename;
    const tags = (target.tags || []).slice(0, 4);
    const desc = (target.summary || '').slice(0, 120);
    const pc = target.pipeline === '微信资讯' ? 'pipe-wx' :
                target.pipeline === '自主采集' ? 'pipe-sc' :
                target.pipeline === '游戏跟踪' ? 'pipe-tr' : '';
    return `<a href="#d/${target.id}" class="wiki-card" data-pipeline="${target.pipeline}">
      <div class="card-top">
        <span class="card-badge ${pc}">${target.pipeline}</span>
        <span class="card-badge">${target.stage}</span>
        <span class="card-date">${target.date || ''}</span>
      </div>
      <div class="card-title">${target.title}</div>
      ${target.source ? `<div class="card-source">${target.source}</div>` : ''}
      ${desc ? `<div class="card-desc">${desc}</div>` : ''}
      ${tags.length ? `<div class="card-tags">${tags.map(t => `<span class="card-tag">${escHtml(t)}</span>`).join('')}</div>` : ''}
    </a>`;
  });

  html = convertMermaidBlocks(html);

  detailMap[a.id] = {
    id: a.id,
    title: a.title,
    pipeline: a.pipeline,
    stage: a.stage,
    date: a.date || '',
    summary: a.summary || '',
    tags: a.tags || [],
    source: a.source || '',
    url: a.url || '',
    html,
  };
}

function escHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ============ 列表数据 ============

const listItems = articles.map(a => ({
  id: a.id,
  title: a.title,
  pipeline: a.pipeline,
  stage: a.stage,
  date: a.date || '',
  summary: a.summary || '',
  tags: a.tags || [],
  source: a.source || '',
  url: a.url || '',
}));

// ============ 搜索索引 ============

console.log('[build] 构建搜索索引...');
const MiniSearch = require('minisearch');

const miniSearch = new MiniSearch({
  fields: ['title', 'summary', 'tags', 'source', 'content'],
  storeFields: ['id'],
  searchOptions: {
    boost: { title: 4, summary: 3, tags: 2, source: 1.5, content: 1 },
    prefix: true,
    fuzzy: 0.2,
  },
  tokenize: (string) => {
    const tokens = [];
    const matches = string.match(/[\u4e00-\u9fff]|[a-zA-Z]+|\d+/g);
    if (matches) {
      for (const m of matches) {
        if (/[\u4e00-\u9fff]/.test(m)) {
          tokens.push(...m.split(''));
        } else {
          tokens.push(m.toLowerCase());
        }
      }
    }
    return tokens;
  },
});

const docs = articles.map((article, index) => ({
  id: index,
  title: article.title || '',
  summary: (article.summary || '').substring(0, 500),
  tags: (article.tags || []).join(' '),
  source: article.source || '',
  content: (article._rawContent || article.content || '').substring(0, 2000),
}));
miniSearch.addAll(docs);

// ============ 统计 ============

console.log('[build] 计算统计...');
const pipelineCounts = {};
const stageCounts = {};
const allTags = new Map();
let withDate = 0;
let withoutDate = 0;
const monthCounts = {};

for (const a of articles) {
  pipelineCounts[a.pipeline] = (pipelineCounts[a.pipeline] || 0) + 1;
  const key = `${a.pipeline} - ${a.stage}`;
  stageCounts[key] = (stageCounts[key] || 0) + 1;

  if (a.date) {
    withDate++;
    const month = a.date.substring(0, 7);
    monthCounts[month] = (monthCounts[month] || 0) + 1;
  } else {
    withoutDate++;
  }

  if (a.tags) {
    for (const tag of a.tags) {
      allTags.set(tag, (allTags.get(tag) || 0) + 1);
    }
  }
}

const dates = articles.filter(a => a.date).map(a => a.date).sort().reverse();
const topTags = [...allTags.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 30)
  .map(([name, count]) => ({ name, count }));
const monthDistribution = Object.entries(monthCounts)
  .sort((a, b) => b[0].localeCompare(a[0]))
  .map(([month, count]) => ({ month, count }));

const stats = {
  total: articles.length,
  pipelineCounts,
  stageCounts,
  topTags,
  withDate,
  withoutDate,
  latestDate: dates[0] || null,
  earliestDate: dates[dates.length - 1] || null,
  monthDistribution,
};

// ============ 写入文件 ============

fs.mkdirSync(DATA_DIR, { recursive: true });

fs.writeFileSync(path.join(DATA_DIR, 'articles-list.json'), JSON.stringify(listItems));
fs.writeFileSync(path.join(DATA_DIR, 'articles-detail.json'), JSON.stringify(detailMap));
fs.writeFileSync(path.join(DATA_DIR, 'search-index.json'), JSON.stringify(miniSearch));
fs.writeFileSync(path.join(DATA_DIR, 'stats.json'), JSON.stringify(stats));

console.log(`[build] 完成: ${articles.length} 篇文章`);
console.log(`[build] 数据文件已写入: ${DATA_DIR}`);

})();  // 关闭 IIFE
} catch (e) {
  console.error('[build] 构建失败:', e.message);
  console.error('[build] 堆栈:', e.stack);
  process.exit(1);
}
