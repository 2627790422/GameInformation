/**
 * api/articles.js — Vercel Serverless Function
 * GET /api/articles?id=xxx       → 单篇详情
 * GET /api/articles?limit=&offset=... → 列表
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

async function supabaseGet(path, res) {
  const r = await fetch(`${SUPABASE_URL}${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!r.ok) {
    return res.status(r.status).json({ error: await r.text() });
  }
  return res.json(await r.json());
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id, pipeline, stage, tag, month, sort, order, limit, offset } = req.query;

  // 单篇详情
  if (id) {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/articles?id=eq.${encodeURIComponent(id)}&select=*`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    const data = await r.json();
    if (!data.length) return res.status(404).json({ error: '文章未找到' });
    const article = data[0];

    // 获取全量文章用于 wiki-link 映射
    const r2 = await fetch(
      `${SUPABASE_URL}/rest/v1/articles?select=id,title`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    const allArts = await r2.json();
    const filenameMap = new Map();
    for (const a of allArts) {
      try {
        const decoded = Buffer.from(a.id, 'base64url').toString('utf-8');
        const filename = decoded.replace(/\\/g, '/').split('/').pop().replace(/\.md$/i, '');
        filenameMap.set(filename, a.id);
      } catch (_) {}
    }

    // wiki-link → 小卡片
    let html = article.html || '';
    html = html.replace(/\[\[([^\]]+)\]\]/g, (_, fn) => {
      const tid = filenameMap.get(fn.trim());
      return tid ? `<a href="#d/${tid}" class="wiki-card">${fn}</a>` : fn;
    });

    return res.json({ ...article, html, content: undefined });
  }

  // 文章列表
  const params = ['select=*'];
  const filters = [];

  if (pipeline) {
    filters.push(`pipeline=in.(${encodeURIComponent(pipeline)})`);
  }
  if (stage) {
    filters.push(`stage=in.(${encodeURIComponent(stage)})`);
  }
  if (tag) {
    filters.push(`tags=ov.{${encodeURIComponent(tag)}}`);
  }
  if (month) {
    const months = month.split(',');
    filters.push(`or=(${months.map(m => `date.ilike.${m}*`).join(',')})`);
  }

  // 排序
  const col = sort === 'title' ? 'title' : 'date';
  const dir = order === 'asc' ? 'asc' : 'desc';
  const nulls = dir === 'desc' ? 'nullslast' : 'nullsfirst';
  params.push(`order=${col}.${dir}.${nulls}`);

  // 分页（用 Range header 或 limit/offset 参数）
  const lim = parseInt(limit) || 100;
  const off = parseInt(offset) || 0;
  params.push(`limit=${lim}`);
  params.push(`offset=${off}`);

  const queryStr = [...params, ...filters].join('&');

  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/articles?${queryStr}`,
    { headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Prefer: 'count=exact',
    }}
  );

  const total = parseInt(r.headers.get('content-range')?.split('/')[1] || '0');
  const data = await r.json();

  const list = (data || []).map(a => ({
    id: a.id, title: a.title, pipeline: a.pipeline, stage: a.stage,
    date: a.date, summary: a.summary, tags: a.tags, source: a.source, url: a.url,
  }));

  res.json({ total, articles: list });
};
