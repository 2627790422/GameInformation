/**
 * api/stats.js — Vercel Serverless Function
 * 优先从预构建的 data/stats.json 读取统计
 * JSON 不存在时回退到 scanner 动态计算
 */

const scanner = require('../lib/scanner');

// 预构建数据
let prebuiltStats = null;

try {
  prebuiltStats = require('../data/stats.json');
  console.log('[api/stats] 已加载预构建统计数据: total =', prebuiltStats.total);
} catch (e) {
  console.warn('[api/stats] 预构建统计不可用，回退到 scanner:', e.message);
  scanner.scanAll();
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (prebuiltStats) {
    return res.json(prebuiltStats);
  }

  // 回退：动态计算统计
  const articles = scanner.getArticles();

  const pipelineCounts = {};
  const stageCounts = {};
  const allTags = new Map();
  const monthCounts = {};
  let withDate = 0, withoutDate = 0;

  for (const a of articles) {
    pipelineCounts[a.pipeline] = (pipelineCounts[a.pipeline] || 0) + 1;
    const key = `${a.pipeline} - ${a.stage}`;
    stageCounts[key] = (stageCounts[key] || 0) + 1;

    if (a.date) {
      withDate++;
      monthCounts[a.date.substring(0, 7)] = (monthCounts[a.date.substring(0, 7)] || 0) + 1;
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

  res.json({
    total: articles.length,
    pipelineCounts,
    stageCounts,
    topTags: [...allTags.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([name, count]) => ({ name, count })),
    withDate,
    withoutDate,
    latestDate: dates[0] || null,
    earliestDate: dates[dates.length - 1] || null,
    monthDistribution: Object.entries(monthCounts)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([month, count]) => ({ month, count })),
  });
};
