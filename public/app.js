/**
 * Game Research Archive — Frontend Logic
 * Hash-based SPA with timeline, detail, stats views
 */
(function () {
  'use strict';

  /* ---- State ---- */
  const S = {
    arts: [],
    view: 'timeline',
    id: null,
    flt: { pipeline: '', stage: '' },
    q: '',
    tm: null
  };

  /* ---- DOM helpers ---- */
  const $ = s => document.querySelector(s);
  const E = {
    tl: $('#timeline'), tlV: $('#timelineView'), dtV: $('#detailView'),
    stV: $('#statsView'), art: $('#articleDetail'), cnt: $('#articleCount'),
    emp: $('#emptyState'), si: $('#searchInput'), sd: $('#searchDropdown'),
    sp: $('#statsPanel'), tk: $('#toast'), tt: $('#themeToggle'),
  };

  /* ---- Mermaid init ---- */
  mermaid.initialize({ startOnLoad: false, theme: 'default' });

  /* ---- Theme ---- */
  const html = document.documentElement;
  const saved = localStorage.getItem('theme') || 'light';
  html.setAttribute('data-theme', saved);
  // Also update mermaid theme
  mermaid.initialize({ theme: saved === 'dark' ? 'dark' : 'default' });

  E.tt.addEventListener('click', () => {
    const next = html.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    mermaid.initialize({ theme: next === 'dark' ? 'dark' : 'default' });
  });

  /* ---- Router ---- */
  function route() {
    const h = location.hash;
    if (h.startsWith('#d/')) return showDetail(h.slice(3));
    if (h === '#s') return showStats();
    showTimeline();
  }
  window.addEventListener('hashchange', route);

  /* ---- Toast ---- */
  function toast(m) {
    E.tk.textContent = m;
    E.tk.classList.add('show');
    clearTimeout(E.tk._t);
    E.tk._t = setTimeout(() => E.tk.classList.remove('show'), 1800);
  }

  /* ---- Pipeline color helpers ---- */
  function pipeClass(pipeline) {
    if (pipeline === '微信资讯') return 'pipe-wx';
    if (pipeline === '自主采集') return 'pipe-sc';
    if (pipeline === '游戏跟踪') return 'pipe-tr';
    return '';
  }

  /* ---- Load ---- */
  async function loadArts() {
    try {
      const q = new URLSearchParams();
      if (S.flt.pipeline) q.set('pipeline', S.flt.pipeline);
      if (S.flt.stage) q.set('stage', S.flt.stage);
      q.set('sort', 'date');
      q.set('order', 'desc');
      const url = S.q
        ? `/api/search?q=${encodeURIComponent(S.q)}`
        : `/api/articles?${q}`;
      const r = await fetch(url);
      if (!r.ok) throw r;
      const d = await r.json();
      S.arts = d.articles || [];
    } catch (e) {
      console.error(e);
      S.arts = [];
      toast('加载失败');
    }
    drawTL();
    updateCnt();
  }

  /* ---- Views ---- */
  function setView(n) {
    S.view = n;
    E.tlV.classList.toggle('active', n === 'timeline');
    E.dtV.classList.toggle('active', n === 'detail');
    E.stV.classList.toggle('active', n === 'stats');
    if (n === 'detail') scrollTo(0, 0);
  }

  function showTimeline() {
    setView('timeline');
    S.id = null;
    history.replaceState(null, '', ' ');
    if (!S.arts.length && !S.q && !S.flt.pipeline && !S.flt.stage) loadArts();
  }

  function showDetail(id) {
    setView('detail');
    S.id = id;
    loadDetail(id);
  }

  async function showStats() {
    setView('stats');
    history.replaceState(null, '', '#s');
    try {
      const r = await fetch('/api/stats');
      if (!r.ok) throw r;
      drawStats(await r.json());
    } catch (e) {
      console.error(e);
      toast('统计加载失败');
    }
  }

  /* ---- Timeline ---- */
  function drawTL() {
    E.tl.innerHTML = '';
    E.emp.style.display = S.arts.length ? 'none' : 'block';
    for (const a of S.arts) E.tl.appendChild(card(a));
  }

  function card(a) {
    const el = document.createElement('div');
    el.className = 'card';
    el.setAttribute('data-pipeline', a.pipeline);
    const tags = (a.tags || []).slice(0, 4);
    const desc = (a.summary || '').slice(0, 180);
    const pc = pipeClass(a.pipeline);

    el.innerHTML =
      `<div class="card-top">` +
        `<span class="card-badge ${pc}">${esc(a.pipeline)}</span>` +
        `<span class="card-badge">${esc(a.stage)}</span>` +
        `<span class="card-date">${esc(a.date || '')}</span>` +
      `</div>` +
      `<div class="card-title">${esc(a.title)}</div>` +
      (a.source ? `<div class="card-source">${esc(a.source)}</div>` : '') +
      (desc ? `<div class="card-desc">${esc(desc)}</div>` : '') +
      (tags.length ? `<div class="card-tags">${tags.map(t => `<span class="card-tag">${esc(t)}</span>`).join('')}</div>` : '');
    el.addEventListener('click', () => { location.hash = 'd/' + a.id; });
    return el;
  }

  function updateCnt() {
    let t = `共 ${S.arts.length} 篇`;
    if (S.flt.pipeline) t += ` · ${S.flt.pipeline}`;
    if (S.flt.stage) t += ` · ${S.flt.stage}`;
    if (S.q) t += ` · 搜索："${S.q}"`;
    E.cnt.textContent = t;
  }

  /* ---- Detail ---- */
  async function loadDetail(id) {
    E.art.innerHTML = '';
    try {
      const r = await fetch(`/api/articles/${id}`);
      if (!r.ok) throw r;
      drawDetail(await r.json());
    } catch (e) {
      console.error(e);
      E.art.innerHTML = '<div class="blank-slate" style="display:block"><p class="blank-msg">文章加载失败</p></div>';
      toast('加载失败');
    }
  }

  function drawDetail(a) {
    const tags = a.tags || [];
    const pc = pipeClass(a.pipeline);
    E.art.innerHTML =
      `<div class="detail-wrap">` +
        `<div class="detail-head">` +
          `<div class="card-top" style="margin-bottom:8px">` +
            `<span class="card-badge ${pc}">${esc(a.pipeline)}</span>` +
            `<span class="card-badge">${esc(a.stage)}</span>` +
            `<span class="card-date">${esc(a.date || '')}</span>` +
          `</div>` +
          `<h1 class="detail-title">${esc(a.title)}</h1>` +
          `<div class="detail-meta-row">` +
            (a.source ? `<span>来源：${esc(a.source)}</span>` : '') +
            (a.url ? `<a href="${esc(a.url)}" target="_blank" rel="noopener">查看原文 &rarr;</a>` : '') +
          `</div>` +
          (tags.length ? `<div class="detail-tags">${tags.map(t => `<span class="detail-tag">${esc(t)}</span>`).join('')}</div>` : '') +
        `</div>` +
        `<div class="prose">${a.html || '<p>无内容</p>'}</div>` +
      `</div>`;

    requestAnimationFrame(() => {
      const bs = E.art.querySelectorAll('pre.mermaid');
      if (bs.length) {
        try { mermaid.run({ nodes: bs }); } catch (e) { console.error('Mermaid:', e); }
      }
    });
  }

  /* ---- Stats ---- */
  function drawStats(d) {
    const maxS = Math.max(1, ...Object.values(d.stageCounts || {}));
    E.sp.innerHTML =
      `<div class="stats-wrap">` +
        `<div class="stat-hero">` +
          `<div class="stat-hero-card"><div class="stat-hero-num">${d.total}</div><div class="stat-hero-label">总计</div></div>` +
          Object.entries(d.pipelineCounts || {}).map(([k, v]) =>
            `<div class="stat-hero-card"><div class="stat-hero-num">${v}</div><div class="stat-hero-label">${esc(k)}</div></div>`
          ).join('') +
        `</div>` +
        `<div class="stats-section">` +
          `<h3>阶段分布</h3>` +
          Object.entries(d.stageCounts || {}).map(([k, v]) =>
            `<div class="stat-row">` +
              `<span class="stat-row-name">${esc(k)}</span>` +
              `<div class="stat-row-bar"><div class="stat-row-bar-fill" style="width:${(v / maxS * 100) | 0}%"></div></div>` +
              `<span class="stat-row-num">${v}</span>` +
            `</div>`).join('') +
        `</div>` +
        (d.monthDistribution && d.monthDistribution.length ? `<div class="stats-section"><h3>月度分布</h3>` +
          d.monthDistribution.map(({ month, count }) =>
            `<div class="stat-row"><span class="stat-row-name">${month}</span><span class="stat-row-num">${count} 篇</span></div>`
          ).join('') + `</div>` : '') +
        `<div class="stats-footnote">` +
          (d.latestDate ? `最新：${d.latestDate} &middot; 最早：${d.earliestDate}` : '') +
        `</div>` +
        (d.topTags && d.topTags.length ? `<div class="stats-section"><h3>热门标签</h3><div class="tag-cloud">` +
          d.topTags.map(t => `<span class="tag-pill" data-tag="${esc(t.name)}">${esc(t.name)} ${t.count}</span>`).join('') +
        `</div></div>` : '') +
      `</div>`;

    E.sp.querySelectorAll('.tag-pill').forEach(el => {
      el.addEventListener('click', () => {
        S.flt = { pipeline: '', stage: '' };
        S.q = el.dataset.tag;
        E.si.value = S.q;
        updChips();
        location.hash = '';
        loadArts();
        showTimeline();
      });
    });
  }

  /* ---- Search ---- */
  E.si.addEventListener('input', () => {
    const v = E.si.value.trim();
    clearTimeout(S.tm);
    S.tm = setTimeout(() => {
      S.q = v;
      if (v.length >= 1) suggest(v);
      else { E.sd.classList.remove('show'); location.hash = ''; loadArts(); }
    }, 280);
  });

  E.si.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      clearTimeout(S.tm);
      S.q = E.si.value.trim();
      E.sd.classList.remove('show');
      location.hash = '';
      loadArts();
    }
  });

  document.addEventListener('click', e => {
    if (!E.si.contains(e.target) && !E.sd.contains(e.target)) E.sd.classList.remove('show');
  });

  async function suggest(q) {
    try {
      const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (!r.ok) return;
      const d = await r.json();
      if (d.articles.length) drawSuggest(d.articles.slice(0, 6));
      else E.sd.classList.remove('show');
    } catch (_) {}
  }

  function drawSuggest(items) {
    E.sd.innerHTML = items.map(a =>
      `<div class="search-drop-item" data-id="${a.id}">` +
        `<div class="sdi-title">${esc(a.title)}</div>` +
        `<div class="sdi-meta">${esc(a.pipeline)} &middot; ${esc(a.stage)} &middot; ${esc(a.date || '')}</div>` +
      `</div>`).join('');
    E.sd.classList.add('show');
    E.sd.querySelectorAll('.search-drop-item').forEach(it => {
      it.addEventListener('click', () => {
        E.sd.classList.remove('show');
        E.si.value = '';
        S.q = '';
        location.hash = 'd/' + it.dataset.id;
      });
    });
  }

  /* ---- Filters ---- */
  document.querySelectorAll('.f-chip[data-key]').forEach(b => {
    b.addEventListener('click', () => {
      const k = b.dataset.key, v = b.dataset.value;
      S.flt[k] = v;
      S.q = '';
      E.si.value = '';
      updChips(k);
      location.hash = '';
      loadArts();
    });
  });

  function updChips(key) {
    const ks = key ? [key] : ['pipeline', 'stage'];
    for (const k of ks) {
      document.querySelectorAll(`.f-chip[data-key="${k}"]`).forEach(b => {
        b.classList.toggle('active', b.dataset.value === S.flt[k]);
      });
    }
  }

  /* ---- Buttons ---- */
  $('#homeBtn').addEventListener('click', e => {
    e.preventDefault();
    S.q = '';
    E.si.value = '';
    E.sd.classList.remove('show');
    S.flt = { pipeline: '', stage: '' };
    updChips();
    location.hash = '';
    loadArts();
    showTimeline();
  });

  $('#backBtn').addEventListener('click', showTimeline);
  $('#statsBackBtn').addEventListener('click', showTimeline);

  /* ---- Keyboard ---- */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && S.view !== 'timeline') showTimeline();
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      E.si.focus();
    }
  });

  /* ---- Utils ---- */
  function esc(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  /* ---- Init ---- */
  (async function init() {
    await loadArts();
    const h = location.hash;
    if (h.startsWith('#d/')) showDetail(h.slice(3));
    else if (h === '#s') showStats();
    else showTimeline();
  })();

})();
