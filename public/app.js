/**
 * Game Research Archive — Frontend Logic
 * Hash-based SPA with timeline, detail, stats views
 */
(function () {
  'use strict';

  /* ---- State ---- */
  const PAGE_SIZE = 15;
  const S = {
    arts: [],
    view: 'timeline',
    id: null,
    flt: { pipeline: '', stage: '', month: '' },
    q: '',
    tm: null,
    offset: 0,
    hasMore: false,
    total: 0,
    rendered: 0
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

  /* ---- Month filter init ---- */
  (async function loadMonths() {
    try {
      const r = await fetch('/api/stats');
      if (!r.ok) return;
      const d = await r.json();
      const months = (d.monthDistribution || []).map(x => x.month).sort().reverse();
      const row = $('#monthFilters');
      months.forEach(m => {
        const [y, mo] = m.split('-');
        const chip = document.createElement('button');
        chip.className = 'f-chip';
        chip.dataset.key = 'month';
        chip.dataset.value = m;
        chip.textContent = `${parseInt(mo)}月`;
        row.appendChild(chip);
      });
      // Re-bind filter chips
      bindFilterChips();
    } catch (_) {}
  })();

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
    if (pipeline === 'AI资讯') return 'pipe-ai';
    if (pipeline === '访谈跟踪') return 'pipe-iv';
    return '';
  }

  /* ---- Load ---- */
  async function loadArts(reset = true) {
    if (reset) {
      S.offset = 0;
      S.rendered = 0;
      S.arts = [];
    }
    try {
      const q = new URLSearchParams();
      if (S.flt.pipeline) q.set('pipeline', S.flt.pipeline);
      if (S.flt.stage) q.set('stage', S.flt.stage);
      if (S.flt.month) q.set('month', S.flt.month);
      q.set('sort', 'date');
      q.set('order', 'desc');
      q.set('limit', PAGE_SIZE);
      q.set('offset', S.offset);
      const url = S.q
        ? `/api/search?q=${encodeURIComponent(S.q)}&limit=${PAGE_SIZE}&offset=${S.offset}`
        : `/api/articles?${q}`;
      const r = await fetch(url);
      if (!r.ok) throw r;
      const d = await r.json();
      S.arts = (reset ? [] : S.arts).concat(d.articles || []);
      S.total = d.total;
      S.offset += (d.articles || []).length;
      S.hasMore = S.offset < d.total;
    } catch (e) {
      console.error(e);
      if (reset) S.arts = [];
      toast('加载失败');
    }
    drawTL(reset);
    updateCnt();
  }

  /* ---- Views ---- */
  function setView(n) {
    S.view = n;
    E.tlV.classList.toggle('active', n === 'timeline');
    E.dtV.classList.toggle('active', n === 'detail');
    E.stV.classList.toggle('active', n === 'stats');
    // 详情页隐藏筛选栏
    document.querySelector('.filter-strip').style.display = (n === 'detail') ? 'none' : '';
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
  function drawTL(reset) {
    if (reset) E.tl.innerHTML = '';

    const oldBtn = E.tl.querySelector('.load-more-wrap');
    if (oldBtn) oldBtn.remove();

    E.emp.style.display = S.arts.length ? 'none' : 'block';

    if (reset) {
      S.rendered = 0;
      // Hero: first article
      if (S.arts.length >= 1) {
        E.tl.appendChild(createSectionHeader('头条聚焦'));
        E.tl.appendChild(card(S.arts[0], 'hero'));
        S.rendered = 1;
      }

      // Standard: articles 2-7 (indices 1-6)
      if (S.arts.length >= 2) {
        const rule = document.createElement('div');
        rule.className = 'section-rule';
        E.tl.appendChild(rule);
        E.tl.appendChild(createSectionHeader('最新分析'));
        const end = Math.min(7, S.arts.length);
        for (let i = 1; i < end; i++) {
          E.tl.appendChild(card(S.arts[i], 'standard'));
        }
        S.rendered = end;
      }

      // Compact: articles 8+ (index 7+)
      if (S.arts.length >= 8) {
        const rule = document.createElement('div');
        rule.className = 'section-rule';
        E.tl.appendChild(rule);
        E.tl.appendChild(createSectionHeader('更早的文章'));

        // Group by month
        const monthName = d => (d || '').substring(0, 7) || '未知日期';
        let lastMonth = '';
        for (let i = 7; i < S.arts.length; i++) {
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
      // Load more: append new articles as compact, grouped by month
      const monthName = d => (d || '').substring(0, 7) || '未知日期';
      // Determine the last month rendered to avoid duplicate separators
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

    updateMastheadMeta();

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

    if (variant === 'hero') {
      const tags = (a.tags || []).slice(0, 4);
      const desc = (a.summary || '').slice(0, 250);
      el.innerHTML =
        `<div class="card-top">` +
          `<span class="card-badge ${pc}">${esc(a.pipeline)}</span>` +
          `<span class="card-badge">${esc(a.stage)}</span>` +
          `<span class="card-date">${formatDateChinese(a.date)}</span>` +
        `</div>` +
        `<div class="card-title">${esc(a.title)}</div>` +
        (a.source ? `<div class="card-source">来源：${esc(a.source)}</div>` : '') +
        (desc ? `<div class="card-desc">${esc(desc)}</div>` : '') +
        (tags.length ? `<div class="card-tags">${tags.map(t => `<span class="card-tag">${esc(t)}</span>`).join('')}</div>` : '');
    } else if (variant === 'standard') {
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
      // Compact: only badge + title
      el.innerHTML =
        `<span class="card-badge ${pc}">${esc(a.pipeline)}</span>` +
        `<div class="card-title">${esc(a.title)}</div>`;
    }
    el.addEventListener('click', () => { location.hash = 'd/' + a.id; });
    return el;
  }

  function drawToday(articles) {
    // Group by latest date
    const latestDate = articles[0].date;
    const todayArts = articles.filter(a => a.date === latestDate);
    if (!todayArts.length) return;

    const d = latestDate.split('-');
    const label = `${d[1]}月${d[2]}日`;

    const strip = document.createElement('div');
    strip.className = 'today-strip';
    strip.innerHTML =
      `<div class="today-head">
        <span class="today-icon">✦</span>
        <span>今日分析 · ${label}</span>
        <span class="today-count">${todayArts.length} 篇</span>
      </div>
      <div class="today-row">` +
        todayArts.map(a => {
          const pc = pipeClass(a.pipeline);
          return `<div class="today-card" data-id="${a.id}">
            <span class="today-card-tag ${pc}">${esc(a.pipeline)}</span>
            <div class="today-card-title">${esc(a.title)}</div>
            <span class="today-card-src">${esc(a.source || '')}</span>
          </div>`;
        }).join('') +
      `</div>`;

    strip.querySelectorAll('.today-card').forEach(c => {
      c.addEventListener('click', () => { location.hash = 'd/' + c.dataset.id; });
    });

    E.tl.before(strip);
  }

  function updateCnt() {
    const total = S.total || S.arts.length;
    let t = `共 ${total} 篇`;
    if (S.arts.length < total) t += ` (已加载 ${S.arts.length})`;
    if (S.flt.pipeline) t += ` · ${S.flt.pipeline}`;
    if (S.flt.stage) t += ` · ${S.flt.stage}`;
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
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const meta = document.getElementById('mastheadMeta');
    if (meta) {
      meta.textContent = `${y}年${m}月 · ${total}篇`;
    }
  }

  function formatDateChinese(d) {
    if (!d) return '';
    const parts = d.split('-');
    if (parts.length < 3) return d;
    return `${parts[0]}年${parseInt(parts[1])}月${parseInt(parts[2])}日`;
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
        S.flt = { pipeline: '', stage: '', month: '' };
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
  function bindFilterChips() {
    document.querySelectorAll('.f-chip[data-key]').forEach(b => {
      // Remove old listeners by cloning
      const clone = b.cloneNode(true);
      b.parentNode.replaceChild(clone, b);
      clone.addEventListener('click', () => {
        const k = clone.dataset.key, v = clone.dataset.value;
        S.flt[k] = v;
        S.q = '';
        E.si.value = '';
        updChips(k);
        location.hash = '';
        loadArts();
      });
    });
  }
  bindFilterChips();

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
    S.flt = { pipeline: '', stage: '', month: '' };
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
      // Close lightbox first if open
      const lb = document.querySelector('.mermaid-lb');
      if (lb) { lb.remove(); return; }
      if (S.view !== 'timeline') showTimeline();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      E.si.focus();
    }
  });

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

    // Force SVG to fill the container
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
    // Remove old TOC
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

    // Scroll to heading on click
    sidebar.querySelectorAll('.toc-item').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        const el = document.getElementById(a.hash.slice(1));
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          // Update active state
          sidebar.querySelectorAll('.toc-item').forEach(x => x.classList.remove('toc-active'));
          a.classList.add('toc-active');
        }
      });
    });

    E.art.querySelector('.detail-wrap').appendChild(sidebar);

    // Scroll spy
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
  const origShowTimeline = showTimeline;
  showTimeline = function () {
    const sidebar = document.querySelector('.toc-sidebar');
    if (sidebar && sidebar._onScroll) {
      window.removeEventListener('scroll', sidebar._onScroll);
    }
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
    await loadArts();
    const h = location.hash;
    if (h.startsWith('#d/')) showDetail(h.slice(3));
    else if (h === '#s') showStats();
    else showTimeline();
  })();

})();
