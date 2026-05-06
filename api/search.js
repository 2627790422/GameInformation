const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { q, limit, offset } = req.query;
  if (!q || !q.trim()) return res.json({ total: 0, articles: [] });

  const keyword = q.trim();
  const encoded = encodeURIComponent(`*${keyword}*`);
  const lim = parseInt(limit) || 20;
  const off = parseInt(offset) || 0;

  // ILIKE 搜索 title, summary, content
  const filter = `or=(title.ilike.${encoded},summary.ilike.${encoded},content.ilike.${encoded})`;

  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/articles?select=id,title,pipeline,stage,date,summary,tags,source,url&${filter}&order=date.desc.nullslast&limit=${lim}&offset=${off}`,
    { headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Prefer: 'count=exact',
    }}
  );

  const total = parseInt(r.headers.get('content-range')?.split('/')[1] || '0');
  const data = await r.json();

  // 简单相关度评分
  const articles = (data || []).map(a => {
    let score = 1;
    if (a.title && a.title.includes(keyword)) score += 3;
    if (a.summary && a.summary.includes(keyword)) score += 2;
    return { ...a, _score: score };
  });
  articles.sort((a, b) => b._score - a._score);

  res.json({ total, articles });
};
