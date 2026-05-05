/**
 * parser.js — Markdown 解析器
 * 统一解析三种格式的 Markdown 文件：
 * 1. YAML frontmatter（自主采集-拆解）
 * 2. Format B blockquote 元数据（微信资讯、游戏跟踪分析）
 * 3. 纯正文文件（探索结果、研究结果、字幕、思想提取）
 */

const matter = require('gray-matter');

// ============ 工具函数 ============

/**
 * 从文件名提取日期
 * 支持格式：YYYY-MM-DD_xxx, xxx_YYYY-MM-DD, xxx_YYYYMMDD, YYYYMMDD, YY-MM-DD
 */
function extractDateFromFilename(filePath) {
  const parts = filePath.replace(/\\/g, '/').split('/');
  const filename = parts[parts.length - 1];

  // YYYY-MM-DD
  let match = filename.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;

  // YY-MM-DD (short year, 2-digit at start of filename)
  match = filename.match(/^(\d{2})-(\d{2})-(\d{2})/);
  if (match) {
    const fullYear = '20' + match[1];
    return `${fullYear}-${match[2]}-${match[3]}`;
  }

  // YYYYMMDD (8位数字)
  match = filename.match(/(\d{4})(\d{2})(\d{2})/);
  if (match) {
    const y = match[1], m = match[2], d = match[3];
    if (parseInt(m) >= 1 && parseInt(m) <= 12 && parseInt(d) >= 1 && parseInt(d) <= 31) {
      return `${y}-${m}-${d}`;
    }
  }

  return null;
}

/**
 * 从正文提取日期（研究时间、拆解时间、发布时间等）
 */
function extractDateFromBody(body) {
  const patterns = [
    /\*{0,2}(?:研究时间|拆解时间|发布时间|搜索日期)\*{0,2}[：:]\s*(.+)/,
    /\*{0,2}(?:时间|日期)\*{0,2}[：:]\s*(.+)/,
  ];

  for (const pattern of patterns) {
    const match = body.match(pattern);
    if (match) {
      const raw = match[1].trim();
      // 尝试从较长字符串中提取日期
      const dateMatch = raw.match(/(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/);
      if (dateMatch) return dateMatch[1].replace(/[./]/g, '-');
      const dateMatch2 = raw.match(/(\d{4})(\d{2})(\d{2})/);
      if (dateMatch2) return `${dateMatch2[1]}-${dateMatch2[2]}-${dateMatch2[3]}`;
    }
  }

  return null;
}

/**
 * 从标题中提取日期（如 "探索结果 2026-05-01" 或 "26-04-25 标题"）
 */
function extractDateFromTitle(title) {
  // YYYY-MM-DD
  let match = title.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  // YY-MM-DD at start
  match = title.match(/^(\d{2})-(\d{2})-(\d{2})/);
  if (match) return `20${match[1]}-${match[2]}-${match[3]}`;
  return null;
}

/**
 * 清理标题中的日期前后缀
 */
function cleanTitle(title) {
  // 去除后缀：YYYY-MM-DD 或 YY-MM-DD
  title = title.replace(/\s*\d{2,4}[-/.]\d{1,2}[-/.]\d{1,2}\s*$/, '').trim();
  // 去除前缀：YYYY-MM-DD 或 YY-MM-DD + 可选空格/下划线
  title = title.replace(/^\d{2,4}[-/.]\d{1,2}[-/.]\d{1,2}[_\s]*/, '').trim();
  return title;
}

/**
 * 尝试多种格式解析日期字符串
 */
function normalizeDate(dateStr) {
  if (!dateStr) return null;
  const str = dateStr.trim();

  // YYYY-MM-DD / YYYY.MM.DD / YYYY/MM/DD
  let match = str.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (match) {
    const mm = match[2].padStart(2, '0');
    const dd = match[3].padStart(2, '0');
    return `${match[1]}-${mm}-${dd}`;
  }

  // YYYYMMDD
  match = str.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;

  // YYYY年MM月DD日
  match = str.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (match) {
    const mm = match[2].padStart(2, '0');
    const dd = match[3].padStart(2, '0');
    return `${match[1]}-${mm}-${dd}`;
  }

  // 尝试直接解析
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return null;
}

// ============ 元数据提取 ============

/**
 * 从 blockquote 行提取元数据（Format B）
 */
function extractFromBlockquote(content) {
  const meta = {};
  const lines = content.split('\n');

  const patterns = {
    source: /^>\s*\*{0,2}来源\*{0,2}[：:]\s*(.+)/,
    date: /^>\s*\*{0,2}发布时间\*{0,2}[：:]\s*(.+)/,
    url: /^>\s*\*{0,2}(?:原始链接|链接)\*{0,2}[：:]\s*(.+)/,
    author: /^>\s*\*{0,2}(?:作者|UP主|频道)\*{0,2}[：:]\s*(.+)/,
  };

  for (const line of lines) {
    if (line.startsWith('>')) {
      for (const [key, pattern] of Object.entries(patterns)) {
        const match = line.match(pattern);
        if (match) {
          meta[key] = match[2].trim();
        }
      }
    } else if (line.trim() !== '') {
      break;  // blockquote 区域结束
    }
  }

  return meta;
}

/**
 * 从正文提取来源信息
 */
function extractSourceFromBody(body) {
  const patterns = [
    /\*{0,2}(?:来源游戏|来源)\*{0,2}[：:]\s*(.+)/,
    /\*{0,2}游戏\*{0,2}[：:]\s*(.+)/,
  ];

  for (const pattern of patterns) {
    const match = body.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}

/**
 * 从内容中提取第一个 # 标题
 */
function extractHeading(content) {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

// ============ 摘要提取 ============

/**
 * 提取结构化摘要（Phase 3 / 核心内容 / 核心观点 等）
 */
function extractStructuredSummary(body) {
  // 按优先级匹配摘要段落
  const sectionPatterns = [
    /#{2,3}\s*(?:Phase\s*[3-6]|概要总览)[\s\S]*?(?=#{2,3}\s|\n\n---\n|$)/i,
    /#{2,3}\s*(?:核心内容|核心机制)[\s\S]*?(?=#{2,3}\s|\n\n---\n|$)/i,
    /#{2,3}\s*(?:摘要|概述|总览)[\s\S]*?(?=#{2,3}\s|\n\n---\n|$)/i,
  ];

  for (const pattern of sectionPatterns) {
    const match = body.match(pattern);
    if (match) {
      const text = match[0]
        .replace(/^#{2,3}\s*.+$/m, '')    // 去标题行
        .replace(/^[>\s*-]+/gm, '')        // 去 blockquote 和列表标记
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // 链接只保留文字
        .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')  // 去加粗/斜体标记
        .replace(/\n{2,}/g, '\n')
        .trim();
      if (text.length > 20) {
        return text.substring(0, 200);
      }
    }
  }

  // 对于"思想"格式：提取"核心观点"行
  const coreViews = [];
  const coreViewRe = /\*\*核心观点\*\*[：:]\s*(.+)/g;
  let cv;
  while ((cv = coreViewRe.exec(body)) !== null) {
    coreViews.push(cv[1].trim());
  }
  if (coreViews.length > 0) {
    return coreViews.join('；').substring(0, 200);
  }

  return null;
}

/**
 * 从正文提取纯文本摘要（前200字）
 */
function extractPlainSummary(body) {
  const plainText = body
    .replace(/^---[\s\S]*?---/gm, '')      // 去 YAML frontmatter
    .replace(/^#.*$/gm, '')                 // 去标题
    .replace(/^>.*$/gm, '')                 // 去 blockquote
    .replace(/```[\s\S]*?```/g, '')         // 去代码块
    .replace(/^\|.*\|$/gm, '')              // 去表格行
    .replace(/^[-*]\s/gm, '')               // 去列表标记
    .replace(/^\s*[\w_-]+\s*:\s*.+$/gm, '') // 去 YAML-like 键值行（含缩进）
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_~`]/g, '')
    .replace(/\n{2,}/g, '\n')
    .trim();

  return plainText.substring(0, 200);
}

// ============ 标签提取 ============

function extractTags(body, frontmatter) {
  // 1. YAML frontmatter 中的 tags
  if (frontmatter && frontmatter.tags) {
    if (Array.isArray(frontmatter.tags)) return frontmatter.tags;
    if (typeof frontmatter.tags === 'string') {
      return frontmatter.tags.split(/[,，\s]+/).filter(Boolean);
    }
  }

  // 2. 正文中以 # 或 `#` 开头的标签
  const tags = [];
  const tagRegex = /(?:^|\s)#([\u4e00-\u9fff\w/]+)/g;
  let match;
  while ((match = tagRegex.exec(body)) !== null) {
    const tag = match[1].trim();
    if (tag.length > 1 && tag.length < 40) {
      tags.push(tag);
    }
  }

  if (tags.length > 0) {
    return [...new Set(tags)].slice(0, 10);
  }

  return [];
}

// ============ Mermaid 处理 ============

/**
 * 将 marked 渲染后的 ```mermaid 代码块转为 <pre class="mermaid"> 标签
 */
function convertMermaidBlocks(html) {
  return html.replace(
    /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g,
    '<pre class="mermaid">$1</pre>'
  );
}

// ============ 主解析函数 ============

/**
 * @param {string} content - Markdown 原始内容
 * @param {string} filePath - 文件相对路径（用于生成 ID）
 * @param {string} pipeline - 流水线名称
 * @param {string} stage - 阶段名称
 * @returns {object} Article 对象
 */
function parse(content, filePath, pipeline, stage) {
  // 1. YAML frontmatter 解析
  let fm = {};
  let body = content;
  try {
    const parsed = matter(content);
    fm = parsed.data;
    // 只有在 data 有实质内容时才认为解析成功
    if (Object.keys(fm).length > 0) {
      body = parsed.content;
    }
  } catch (e) {
    // 解析失败，使用原始内容
  }

  // 2. blockquote 元数据解析（Format B）
  const blockquoteMeta = extractFromBlockquote(content);

  // 3. 确定标题
  let title = fm.title || extractHeading(content) || null;
  if (!title) {
    const parts = filePath.replace(/\\/g, '/').split('/');
    const filename = parts[parts.length - 1].replace(/\.md$/i, '');
    // 去掉文件名中的日期前缀
    title = filename.replace(/^\d{4}-\d{2}-\d{2}[_\s]*/, '').trim();
  }
  // 清理标题中的日期后缀
  title = cleanTitle(title);

  // 4. 确定日期（多来源优先级）
  let date = null;

  // 4a. YAML frontmatter
  if (fm.date) date = normalizeDate(String(fm.date));

  // 4b. blockquote 中的发布时间
  if (!date && blockquoteMeta.date) date = normalizeDate(blockquoteMeta.date);

  // 4c. 正文中的时间字段
  if (!date) date = extractDateFromBody(body);
  if (!date) date = extractDateFromBody(content);  // 也从原始内容找

  // 4d. 标题中的日期
  const heading = extractHeading(content);
  if (!date && heading) date = extractDateFromTitle(heading);

  // 4e. 文件名中的日期
  if (!date) date = extractDateFromFilename(filePath);

  // 5. 确定来源
  let source = fm.source || blockquoteMeta.source || fm.game || '';
  if (!source) source = extractSourceFromBody(body) || '';
  if (!source) source = extractSourceFromBody(content) || '';
  if (!source && blockquoteMeta.author) source = blockquoteMeta.author;

  // 6. URL
  const url = fm.url || blockquoteMeta.url || fm.link || '';

  // 7. 摘要（使用 body 而非原始 content，避免 frontmatter 残留）
  let summary = extractStructuredSummary(body) || extractPlainSummary(body);
  if (!summary || summary.length < 10) {
    summary = extractStructuredSummary(content) || extractPlainSummary(content);
  }

  // 8. 标签
  const tags = extractTags(body, fm);

  // 9. 生成唯一 ID
  const id = Buffer.from(filePath.replace(/\\/g, '/')).toString('base64url');

  return {
    id,
    title,
    pipeline,
    stage,
    date: date || '',
    summary: summary || '',
    tags,
    source: source || '',
    url: url || '',
    content: body,
    _rawContent: content,
  };
}

module.exports = { parse, convertMermaidBlocks, normalizeDate };
