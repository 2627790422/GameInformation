/**
 * scripts/import.js — 将 reference/ 目录的 .md 文件导入 Supabase
 * 用法: node scripts/import.js
 * 环境变量: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

const https = require('https');
const scanner = require('../lib/scanner');
const { marked } = require('marked');
const { convertMermaidBlocks } = require('../lib/parser');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

marked.setOptions({ breaks: true, gfm: true });

function supabaseRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, SUPABASE_URL);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=minimal',
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data ? JSON.parse(data) : null);
        } else {
          reject(new Error(`${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  console.log('开始导入文章...');

  const articles = scanner.scanAll();
  console.log(`扫描到 ${articles.length} 篇文章`);

  // 分批导入，每批 20 条
  const BATCH = 20;
  let imported = 0;
  let failed = 0;

  for (let i = 0; i < articles.length; i += BATCH) {
    const batch = articles.slice(i, i + BATCH);
    const rows = batch.map(article => {
      let html = marked.parse(article.content || '');
      // wiki-link: 保留原文标记，前端处理
      html = html.replace(/\[\[([^\]]+)\]\]/g, (_, filename) => {
        const targetId = scanner.getIdByFilename(filename.trim());
        if (targetId) {
          return `<a href="#d/${targetId}" class="wiki-card">${filename}</a>`;
        }
        return filename;
      });
      html = convertMermaidBlocks(html);

      return {
        id: article.id,
        title: article.title,
        pipeline: article.pipeline,
        stage: article.stage,
        date: article.date || null,
        summary: article.summary || '',
        tags: article.tags || [],
        source: article.source || '',
        url: article.url || '',
        content: article._rawContent || article.content || '',
        html: html,
      };
    });

    try {
      await supabaseRequest(
        'POST',
        `/rest/v1/articles?on_conflict=id`,
        rows
      );
      imported += batch.length;
      batch.forEach(a => console.log(`  ✓ ${a.title.slice(0, 40)}`));
    } catch (e) {
      console.error(`  ✗ 批次失败:`, e.message);
      // 逐条重试
      for (const row of rows) {
        try {
          await supabaseRequest('POST', `/rest/v1/articles?on_conflict=id`, [row]);
          console.log(`  ✓ ${row.title.slice(0, 40)}`);
          imported++;
        } catch (e2) {
          console.error(`  ✗ ${row.title.slice(0, 30)}:`, e2.message);
          failed++;
        }
      }
    }
  }

  console.log(`\n导入完成: ${imported} 篇成功, ${failed} 篇失败`);
}

main().catch(console.error);
