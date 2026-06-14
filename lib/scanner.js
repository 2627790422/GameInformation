/**
 * scanner.js — 文件扫描器
 * 扫描 Obsidian Vault 目录，递归读取所有 .md 文件，构建内存缓存
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const parser = require('./parser');

// ============ 配置 ============

// 兜底路径：优先使用环境变量，其次使用项目内的 reference/ 目录（跨平台）
const REFERENCE_DIR = process.env.VAULT_PATH
  ? path.dirname(process.env.VAULT_PATH)
  : path.join(__dirname, '..', 'reference');
const VAULT_ROOT = process.env.VAULT_PATH || REFERENCE_DIR;

if (!process.env.VAULT_PATH) {
  console.warn('[scanner] 提示: 未设置 VAULT_PATH 环境变量，使用兜底路径:', REFERENCE_DIR);
  console.warn('[scanner] 如需扫描 Obsidian Vault，请设置 VAULT_PATH 环境变量指向 vault 根目录');
}

const PIPELINES = [
  { pipeline: '微信资讯', stage: '资讯', dir: '游戏设计/游戏资讯/资讯' },
  { pipeline: '游戏跟踪', stage: '分析', dir: '游戏设计/游戏跟踪/已分析' },
  { pipeline: '自主采集', stage: '拆解', dir: '游戏设计/自主采集/拆解/拆解结果' },
  { pipeline: 'AI资讯', stage: '资讯', dir: 'AI/AI资讯' },
  { pipeline: '访谈跟踪', stage: '分析', dir: '外接大脑/访谈跟踪/已分析' },
];

// ============ 缓存 ============

/** @type {Map<string, object>} articleMap - 按 ID 索引的文章缓存 */
let articleMap = new Map();

/** @type {object[]} articleList - 文章数组（有序） */
let articleList = [];

/** @type {Map<string, string>} filename → article ID 映射（用于 wiki-link 解析） */
let filenameMap = new Map();

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
 * 同步 reference 仓库（git pull 最新数据）
 */
function syncReference() {
  try {
    console.log('[scanner] 同步 reference 仓库...');
    const result = execSync('git pull', { cwd: REFERENCE_DIR, encoding: 'utf-8', timeout: 30000 });
    console.log('[scanner] git pull:', result.trim());
  } catch (e) {
    console.warn('[scanner] git pull 失败:', e.message);
    // 不阻塞扫描，使用现有文件
  }
}

/**
 * 全量扫描所有流水线
 */
function scanAll() {
  // 直接读取本地 Obsidian Vault，无需 git 同步
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
  filenameMap = new Map();
  for (const article of allArticles) {
    articleMap.set(article.id, article);
    // 从文件路径提取文件名（不含 .md），建立 → ID 映射
    const filename = article._filePath.replace(/\\/g, '/').split('/').pop().replace(/\.md$/i, '');
    filenameMap.set(filename, article.id);
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

/**
 * 根据文件名查找文章 ID（用于 wiki-link 解析）
 */
function getIdByFilename(filename) {
  return filenameMap.get(filename) || null;
}

module.exports = { scanAll, getArticles, getArticleById, getIdByFilename, refresh };
