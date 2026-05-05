/**
 * search.js — 全文搜索引擎
 * 基于 minisearch 实现中文全文搜索
 */

const MiniSearch = require('minisearch');

let miniSearch = null;

/**
 * 构建搜索索引
 * @param {object[]} articles - 文章列表
 */
function buildIndex(articles) {
  miniSearch = new MiniSearch({
    fields: ['title', 'summary', 'tags', 'source', 'content'],
    storeFields: ['id'],
    searchOptions: {
      boost: {
        title: 4,
        summary: 3,
        tags: 2,
        source: 1.5,
        content: 1,
      },
      prefix: true,
      fuzzy: 0.2,
    },
    // 中文分词简单处理：按字符切分
    tokenize: (string) => {
      // 先提取英文单词和中文单字
      const tokens = [];
      // 匹配中文字符、英文单词、数字
      const matches = string.match(/[\u4e00-\u9fff]|[a-zA-Z]+|\d+/g);
      if (matches) {
        for (const m of matches) {
          if (/[\u4e00-\u9fff]/.test(m)) {
            // 中文按单字切分
            tokens.push(...m.split(''));
          } else {
            tokens.push(m.toLowerCase());
          }
        }
      }
      return tokens;
    },
  });

  // 准备索引数据（清理 content 以减小索引大小）
  const docs = articles.map((article, index) => ({
    id: index,
    title: article.title || '',
    summary: (article.summary || '').substring(0, 500),
    tags: (article.tags || []).join(' '),
    source: article.source || '',
    content: (article._rawContent || article.content || '').substring(0, 2000),
  }));

  miniSearch.addAll(docs);

  // 建立 index -> article 的映射
  miniSearch._articleMap = articles;
}

/**
 * 搜索文章
 * @param {string} query - 搜索关键词
 * @param {object[]} allArticles - 文章列表（用于返回完整对象）
 * @returns {object[]} 匹配的文章列表（含 score）
 */
function search(query, allArticles) {
  if (!miniSearch || !query || query.trim().length === 0) {
    return [];
  }

  const results = miniSearch.search(query.trim(), {
    boost: {
      title: 4,
      summary: 3,
      tags: 2,
      source: 1.5,
      content: 1,
    },
    prefix: true,
    fuzzy: 0.2,
  });

  // 映射回完整的 article 对象
  const articleList = allArticles || miniSearch._articleMap || [];
  return results.map(r => ({
    ...articleList[r.id],
    _score: r.score,
    _matchTerms: r.terms || [],
  }));
}

module.exports = { buildIndex, search };
