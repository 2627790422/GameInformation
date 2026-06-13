/**
 * scripts/download-articles.js
 * 通过 GitHub REST API 下载 ObsidianNote 仓库中指定目录的 .md 文件
 * 替代 git clone，避免拉取整个大仓库（含图片附件）导致 OOM
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const API_REPO = '2627790422/ObsidianNote';
const TOKEN = process.env.GH_PAT || '';
const REF_DIR = path.join(__dirname, '..', 'reference');

// 构造 raw 下载 URL（不依赖 API 返回的临时 download_url）
function rawUrl(filePath) {
  const safePath = filePath.split('/').map(encodeURIComponent).join('/');
  return `https://raw.githubusercontent.com/${API_REPO}/main/${safePath}`;
}

// 目标目录（相对于仓库根）
const TARGET_DIRS = [
  '游戏设计/游戏资讯/资讯',
  '游戏设计/游戏跟踪/已分析',
  '游戏设计/自主采集/拆解/拆解结果',
  'AI/AI资讯',
];

function apiRequest(urlPath) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.github.com',
      path: urlPath,
      headers: {
        'User-Agent': 'GameInformation-bot',
        'Accept': 'application/vnd.github+json',
      },
    };
    if (TOKEN) {
      opts.headers['Authorization'] = `Bearer ${TOKEN}`;
    }
    https.get(opts, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        // Redirect — follow
        https.get(res.headers.location, (r2) => {
          let body = '';
          r2.on('data', (c) => (body += c));
          r2.on('end', () => {
            try { resolve(JSON.parse(body)); } catch (e) { reject(new Error(body)); }
          });
        }).on('error', reject);
        return;
      }
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
          return;
        }
        try { resolve(JSON.parse(body)); } catch (e) { resolve(body); }
      });
    }).on('error', reject);
  });
}

/** 递归获取目录下所有 .md 文件（处理分页和子目录） */
async function fetchDirectory(dirPath) {
  const results = [];
  const encoded = encodeURIComponent(dirPath);
  const data = await apiRequest(`/repos/${API_REPO}/contents/${encoded}`);
  if (!Array.isArray(data)) {
    console.error(`  [WARN] ${dirPath}: not a directory or not found`);
    return results;
  }
  for (const item of data) {
    if (item.type === 'file' && item.name.endsWith('.md')) {
      results.push(item);
    } else if (item.type === 'dir') {
      const subPath = dirPath ? `${dirPath}/${item.name}` : item.name;
      const sub = await fetchDirectory(subPath);
      results.push(...sub);
    }
  }
  return results;
}

function downloadFile(downloadUrl, localPath) {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(localPath);
    fs.mkdirSync(dir, { recursive: true });
    const file = fs.createWriteStream(localPath);
    file.on('error', (e) => {
      fs.unlink(localPath, () => {});
      reject(e);
    });
    const req = https.get(downloadUrl, {
      headers: TOKEN ? { 'Authorization': `Bearer ${TOKEN}` } : {},
    }, (res) => {
      if (res.statusCode >= 400) {
        file.close();
        fs.unlink(localPath, () => {});
        reject(new Error(`HTTP ${res.statusCode} for ${downloadUrl}`));
        return;
      }
      if (res.statusCode === 302 || res.statusCode === 301) {
        https.get(res.headers.location, (r2) => {
          if (r2.statusCode >= 400) {
            file.close();
            fs.unlink(localPath, () => {});
            reject(new Error(`HTTP ${r2.statusCode} redirect`));
            return;
          }
          r2.pipe(file);
          file.on('finish', () => { file.close(); resolve(); });
        }).on('error', reject);
        return;
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    });
    req.on('error', reject);
    req.end();
  });
}

(async function main() {
  console.log('[download] === 开始通过 API 下载文章 ===');
  console.log(`[download] TOKEN: ${TOKEN ? '已设置' : '未设置（公开仓库模式）'}`);

  // 清理旧数据
  if (fs.existsSync(REF_DIR)) {
    fs.rmSync(REF_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(REF_DIR, { recursive: true });

  let total = 0;

  for (const dir of TARGET_DIRS) {
    console.log(`[download] 获取目录: ${dir}`);
    try {
      const files = await fetchDirectory(dir);
      console.log(`[download]   找到 ${files.length} 个 .md 文件`);
      for (const f of files) {
        const relPath = f.path;
        const localPath = path.join(REF_DIR, relPath);
        try {
          await downloadFile(rawUrl(relPath), localPath);
        } catch (e) {
          console.error(`[download]     失败 ${relPath}: ${e.message}`);
        }
      }
      total += files.length;
    } catch (e) {
      console.error(`[download]   错误: ${e.message}`);
    }
  }

  console.log(`[download] === 下载完成，共 ${total} 篇 ===`);
})().catch((e) => {
  console.error('[download] 致命错误:', e.message);
  process.exit(1);
});
