/**
 * Game & AI Research Archive — Frontend Logic
 * Dual-module SPA: Games panel (left) + AI panel (right)
 * Hash-based routing: #d/{id} for detail, #s for stats
 */
(function () {
  'use strict';

  /* ---- Module Config ---- */
  const MODULES = {
    games: {
      label: '游 戏',
      pipelines: ['微信资讯', '游戏跟踪', '设计管线'],
    },
    ai: {
      label: 'A I',
      pipelines: ['AI资讯', '访谈跟踪'],
    }
  };

  const PAGE_SIZE = 12;

  /* ---- State ---- */
  const S = {
    modules: {
      games: { arts: [], filter: '', offset: 0, hasMore: false, total: 0, rendered: 0 },
      ai:    { arts: [], filter: '', offset: 0, hasMore: false, total: 0, rendered: 0 }
    },
    view: 'dual',
    id: null,
    q: '',
    tm: null,
    statsCache: null
  };

  /* ---- DOM helpers ---- */
  const $ = s => document.querySelector(s);
  const E = {
    dv: $('#dualView'), dtV: $('#detailView'), stV: $('#statsView'),
    gGrid: $('#gamesGrid'), gCount: $('#gamesCount'), gEmpty: $('#gamesEmpty'), gMore: $('#gamesLoadMore'),
    aGrid: $('#aiGrid'), aCount: $('#aiCount'), aEmpty: $('#aiEmpty'), aMore: $('#aiLoadMore'),
    art: $('#articleDetail'), sp: $('#statsPanel'),
    si: $('#searchInput'), sd: $('#searchDropdown'),
    tk: $('#toast'), tt: $('#themeToggle'),
  };

  /* ---- Mermaid init ---- */
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

  /* ---- Router ---- */
  function route() {
    const h = location.hash;
    if (h.startsWith('#d/')) return showDetail(h.slice(3));
    if (h === '#s') return showStats();
    showDual();
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
    if (pipeline === '设计管线') return 'pipe-pl';
    if (pipeline === '游戏跟踪') return 'pipe-tr';
    if (pipeline === 'AI资讯') return 'pipe-ai';
    if (pipeline === '访谈跟踪') return 'pipe-iv';
    return '';
  }

  /* ---- Load Module Articles ---- */
  async function loadModuleArts(moduleKey, reset) {
    reset = reset !== false;
    const mod = S.modules[moduleKey];
    if (reset) {
      mod.offset = 0;
      mod.rendered = 0;
      mod.arts = [];
    }
    try {
      const pipelines = MODULES[moduleKey].pipelines;
      const q = new URLSearchParams();
      q.set('pipeline', mod.filter || pipelines.join(','));
      q.set('sort', 'date');
      q.set('order', 'desc');
      q.set('limit', PAGE_SIZE);
      q.set('offset', mod.offset);

      let url;
      if (S.q) {
        url = `/api/search?q=${encodeURIComponent(S.q)}&limit=${PAGE_SIZE}&offset=${mod.offset}`;
      } else {
        url = `/api/articles?${q}`;
      }

      const r = await fetch(url);
      if (!r.ok) throw r;
      const d = await r.json();

      let articles = d.articles || [];

      // Client-side pipeline filter for search results (search API doesn't filter by pipeline)
      if (S.q) {
        articles = articles.filter(a => pipelines.includes(a.pipeline));
      }

      mod.arts = (reset ? [] : mod.arts).concat(articles);
      mod.total = S.q ? articles.length : d.total;
      if (!S.q) {
        mod.offset += articles.length;
        mod.hasMore = mod.offset < d.total;
      } else {
        mod.hasMore = false;
      }
    } catch (e) {
      console.error(e);
      if (reset) mod.arts = [];
      toast(moduleKey === 'games' ? '游戏模块加载失败' : 'AI模块加载失败');
    }
    drawModulePanel(moduleKey, reset);
    updateModuleMeta(moduleKey);
    updateMastheadMeta();
  }

  /* ---- Draw Module Panel ---- */
  function drawModulePanel(moduleKey, reset) {
    const mod = S.modules[moduleKey];
    const grid = moduleKey === 'games' ? E.gGrid : E.aGrid;
    const empty = moduleKey === 'games' ? E.gEmpty : E.aEmpty;
    const moreWrap = moduleKey === 'games' ? E.gMore : E.aMore;

    if (reset) grid.innerHTML = '';

    // Remove old load-more button
    const oldBtn = grid.parentElement.querySelector('.load-more-wrap');
    if (oldBtn) oldBtn.remove();

    empty.style.display = mod.arts.length ? 'none' : 'block';
    moreWrap.innerHTML = '';

    if (mod.arts.length === 0) return;

    if (reset) {
      mod.rendered = 0;
      // Standard cards: first 6
      const stdEnd = Math.min(6, mod.arts.length);
      for (let i = 0; i < stdEnd; i++) {
        grid.appendChild(card(mod.arts[i], 'standard'));
      }
      mod.rendered = stdEnd;

      // Compact cards: rest
      if (mod.arts.length > 6) {
        // Group by month
        const monthName = d => (d || '').substring(0, 7) || '未知日期';
        let lastMonth = '';
        for (let i = 6; i < mod.arts.length; i++) {
          const m = monthName(mod.arts[i].date);
          if (m !== lastMonth) {
            const sep = document.createElement('div');
            sep.className = 'month-sep';
            sep.style.gridColumn = '1 / -1';
            const [y, mo] = m.split('-');
            sep.textContent = `──── ${y}年${parseInt(mo)}月 ────`;
            grid.appendChild(sep);
            lastMonth = m;
          }
          grid.appendChild(card(mod.arts[i], 'compact'));
        }
        mod.rendered = mod.arts.length;
      }
    } else {
      // Load more: append compact, grouped by month
      const monthName = d => (d || '').substring(0, 7) || '未知日期';
      let lastMonth = '';
      if (mod.arts.length > mod.rendered && mod.rendered > 0) {
        lastMonth = monthName(mod.arts[Math.max(0, mod.rendered - 1)].date);
      }
      for (let i = mod.rendered; i < mod.arts.length; i++) {
        const m = monthName(mod.arts[i].date);
        if (m !== lastMonth) {
          const sep = document.createElement('div');
          sep.className = 'month-sep';
          sep.style.gridColumn = '1 / -1';
          const [y, mo] = m.split('-');
          sep.textContent = `──── ${y}年${parseInt(mo)}月 ────`;
          grid.appendChild(sep);
          lastMonth = m;
        }
        grid.appendChild(card(mod.arts[i], 'compact'));
      }
      mod.rendered = mod.arts.length;
    }

    if (mod.hasMore) {
      const wrap = document.createElement('div');
      wrap.className = 'load-more-wrap';
      const btn = document.createElement('button');
      btn.className = 'load-more-btn';
      btn.textContent = `加载更多 (${mod.total - mod.offset} 篇剩余)`;
      btn.addEventListener('click', () => loadModuleArts(moduleKey, false));
      wrap.appendChild(btn);
      moreWrap.appendChild(wrap);
    }
  }

  /* ---- Card ---- */
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

  /* ---- Update Module Meta ---- */
  function updateModuleMeta(moduleKey) {
    const mod = S.modules[moduleKey];
    const countEl = moduleKey === 'games' ? E.gCount : E.aCount;
    let t = `${mod.total} 篇`;
    if (mod.filter) t = `${mod.total} 篇 · ${mod.filter}`;
    if (S.q) t += ` · "${S.q}"`;
    countEl.textContent = t;
  }

  function updateMastheadMeta() {
    const gamesTotal = S.modules.games.total;
    const aiTotal = S.modules.ai.total;
    const total = gamesTotal + aiTotal;
    let dateStr = '';
    if (S.statsCache && S.statsCache.latestDate) {
      const parts = S.statsCache.latestDate.split('-');
      if (parts.length >= 3) {
        dateStr = `更新于${parseInt(parts[1])}月${parseInt(parts[2])}日 · `;
      }
    }
    const meta = document.getElementById('mastheadMeta');
    if (meta) {
      meta.textContent = `${dateStr}共 ${total} 篇 · 游戏 ${gamesTotal} · AI ${aiTotal}`;
    }
  }

  /* ---- Views ---- */
  function setView(n) {
    S.view = n;
    E.dv.classList.toggle('active', n === 'dual');
    E.dtV.classList.toggle('active', n === 'detail');
    E.stV.classList.toggle('active', n === 'stats');

    // Show/hide module strip and toolbar search
    const modStrip = document.querySelector('.module-strip');
    if (modStrip) modStrip.style.display = (n === 'dual') ? '' : 'none';

    if (n === 'detail') scrollTo(0, 0);
  }

  function showDual() {
    setView('dual');
    S.id = null;
    history.replaceState(null, '', ' ');
    // Load if not yet loaded
    if (!S.modules.games.arts.length && !S.q) loadModuleArts('games');
    if (!S.modules.ai.arts.length && !S.q) loadModuleArts('ai');
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

  /* ---- Search ---- */
  E.si.addEventListener('input', () => {
    const v = E.si.value.trim();
    clearTimeout(S.tm);
    S.tm = setTimeout(() => {
      S.q = v;
      if (v.length >= 1) suggest(v);
      else { E.sd.classList.remove('show'); location.hash = ''; loadAllModules(); }
    }, 280);
  });

  E.si.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      clearTimeout(S.tm);
      S.q = E.si.value.trim();
      E.sd.classList.remove('show');
      location.hash = '';
      loadAllModules();
    }
  });

  document.addEventListener('click', e => {
    if (!E.si.contains(e.target) && !E.sd.contains(e.target)) E.sd.classList.remove('show');
  });

  function loadAllModules() {
    // Reset and reload both modules
    S.modules.games.offset = 0; S.modules.games.rendered = 0; S.modules.games.arts = [];
    S.modules.ai.offset = 0; S.modules.ai.rendered = 0; S.modules.ai.arts = [];
    showDual();
    Promise.all([loadModuleArts('games'), loadModuleArts('ai')]);
  }

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

  /* ---- Panel Filters ---- */
  function bindPanelFilters() {
    document.querySelectorAll('.pf-chip[data-module]').forEach(b => {
      const clone = b.cloneNode(true);
      b.parentNode.replaceChild(clone, b);
      clone.addEventListener('click', () => {
        const moduleKey = clone.dataset.module;
        const pipeline = clone.dataset.pipeline || '';
        S.modules[moduleKey].filter = pipeline;
        S.q = '';
        E.si.value = '';

        // Update active state for chips in this module
        const strip = clone.closest('.panel-filter-strip');
        strip.querySelectorAll('.pf-chip').forEach(c => {
          c.classList.toggle('active', c.dataset.pipeline === pipeline);
        });

        // Reload this module only
        showDual();
        loadModuleArts(moduleKey);
      });
    });
  }

  /* ---- Buttons ---- */
  $('#homeBtn').addEventListener('click', e => {
    e.preventDefault();
    S.q = '';
    E.si.value = '';
    E.sd.classList.remove('show');
    // Reset module filters
    S.modules.games.filter = '';
    S.modules.ai.filter = '';
    // Reset active chips
    document.querySelectorAll('.panel-filter-strip .pf-chip').forEach(c => {
      c.classList.toggle('active', c.dataset.pipeline === '');
    });
    location.hash = '';
    loadAllModules();
  });

  $('#backBtn').addEventListener('click', showDual);
  $('#statsBackBtn').addEventListener('click', showDual);

  /* ---- Keyboard ---- */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const lb = document.querySelector('.mermaid-lb');
      if (lb) { lb.remove(); return; }
      if (S.view !== 'dual') showDual();
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
            for (const node of bs) {
              node.addEventListener('click', () => showLightbox(node.innerHTML));
            }
          });
        } catch (e) { console.error('Mermaid:', e); }
      }
      buildTOC();
    });
  }

  /* ---- Stats ---- */
  function drawStats(d) {
    S.statsCache = d;

    // Build module-grouped stats
    const gamesPipes = MODULES.games.pipelines;
    const aiPipes = MODULES.ai.pipelines;
    const gamesTotal = gamesPipes.reduce((sum, p) => sum + (d.pipelineCounts[p] || 0), 0);
    const aiTotal = aiPipes.reduce((sum, p) => sum + (d.pipelineCounts[p] || 0), 0);

    const maxS = Math.max(1, ...Object.values(d.stageCounts || {}));

    E.sp.innerHTML =
      `<div class="stats-wrap">` +
        `<div class="stat-hero">` +
          `<div class="stat-hero-card"><div class="stat-hero-num">${d.total}</div><div class="stat-hero-label">总计</div></div>` +
          `<div class="stat-hero-card"><div class="stat-hero-num">${gamesTotal}</div><div class="stat-hero-label">游戏模块</div></div>` +
          `<div class="stat-hero-card"><div class="stat-hero-num">${aiTotal}</div><div class="stat-hero-label">AI模块</div></div>` +
        `</div>` +

        // Games module breakdown
        `<div class="stats-section">` +
          `<h3>游戏模块</h3>` +
          gamesPipes.map(p => {
            const v = d.pipelineCounts[p] || 0;
            return `<div class="stat-row">` +
              `<span class="stat-row-name">${esc(p)}</span>` +
              `<div class="stat-row-bar"><div class="stat-row-bar-fill" style="width:${Math.min(100, (v / Math.max(1, gamesTotal)) * 100) | 0}%"></div></div>` +
              `<span class="stat-row-num">${v}</span>` +
            `</div>`;
          }).join('') +
        `</div>` +

        // AI module breakdown
        `<div class="stats-section">` +
          `<h3>AI模块</h3>` +
          aiPipes.map(p => {
            const v = d.pipelineCounts[p] || 0;
            return `<div class="stat-row">` +
              `<span class="stat-row-name">${esc(p)}</span>` +
              `<div class="stat-row-bar"><div class="stat-row-bar-fill" style="width:${Math.min(100, (v / Math.max(1, aiTotal)) * 100) | 0}%"></div></div>` +
              `<span class="stat-row-num">${v}</span>` +
            `</div>`;
          }).join('') +
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
        S.modules.games.filter = '';
        S.modules.ai.filter = '';
        S.q = el.dataset.tag;
        E.si.value = S.q;
        document.querySelectorAll('.panel-filter-strip .pf-chip').forEach(c => {
          c.classList.toggle('active', c.dataset.pipeline === '');
        });
        location.hash = '';
        loadAllModules();
        showDual();
      });
    });
  }

  /* ---- Lightbox ---- */
  function showLightbox(html) {
    const old = document.querySelector('.mermaid-lb');
    if (old) old.remove();

    const lb = document.createElement('div');
    lb.className = 'mermaid-lb';
    lb.innerHTML =
      `<div class="mermaid-lb-inner">` +
        `<button class="mermaid-lb-close">&times;</button>` +
        html +
      `</div>`;

    const svg = lb.querySelector('svg');
    if (svg) {
      svg.removeAttribute('width');
      svg.removeAttribute('height');
      svg.style.width = '100%';
      svg.style.height = 'auto';
      svg.style.minWidth = '65vw';
      svg.style.maxHeight = '85vh';
    }

    const close = () => lb.remove();
    lb.addEventListener('click', e => {
      if (e.target === lb) close();
    });
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
      const id = 'hdr-' + i;
      h.id = id;
      items.push({ id, text: h.textContent, level: h.tagName === 'H2' ? 2 : 3 });
    });

    const sidebar = document.createElement('aside');
    sidebar.className = 'toc-sidebar';
    sidebar.innerHTML =
      `<div class="toc-title">目录</div>` +
      items.map(item =>
        `<a class="toc-item toc-l${item.level}" href="#${item.id}">${esc(item.text)}</a>`
      ).join('');

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
          headings.forEach((h, i) => {
            if (h.getBoundingClientRect().top <= 120) current = 'hdr-' + i;
          });
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

  // Clean up TOC scroll listener when leaving detail
  const origShowDual = showDual;
  showDual = function () {
    const sidebar = document.querySelector('.toc-sidebar');
    if (sidebar && sidebar._onScroll) {
      window.removeEventListener('scroll', sidebar._onScroll);
    }
    origShowDual();
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
    // Preload stats for masthead meta
    try {
      const r = await fetch('/api/stats');
      if (r.ok) S.statsCache = await r.json();
    } catch (_) {}

    bindPanelFilters();

    // Load both modules
    await Promise.all([loadModuleArts('games'), loadModuleArts('ai')]);

    const h = location.hash;
    if (h.startsWith('#d/')) showDetail(h.slice(3));
    else if (h === '#s') showStats();
    else showDual();
  })();

})();
