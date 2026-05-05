/**
 * scanner.js — 文件扫描器
 * 扫描 Obsidian Vault 目录，递归读取所有 .md 文件，构建内存缓存
 */

const fs = require('fs');
const path = require('path');
const parser = require('./parser');

// ============ 配置 ============

const VAULT_ROOT = 'C:/Users/jiehuiyang/Documents/Obsidian Vault/游戏设计';

const PIPELINES = [
  { pipeline: '微信资讯', stage: '资讯', dir: '游戏资讯/资讯' },
  { pipeline: '游戏跟踪', stage: '分析', dir: '游戏跟踪/已分析' },
];

// ============ 缓存 ============

/** @type {Map<string, object>} articleMap - 按 ID 索引的文章缓存 */
let articleMap = new Map();

/** @type {object[]} articleList - 文章数组（有序） */
let articleList = [];

// ============ 文件操作 ============

/**
 * 递归扫描目录，获取所有 .md 文件的绝对路径
 */
function findAllMdFiles(dirPath) {
  const files = [];
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        files.push(...findAllMdFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  } catch (e) {
    // 目录不存在或无权限，跳过
  }
  return files;
}

/**
 * 读取文件内容（UTF-8）
 */
function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    return null;
  }
}

// ============ 扫描逻辑 ============

/**
 * 扫描单个流水线目录
 */
function scanPipeline(pipelineConfig) {
  const dirPath = path.join(VAULT_ROOT, pipelineConfig.dir);
  const mdFiles = findAllMdFiles(dirPath);
  const articles = [];

  for (const filePath of mdFiles) {
    const content = readFile(filePath);
    if (!content || content.trim().length === 0) continue;

    // 生成相对于 Vault 根路径的标识
    const relativePath = path.relative(VAULT_ROOT, filePath);

    try {
      const article = parser.parse(
        content,
        relativePath,
        pipelineConfig.pipeline,
        pipelineConfig.stage
      );
      article._filePath = filePath; // 保留绝对路径供调试
      articles.push(article);
    } catch (e) {
      console.error(`解析文件失败: ${relativePath}`, e.message);
    }
  }

  return articles;
}

/**
 * 全量扫描所有流水线
 */
function scanAll() {
  console.log('[scanner] 开始扫描 Obsidian Vault...');
  console.log(`[scanner] Vault 路径: ${VAULT_ROOT}`);

  // 检查 Vault 根路径
  if (!fs.existsSync(VAULT_ROOT)) {
    console.warn(`[scanner] 警告: Vault 路径不存在: ${VAULT_ROOT}`);
    console.warn('[scanner] 将返回空文章列表。请确认路径配置是否正确。');
    articleMap = new Map();
    articleList = [];
    return [];
  }

  const allArticles = [];

  for (const pipeline of PIPELINES) {
    const dirPath = path.join(VAULT_ROOT, pipeline.dir);
    if (!fs.existsSync(dirPath)) {
      console.log(`[scanner] 跳过不存在的目录: ${pipeline.dir}`);
      continue;
    }
    const articles = scanPipeline(pipeline);
    console.log(`[scanner] [${pipeline.pipeline}] ${pipeline.stage}: ${articles.length} 篇`);
    allArticles.push(...articles);
  }

  // 按日期倒序排列
  allArticles.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return b.date.localeCompare(a.date);
  });

  // 更新缓存
  articleMap = new Map();
  for (const article of allArticles) {
    articleMap.set(article.id, article);
  }
  articleList = allArticles;

  console.log(`[scanner] 扫描完成，共 ${allArticles.length} 篇文章`);
  return allArticles;
}

/**
 * 获取所有文章
 */
function getArticles() {
  return articleList;
}

/**
 * 根据 ID 获取单篇文章
 */
function getArticleById(id) {
  return articleMap.get(id) || null;
}

/**
 * 手动刷新缓存
 */
function refresh() {
  return scanAll();
}

module.exports = { scanAll, getArticles, getArticleById, refresh };
