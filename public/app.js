/**
 * 顶尖资讯 — Frontend Logic
 * 顶部模块切换: 游戏 / AI，单列全宽卡片流
 * Hash routing: #d/{id} detail, #s stats
 */
(function () {
  'use strict';

  /* ---- Module Config ---- */
  const MODULES = {
    games: {
      label: '游 戏',
      pipelines: ['微信资讯', '游戏跟踪', '设计管线'],
      chips: [
        { value: '', label: '全部' },
        { value: '微信资讯', label: '游戏资讯' },
        { value: '游戏跟踪', label: '游戏跟踪' },
        { value: '设计管线', label: '设计管线' }
      ]
    },
    ai: {
      label: 'A I',
      pipelines: ['AI资讯', '访谈跟踪'],
      chips: [
        { value: '', label: '全部' },
        { value: 'AI资讯', label: 'AI资讯' },
        { value: '访谈跟踪', label: '访谈跟踪' }
      ]
    }
  };

  const PAGE_SIZE = 15;

  /* ---- State ---- */
  const S = {
    activeModule: 'games',
    arts: [],
    view: 'timeline',
    id: null,
    filter: '',
    q: '',
    tm: null,
    offset: 0,
    hasMore: false,
    total: 0,
    rendered: 0,
    statsCache: null
  };

  /* ---- DOM ---- */
  const $ = s => document.querySelector(s);
  const E = {
    tl: $('#timeline'), tlV: $('#timelineView'), dtV: $('#detailView'),
    stV: $('#statsView'), art: $('#articleDetail'), cnt: $('#articleCount'),
    emp: $('#emptyState'), si: $('#searchInput'), sd: $('#searchDropdown'),
    sp: $('#statsPanel'), tk: $('#toast'), tt: $('#themeToggle'),
    fc: $('#filterChips'), mt: $('#moduleToggle'),
  };

  /* ---- Mermaid ---- */
  mermaid.initialize({ startOnLoad: false, theme: 'default' });

  /* ---- Theme ---- */
  const html = document.documentElement;
  const saved = localStorage.getItem('theme') || 'light';
  html.setAttribute('data-theme', saved);
  mermaid.initialize({ theme: saved === 'dark' ? 'dark' : 'default' });

  E.tt.addEventListener('click', () => {
    const next = html.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    mermaid.initialize({ theme: next === 'dark' ? 'dark' : 'default' });
  });

  /* ---- Toast ---- */
  function toast(m) {
    E.tk.textContent = m;
    E.tk.classList.add('show');
    clearTimeout(E.tk._t);
    E.tk._t = setTimeout(() => E.tk.classList.remove('show'), 1800);
  }

  /* ---- Pipeline color ---- */
  function pipeClass(p) {
    if (p === '微信资讯') return 'pipe-wx';
    if (p === '设计管线') return 'pipe-pl';
    if (p === '游戏跟踪') return 'pipe-tr';
    if (p === 'AI资讯') return 'pipe-ai';
    if (p === '访谈跟踪') return 'pipe-iv';
    return '';
  }

  /* ---- Module Toggle ---- */
  E.mt.addEventListener('click', e => {
    const btn = e.target.closest('.mt-btn');
    if (btn) {
      const key = btn.dataset.module;
      if (key === S.activeModule) { E.mt.classList.remove('open'); return; }
      switchModule(key);
      E.mt.classList.remove('open');
      return;
    }
    // Click trigger bar → toggle open (for touch devices)
    if (e.target.closest('.mt-trigger')) {
      E.mt.classList.toggle('open');
    }
  });

  // Close toggle when clicking elsewhere
  document.addEventListener('click', e => {
    if (!E.mt.contains(e.target)) E.mt.classList.remove('open');
  });

  function switchModule(key) {
    S.activeModule = key;
    S.filter = '';
    S.q = '';
    S.arts = [];
    S.offset = 0;
    S.rendered = 0;
    E.si.value = '';

    // Update toggle buttons
    E.mt.querySelectorAll('.mt-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.module === key);
    });

    // Update collapsed trigger label
    const cur = E.mt.querySelector('.mt-current');
    if (cur) cur.textContent = MODULES[key].label;

    // Rebuild sub-filter chips
    buildFilterChips();
    location.hash = '';
    loadArts();
  }

  /* ---- Sub-Filter Chips ---- */
  function buildFilterChips() {
    const mod = MODULES[S.activeModule];
    E.fc.innerHTML = '';
    mod.chips.forEach(c => {
      const btn = document.createElement('button');
      btn.className = 'f-chip' + (c.value === S.filter ? ' active' : '');
      btn.dataset.value = c.value;
      btn.textContent = c.label;
      btn.addEventListener('click', () => {
        S.filter = c.value;
        S.q = '';
        E.si.value = '';
        updChips();
        location.hash = '';
        loadArts();
      });
      E.fc.appendChild(btn);
    });
  }

  function updChips() {
    E.fc.querySelectorAll('.f-chip').forEach(b => {
      b.classList.toggle('active', b.dataset.value === S.filter);
    });
  }

  /* ---- Load Articles ---- */
  async function loadArts(reset) {
    reset = reset !== false;
    if (reset) { S.offset = 0; S.rendered = 0; S.arts = []; }

    try {
      const mod = MODULES[S.activeModule];
      const q = new URLSearchParams();
      q.set('pipeline', S.filter || mod.pipelines.join(','));
      q.set('sort', 'date');
      q.set('order', 'desc');
      q.set('limit', PAGE_SIZE);
      q.set('offset', S.offset);

      let url;
      if (S.q) {
        url = `/api/search?q=${encodeURIComponent(S.q)}&limit=${PAGE_SIZE}&offset=${S.offset}`;
      } else {
        url = `/api/articles?${q}`;
      }

      const r = await fetch(url);
      if (!r.ok) throw r;
      const d = await r.json();

      let articles = d.articles || [];

      // Client-side pipeline filter for search results
      if (S.q) {
        articles = articles.filter(a => mod.pipelines.includes(a.pipeline));
      }

      S.arts = (reset ? [] : S.arts).concat(articles);
      S.total = S.q ? articles.length : d.total;
      if (!S.q) {
        S.offset += articles.length;
        S.hasMore = S.offset < d.total;
      } else {
        S.hasMore = false;
      }
    } catch (e) {
      console.error(e);
      if (reset) S.arts = [];
      toast('加载失败');
    }
    drawTL(reset);
    updateCnt();
    updateMastheadMeta();
  }

  /* ---- Router ---- */
  function route() {
    const h = location.hash;
    if (h.startsWith('#d/')) return showDetail(h.slice(3));
    if (h === '#s') return showStats();
    showTimeline();
  }
  window.addEventListener('hashchange', route);

  /* ---- Views ---- */
  function setView(n) {
    S.view = n;
    E.tlV.classList.toggle('active', n === 'timeline');
    E.dtV.classList.toggle('active', n === 'detail');
    E.stV.classList.toggle('active', n === 'stats');
    document.querySelector('.filter-strip').style.display = (n === 'detail') ? 'none' : '';
    if (n === 'detail') scrollTo(0, 0);
  }

  function showTimeline() {
    setView('timeline');
    S.id = null;
    history.replaceState(null, '', ' ');
    if (!S.arts.length && !S.q && !S.filter) loadArts();
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
  function drawTL(reset) {
    if (reset) E.tl.innerHTML = '';

    const oldBtn = E.tl.querySelector('.load-more-wrap');
    if (oldBtn) oldBtn.remove();

    E.emp.style.display = S.arts.length ? 'none' : 'block';

    if (reset) {
      S.rendered = 0;
      if (S.arts.length >= 1) {
        E.tl.appendChild(createSectionHeader('最新分析'));
        const end = Math.min(9, S.arts.length);
        for (let i = 0; i < end; i++) E.tl.appendChild(card(S.arts[i], 'standard'));
        S.rendered = end;
      }
      if (S.arts.length >= 10) {
        const rule = document.createElement('div');
        rule.className = 'section-rule';
        E.tl.appendChild(rule);
        E.tl.appendChild(createSectionHeader('更早的文章'));

        const monthName = d => (d || '').substring(0, 7) || '未知日期';
        let lastMonth = '';
        for (let i = 9; i < S.arts.length; i++) {
          const m = monthName(S.arts[i].date);
          if (m !== lastMonth) {
            const sep = document.createElement('div');
            sep.className = 'month-sep';
            const [y, mo] = m.split('-');
            sep.textContent = `──── ${y}年${parseInt(mo)}月 ────`;
            E.tl.appendChild(sep);
            lastMonth = m;
          }
          E.tl.appendChild(card(S.arts[i], 'compact'));
        }
        S.rendered = S.arts.length;
      }
    } else {
      const monthName = d => (d || '').substring(0, 7) || '未知日期';
      let lastMonth = '';
      if (S.arts.length > S.rendered && S.rendered > 0) {
        lastMonth = monthName(S.arts[Math.max(0, S.rendered - 1)].date);
      }
      for (let i = S.rendered; i < S.arts.length; i++) {
        const m = monthName(S.arts[i].date);
        if (m !== lastMonth) {
          const sep = document.createElement('div');
          sep.className = 'month-sep';
          const [y, mo] = m.split('-');
          sep.textContent = `──── ${y}年${parseInt(mo)}月 ────`;
          E.tl.appendChild(sep);
          lastMonth = m;
        }
        E.tl.appendChild(card(S.arts[i], 'compact'));
      }
      S.rendered = S.arts.length;
    }

    if (S.hasMore) {
      const wrap = document.createElement('div');
      wrap.className = 'load-more-wrap';
      const btn = document.createElement('button');
      btn.className = 'load-more-btn';
      btn.textContent = `加载更多 (${S.total - S.offset} 篇剩余)`;
      btn.addEventListener('click', () => loadArts(false));
      wrap.appendChild(btn);
      E.tl.appendChild(wrap);
    }
  }

  function card(a, variant) {
    variant = variant || 'standard';
    const el = document.createElement('div');
    el.className = 'card ' + variant;
    el.setAttribute('data-pipeline', a.pipeline);
    const pc = pipeClass(a.pipeline);

    if (variant === 'standard') {
      const tags = (a.tags || []).slice(0, 4);
      const desc = (a.summary || '').slice(0, 120);
      el.innerHTML =
        `<div class="card-top">` +
          `<span class="card-badge ${pc}">${esc(a.pipeline)}</span>` +
          `<span class="card-badge">${esc(a.stage)}</span>` +
          `<span class="card-date">${esc(a.date || '')}</span>` +
        `</div>` +
        `<div class="card-title">${esc(a.title)}</div>` +
        (a.source ? `<div class="card-source">来源：${esc(a.source)}</div>` : '') +
        (desc ? `<div class="card-desc">${esc(desc)}</div>` : '') +
        (tags.length ? `<div class="card-tags">${tags.map(t => `<span class="card-tag">${esc(t)}</span>`).join('')}</div>` : '');
    } else {
      el.innerHTML =
        `<span class="card-badge ${pc}">${esc(a.pipeline)}</span>` +
        `<div class="card-title">${esc(a.title)}</div>`;
    }
    el.addEventListener('click', () => { location.hash = 'd/' + a.id; });
    return el;
  }

  function updateCnt() {
    const total = S.total || S.arts.length;
    let t = `共 ${total} 篇`;
    if (S.arts.length < total) t += ` (已加载 ${S.arts.length})`;
    if (S.filter) t += ` · ${S.filter}`;
    if (S.q) t += ` · 搜索："${S.q}"`;
    E.cnt.textContent = t;
  }

  function createSectionHeader(label) {
    const el = document.createElement('div');
    el.className = 'section-header';
    el.textContent = label;
    return el;
  }

  function updateMastheadMeta() {
    const total = S.total || S.arts.length;
    const modLabel = MODULES[S.activeModule].label;
    let dateStr = '';
    if (S.statsCache && S.statsCache.latestDate) {
      const parts = S.statsCache.latestDate.split('-');
      if (parts.length >= 3) {
        dateStr = `更新于${parseInt(parts[1])}月${parseInt(parts[2])}日 · `;
      }
    }
    const meta = document.getElementById('mastheadMeta');
    if (meta) {
      meta.textContent = `${dateStr}${modLabel} · ${total}篇`;
    }
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

  /* ---- Buttons ---- */
  $('#homeBtn').addEventListener('click', e => {
    e.preventDefault();
    S.q = '';
    E.si.value = '';
    E.sd.classList.remove('show');
    S.filter = '';
    updChips();
    location.hash = '';
    loadArts();
    showTimeline();
  });
  $('#backBtn').addEventListener('click', showTimeline);
  $('#statsBackBtn').addEventListener('click', showTimeline);

  /* ---- Keyboard ---- */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const lb = document.querySelector('.mermaid-lb');
      if (lb) { lb.remove(); return; }
      if (S.view !== 'timeline') showTimeline();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      E.si.focus();
    }
  });

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
        try {
          mermaid.run({ nodes: bs }).then(() => {
            for (const node of bs) node.addEventListener('click', () => showLightbox(node.innerHTML));
          });
        } catch (e) { console.error('Mermaid:', e); }
      }
      buildTOC();
    });
  }

  /* ---- Stats ---- */
  function drawStats(d) {
    S.statsCache = d;
    const gamesPipes = MODULES.games.pipelines;
    const aiPipes = MODULES.ai.pipelines;
    const gamesTotal = gamesPipes.reduce((s, p) => s + (d.pipelineCounts[p] || 0), 0);
    const aiTotal = aiPipes.reduce((s, p) => s + (d.pipelineCounts[p] || 0), 0);
    const maxS = Math.max(1, ...Object.values(d.stageCounts || {}));

    E.sp.innerHTML =
      `<div class="stats-wrap">` +
        `<div class="stat-hero">` +
          `<div class="stat-hero-card"><div class="stat-hero-num">${d.total}</div><div class="stat-hero-label">总计</div></div>` +
          `<div class="stat-hero-card"><div class="stat-hero-num">${gamesTotal}</div><div class="stat-hero-label">游戏模块</div></div>` +
          `<div class="stat-hero-card"><div class="stat-hero-num">${aiTotal}</div><div class="stat-hero-label">AI模块</div></div>` +
        `</div>` +

        `<div class="stats-section"><h3>游戏模块</h3>` +
          gamesPipes.map(p => {
            const v = d.pipelineCounts[p] || 0;
            return `<div class="stat-row"><span class="stat-row-name">${esc(p)}</span>` +
              `<div class="stat-row-bar"><div class="stat-row-bar-fill" style="width:${Math.min(100, (v / Math.max(1, gamesTotal)) * 100) | 0}%"></div></div>` +
              `<span class="stat-row-num">${v}</span></div>`;
          }).join('') +
        `</div>` +

        `<div class="stats-section"><h3>AI模块</h3>` +
          aiPipes.map(p => {
            const v = d.pipelineCounts[p] || 0;
            return `<div class="stat-row"><span class="stat-row-name">${esc(p)}</span>` +
              `<div class="stat-row-bar"><div class="stat-row-bar-fill" style="width:${Math.min(100, (v / Math.max(1, aiTotal)) * 100) | 0}%"></div></div>` +
              `<span class="stat-row-num">${v}</span></div>`;
          }).join('') +
        `</div>` +

        `<div class="stats-section"><h3>阶段分布</h3>` +
          Object.entries(d.stageCounts || {}).map(([k, v]) =>
            `<div class="stat-row"><span class="stat-row-name">${esc(k)}</span>` +
              `<div class="stat-row-bar"><div class="stat-row-bar-fill" style="width:${(v / maxS * 100) | 0}%"></div></div>` +
              `<span class="stat-row-num">${v}</span></div>`).join('') +
        `</div>` +

        (d.monthDistribution && d.monthDistribution.length ? `<div class="stats-section"><h3>月度分布</h3>` +
          d.monthDistribution.map(({ month, count }) =>
            `<div class="stat-row"><span class="stat-row-name">${month}</span><span class="stat-row-num">${count} 篇</span></div>`).join('') +
        `</div>` : '') +

        `<div class="stats-footnote">${d.latestDate ? `最新：${d.latestDate} &middot; 最早：${d.earliestDate}` : ''}</div>` +

        (d.topTags && d.topTags.length ? `<div class="stats-section"><h3>热门标签</h3><div class="tag-cloud">` +
          d.topTags.map(t => `<span class="tag-pill" data-tag="${esc(t.name)}">${esc(t.name)} ${t.count}</span>`).join('') +
        `</div></div>` : '') +
      `</div>`;

    E.sp.querySelectorAll('.tag-pill').forEach(el => {
      el.addEventListener('click', () => {
        S.filter = '';
        S.q = el.dataset.tag;
        E.si.value = S.q;
        updChips();
        location.hash = '';
        loadArts();
        showTimeline();
      });
    });
  }

  /* ---- Lightbox ---- */
  function showLightbox(html) {
    const old = document.querySelector('.mermaid-lb');
    if (old) old.remove();
    const lb = document.createElement('div');
    lb.className = 'mermaid-lb';
    lb.innerHTML = `<div class="mermaid-lb-inner"><button class="mermaid-lb-close">&times;</button>${html}</div>`;
    const svg = lb.querySelector('svg');
    if (svg) {
      svg.removeAttribute('width'); svg.removeAttribute('height');
      svg.style.width = '100%'; svg.style.height = 'auto';
      svg.style.minWidth = '65vw'; svg.style.maxHeight = '85vh';
    }
    const close = () => lb.remove();
    lb.addEventListener('click', e => { if (e.target === lb) close(); });
    lb.querySelector('.mermaid-lb-close').addEventListener('click', close);
    document.body.appendChild(lb);
    requestAnimationFrame(() => lb.classList.add('show'));
  }

  /* ---- TOC ---- */
  function buildTOC() {
    const old = document.querySelector('.toc-sidebar');
    if (old) old.remove();
    const prose = E.art.querySelector('.prose');
    if (!prose) return;
    const headings = prose.querySelectorAll('h2, h3');
    if (headings.length < 2) return;

    const items = [];
    headings.forEach((h, i) => {
      const id = 'hdr-' + i; h.id = id;
      items.push({ id, text: h.textContent, level: h.tagName === 'H2' ? 2 : 3 });
    });

    const sidebar = document.createElement('aside');
    sidebar.className = 'toc-sidebar';
    sidebar.innerHTML = `<div class="toc-title">目录</div>` +
      items.map(it => `<a class="toc-item toc-l${it.level}" href="#${it.id}">${esc(it.text)}</a>`).join('');

    sidebar.querySelectorAll('.toc-item').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        const el = document.getElementById(a.hash.slice(1));
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          sidebar.querySelectorAll('.toc-item').forEach(x => x.classList.remove('toc-active'));
          a.classList.add('toc-active');
        }
      });
    });
    E.art.querySelector('.detail-wrap').appendChild(sidebar);

    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          let current = '';
          headings.forEach((h, i) => { if (h.getBoundingClientRect().top <= 120) current = 'hdr-' + i; });
          sidebar.querySelectorAll('.toc-item').forEach(a => {
            a.classList.toggle('toc-active', a.hash === '#' + current);
          });
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    sidebar._onScroll = onScroll;
  }

  const origShowTimeline = showTimeline;
  showTimeline = function () {
    const sidebar = document.querySelector('.toc-sidebar');
    if (sidebar && sidebar._onScroll) window.removeEventListener('scroll', sidebar._onScroll);
    origShowTimeline();
  };

  /* ---- Utils ---- */
  function esc(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  /* ---- Init ---- */
  (async function init() {
    try { const r = await fetch('/api/stats'); if (r.ok) S.statsCache = await r.json(); } catch (_) {}
    buildFilterChips();
    await loadArts();
    const h = location.hash;
    if (h.startsWith('#d/')) showDetail(h.slice(3));
    else if (h === '#s') showStats();
    else showTimeline();
    updateMastheadMeta();
  })();

})();
