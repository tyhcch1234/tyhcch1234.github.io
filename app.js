/* 學習與工具總覽 — 自動 repo 索引 + 站內頁面搜尋 */
(function () {
  'use strict';

  var OWNER = 'tyhcch1234';
  var SYNC_TTL = 30 * 60 * 1000;         // GitHub repo 清單快取 30 分鐘
  var TREE_TTL = 12 * 60 * 60 * 1000;    // 單一 repo 頁面清單快取 12 小時
  var STALE_TTL = 24 * 60 * 60 * 1000;   // 每次開頁輪流更新 3 個 repo 的頁面清單
  var STALE_PER_LOAD = 3;

  var CATS = {
    math:   { label: '數學 · 文憑試與測驗', glyph: 'g-math' },
    lang:   { label: '中文 · 識字與書寫',   glyph: 'g-lang' },
    junior: { label: '小學 · 常識與科學',   glyph: 'g-flask' },
    mind:   { label: '身心 · 益智 · 記憶',  glyph: 'g-mind' },
    design: { label: '設計 · 繪本 · 導覽',  glyph: 'g-cube' },
    daily:  { label: '每日日誌 · 自動累積', glyph: 'g-cal' },
    media:  { label: '作品庫 · 圖文影音',   glyph: 'g-media' },
    play:   { label: '遊戲 · 互動教學',     glyph: 'g-play' },
    tools:  { label: '工具 · PDF 與掃描',   glyph: 'g-file' }
  };
  var ORDER = ['math', 'lang', 'junior', 'mind', 'design', 'daily', 'media', 'play', 'tools'];
  var PAGE_LIMIT = 8;

  var seed = JSON.parse(document.getElementById('seed').textContent);
  var sites = seed.sites.map(function (s) {
    s.pages = s.pages || [];
    s.pagesLoaded = true;
    s._new = false;
    return s;
  });

  var byName = Object.create(null);
  sites.forEach(function (s) { byName[s.name] = s; s._hay = siteHay(s); });

  var activeCat = 'all';
  var expanded = Object.create(null);
  var q = '';
  var searchTimer = null;

  var el = {
    sections: document.getElementById('sections'),
    chips: document.getElementById('chips'),
    input: document.getElementById('q'),
    hint: document.getElementById('hint'),
    empty: document.getElementById('empty'),
    statSites: document.getElementById('statSites'),
    statPages: document.getElementById('statPages'),
    statSync: document.getElementById('statSync'),
    statLive: document.getElementById('statLive'),
    footSites: document.getElementById('footSites'),
    footPages: document.getElementById('footPages'),
    syncBtn: document.getElementById('syncBtn'),
    topbar: document.getElementById('topbar'),
    toTop: null
  };

  /* ------------------------------------------------------------ helpers */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function siteHay(s) {
    return [s.title, s.desc, (s.tags || []).join(' '), s.name, (CATS[s.cat] || {}).label]
      .join(' ').toLowerCase();
  }
  function pageHay(p) { return (p.t + ' ' + p.u).toLowerCase(); }
  function siteUrl(s) { return 'https://' + OWNER + '.github.io/' + (s.url || (s.name + '/')); }
  function pageUrl(s, p) { return siteUrl(s) + p.u; }
  function link(s, p) {
    return encodeURI(pageUrl(s, p).replace(/ /g, '%20'));
  }
  function store(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }
  function read(key, ttl) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!ttl || Date.now() - o.at < ttl) return o;
      return null;
    } catch (e) { return null; }
  }
  function mark(text, needle) {
    var t = esc(text);
    if (!needle) return t;
    var i = t.toLowerCase().indexOf(needle.toLowerCase());
    if (i < 0) return t;
    return t.slice(0, i) + '<mark>' + t.slice(i, i + needle.length) + '</mark>' + t.slice(i + needle.length);
  }
  function fmtDate(d) {
    if (!d) return '';
    var p = d.split('-');
    return p.length === 3 ? (Number(p[1]) + '/' + Number(p[2])) : d;
  }

  /* ------------------------------------------------- 自動分類（新 repo 用） */
  function autoCat(name, desc) {
    var low = (name + ' ' + desc).toLowerCase();
    if (/math|數學|dse/.test(low)) return 'math';
    if (/中文|hanzi|chinese|dictation|默書|寫字/.test(low)) return 'lang';
    if (/小學|常識|科學|\bp[1-6]\b/.test(low)) return 'junior';
    if (/長者|記憶|靜心|mindful|bible|聖經|brain/.test(low)) return 'mind';
    if (/設計|design|vr|導覽|繪本|tour/.test(low)) return 'design';
    if (/優惠|投資|日誌|deals|daily|熱話|news|brief|netflix/.test(low)) return 'daily';
    if (/圖片|image|影片|video|作品/.test(low)) return 'media';
    if (/遊戲|game|3d|互動/.test(low)) return 'play';
    return 'tools';
  }

  /* ------------------------------------- 由 repo 檔案清單抽出「站內頁面」 */
  var SKIP_DIRS = ['node_modules/', 'vendor/', '_site/', 'assets/', 'images/', 'img/', 'cn/', 'docs/'];
  var DATE_DIRS = ['archive/', 'deals/', 'reports/', 'posts/', 'daily/'];
  var TOPIC = {
    percentages: '百分數', 'coordinate-geometry': '坐標幾何', equations: '方程',
    'estimation-approximation-error': '估算與誤差', 'formulas-sequences': '公式與數列',
    'functions-graphs': '函數與圖像', geometry: '幾何',
    'indices-exponential-logarithmic': '指數與對數',
    'inequalities-linear-programming': '不等式與線性規劃', mensuration: '度量',
    polynomials: '多項式', probability: '概率', 'rate-ratio-variations': '率、比與變分',
    statistics: '統計', trigonometry: '三角學'
  };

  function massGenerated(base) {
    return /^\d{4}_p\d_q\d+\.html$/i.test(base) ||
      /^\d{4}_mc_\d+\.html$/i.test(base) ||
      /^ex_t\d+_q\d+\.html$/i.test(base) ||
      /^demo.*\.html$/i.test(base) ||
      /_q\d+\.html$/i.test(base);
  }
  function prettyTitle(path) {
    var base = path.split('/').pop().replace(/\.(html|md)$/i, '');
    var m = base.match(/^dse_(.+)_50_questions$/i);
    if (m) return (TOPIC[m[1].toLowerCase()] || m[1]) + ' · 50 題精練';
    if (/^\d{4}-\d{2}-\d{2}/.test(base)) return base.slice(0, 10).replace(/-/g, '/');
    base = base.replace(/^dse_/i, '').replace(/_/g, ' ');
    return base;
  }
  function extractPages(paths) {
    var named = [], dated = [];
    paths.forEach(function (p) {
      var low = p.toLowerCase();
      for (var i = 0; i < SKIP_DIRS.length; i++) if (low.indexOf(SKIP_DIRS[i]) === 0) return;
      var base = low.split('/').pop();
      if (/\.html$/.test(low)) {
        if (base === 'index.html' || base === '404.html') return;
        if (massGenerated(base) || base.indexOf('.body.') !== -1) return;
        named.push({ t: prettyTitle(p), u: p });
      } else if (/\.md$/.test(low)) {
        var ok = false;
        for (var j = 0; j < DATE_DIRS.length; j++) if (low.indexOf(DATE_DIRS[j]) === 0) ok = true;
        if (!ok) return;
        dated.push({ t: prettyTitle(p), u: p.replace(/\.md$/i, '.html'), d: 1 });
      }
    });
    named.sort(function (a, b) { return a.u < b.u ? -1 : 1; });
    dated.sort(function (a, b) { return a.u < b.u ? 1 : -1; });
    return named.concat(dated);
  }

  /* ------------------------------------------------------------ 統計 */
  function totals() {
    var pages = 0;
    sites.forEach(function (s) { pages += s.pages.length; });
    return { sites: sites.length, pages: pages };
  }
  function paintTotals() {
    var t = totals();
    el.statSites.textContent = t.sites;
    el.statPages.textContent = t.pages;
    el.footSites.textContent = t.sites;
    el.footPages.textContent = t.pages;
  }
  function setSync(text, warn) {
    el.statSync.textContent = text;
    el.statLive.classList.toggle('warn', !!warn);
  }

  /* ------------------------------------------------------------ 篩選器 */
  function renderChips() {
    var counts = { all: sites.length };
    sites.forEach(function (s) { counts[s.cat] = (counts[s.cat] || 0) + 1; });
    var html = '<button class="chip" type="button" data-filter="all" aria-pressed="true">全部<span>' + sites.length + '</span></button>';
    ORDER.forEach(function (c) {
      if (!counts[c]) return;
      html += '<button class="chip" type="button" data-filter="' + c + '">' + esc(CATS[c].label.split(' · ')[0]) +
        '<span>' + counts[c] + '</span></button>';
    });
    el.chips.innerHTML = html;
  }

  /* ------------------------------------------------------------ 卡片 */
  function cardHTML(s) {
    var n = s.pages.length;
    var meta = [];
    if (n) meta.push('<span class="badge">' + n + ' 頁</span>');
    if (s._new) meta.push('<span class="badge new">新</span>');
    if (s.updated) meta.push('<span>更新 ' + esc(fmtDate(s.updated)) + '</span>');
    return '' +
      '<article class="card' + (expanded[s.name] ? ' open' : '') + '" data-name="' + esc(s.name) + '">' +
        '<a class="main" href="' + esc(siteUrl(s)) + '" target="_blank" rel="noopener">' +
          '<span class="tile"><svg><use href="#' + (CATS[s.cat] || CATS.tools).glyph + '"/></svg></span>' +
          '<span class="body">' +
            '<span class="title">' + mark(s.title, q) + '</span>' +
            '<span class="desc">' + mark(s.desc, q) + '</span>' +
            (meta.length ? '<span class="meta">' + meta.join('<span class="dot"></span>') + '</span>' : '') +
          '</span>' +
          '<svg class="arrow"><use href="#i-arrow"/></svg>' +
        '</a>' +
        (n || !s.pagesLoaded ? '<button class="pages-toggle" type="button">' +
          '<span class="pt-label">' + (n ? '展開站內頁面' : '載入頁面') + '</span>' +
          '<svg><use href="#i-chevron"/></svg></button>' : '') +
        '<ul class="pages"></ul>' +
      '</article>';
  }

  function renderAll() {
    var html = '';
    ORDER.forEach(function (cat) {
      var list = sites.filter(function (s) { return s.cat === cat; });
      if (!list.length) return;
      html += '<section data-cat="' + cat + '">' +
        '<div class="sec-head">' +
          '<span class="glyph"><svg><use href="#' + CATS[cat].glyph + '"/></svg></span>' +
          '<h2>' + esc(CATS[cat].label) + '</h2>' +
          '<span class="count">' + list.length + '</span>' +
          '<span class="rule"></span>' +
        '</div>' +
        '<div class="grid">' + list.map(cardHTML).join('') + '</div>' +
      '</section>';
    });
    el.sections.innerHTML = html;
    paintTotals();
    applyFilter();
  }

  /* 重畫單一卡片的頁面清單 */
  function paintPages(card, s, matches) {
    var ul = card.querySelector('.pages');
    if (!ul) return 0;
    var list = s.pages;
    if (matches) list = matches;
    var shown = list.slice(0, matches ? 40 : PAGE_LIMIT);
    var hidden = list.length - shown.length;
    var html = shown.map(function (p) {
      return '<li><a href="' + esc(link(s, p)) + '" target="_blank" rel="noopener">' +
        '<span class="pt">' + mark(p.t, q) + '</span>' +
        '<span class="p">' + esc(p.u) + '</span></a></li>';
    }).join('');
    if (hidden > 0) {
      html += '<li class="more-pages"><button type="button" data-more="' + esc(s.name) + '">還有 ' +
        hidden + ' 頁 · 顯示全部</button></li>';
    }
    ul.innerHTML = html;
    return shown.length;
  }

  /* ------------------------------------------------------------ 搜尋 */
  function applyFilter() {
    var needle = q;
    var shownSites = 0, shownPages = 0;
    var cards = el.sections.querySelectorAll('.card');
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var s = byName[card.getAttribute('data-name')];
      if (!s) continue;
      var catOk = activeCat === 'all' || s.cat === activeCat;
      var siteMatch = !needle || s._hay.indexOf(needle) !== -1;
      var hits = [];
      if (needle) {
        s.pages.forEach(function (p) { if (pageHay(p).indexOf(needle) !== -1) hits.push(p); });
      }
      var visible = catOk && (siteMatch || hits.length > 0);
      card.style.display = visible ? '' : 'none';
      if (!visible) continue;
      shownSites++;
      var open = needle ? hits.length > 0 : !!expanded[s.name];
      card.classList.toggle('open', open);
      if (open) shownPages += paintPages(card, s, needle && hits.length ? hits : null);
    }
    el.empty.style.display = shownSites ? 'none' : 'block';
    paintHint(shownSites, shownPages);
  }

  function paintHint(shownSites, shownPages) {
    if (!q) {
      el.hint.innerHTML = '搜尋會同時比對 repo 名稱、說明與站內每個頁面。';
      return;
    }
    if (!shownSites) {
      el.hint.innerHTML = '沒有符合「<b>' + esc(q) + '</b>」的網站或頁面。';
      return;
    }
    el.hint.innerHTML = shownPages
      ? '找到 <b>' + shownSites + '</b> 個網站 · <b>' + shownPages + '</b> 個頁面'
      : '找到 <b>' + shownSites + '</b> 個網站';
  }

  /* ------------------------------------------------- 事件：卡片展開／更多 */
  el.sections.addEventListener('click', function (e) {
    var more = e.target.closest('[data-more]');
    if (more) {
      var c = more.closest('.card');
      paintAllPages(c, byName[more.getAttribute('data-more')]);
      return;
    }
    var btn = e.target.closest('.pages-toggle');
    if (!btn) return;
    var card = btn.closest('.card');
    var s = byName[card.getAttribute('data-name')];
    if (!s) return;
    if (!s.pagesLoaded) {
      expanded[s.name] = true;
      btn.disabled = true;
      btn.querySelector('.pt-label').textContent = '載入中…';
      ensurePages(s).then(function () {
        btn.disabled = false;
        renderAll();
      });
      return;
    }
    var name = s.name;
    expanded[name] = !expanded[name];
    card.classList.toggle('open', expanded[name]);
    if (expanded[name]) paintPages(card, s, null);
  });

  function paintAllPages(card, s) {
    var ul = card.querySelector('.pages');
    ul.innerHTML = s.pages.map(function (p) {
      return '<li><a href="' + esc(link(s, p)) + '" target="_blank" rel="noopener">' +
        '<span class="pt">' + mark(p.t, q) + '</span>' +
        '<span class="p">' + esc(p.u) + '</span></a></li>';
    }).join('');
  }

  /* ------------------------------------------------- 自動載入 / 更新頁面清單 */
  function loadTree(s, force) {
    var cached = force ? null : read('tree:' + s.name, TREE_TTL);
    if (cached && cached.pages) {
      var before = JSON.stringify(s.pages);
      s.pages = cached.pages;
      s.pagesLoaded = true;
      return Promise.resolve(JSON.stringify(s.pages) !== before);
    }
    var url = 'https://api.github.com/repos/' + OWNER + '/' + s.name + '/git/trees/' +
      (s.branch || 'HEAD') + '?recursive=1';
    return fetch(url, { headers: { 'Accept': 'application/vnd.github+json' } })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) {
        var paths = (j.tree || []).filter(function (t) { return t.type === 'blob'; })
          .map(function (t) { return t.path; });
        var before = JSON.stringify(s.pages);
        s.pages = extractPages(paths);
        s.pagesLoaded = true;
        store('tree:' + s.name, { at: Date.now(), pages: s.pages });
        return JSON.stringify(s.pages) !== before;
      })
      .catch(function () { s.pagesLoaded = true; return false; });
  }

  function ensurePages(s) { return loadTree(s, false).then(function () { return s; }); }

  /* 每日累積的 repo（購物優惠、投資晚報、熱話）自動抓最新頁面 */
  function refreshDynamic() {
    var queue = sites.filter(function (s) { return s.dyn && s.pagesLoaded; });
    var changed = 0;
    var chain = Promise.resolve();
    queue.forEach(function (s) {
      chain = chain.then(function () {
        return loadTree(s, false).then(function (ch) { if (ch) changed++; });
      });
    });
    return chain.then(function () {
      if (changed) { renderAll(); }
      return changed;
    });
  }

  /* 每次開頁輪流檢查幾個 repo 有沒有新增頁面（維持自動更新，又不浪費 API 配額） */
  function refreshStale() {
    var out = [];
    sites.forEach(function (s) {
      if (s.dyn || !s.pagesLoaded || s.pages.length > 20) return;
      var raw = null;
      try { raw = JSON.parse(localStorage.getItem('tree:' + s.name) || 'null'); } catch (e) {}
      var at = raw && raw.at ? raw.at : 0;
      if (Date.now() - at > STALE_TTL) out.push({ s: s, at: at });
    });
    out.sort(function (a, b) { return a.at - b.at; });
    var queue = out.slice(0, STALE_PER_LOAD).map(function (o) { return o.s; });
    var changed = 0, chain = Promise.resolve();
    queue.forEach(function (s) {
      chain = chain.then(function () {
        return loadTree(s, true).then(function (ch) { if (ch) changed++; });
      });
    });
    return chain.then(function () {
      if (changed) {
        renderAll();
        setSync('已更新 ' + changed + ' 個網站的頁面');
      }
      return changed;
    });
  }

  /* ------------------------------------------------- GitHub 同步 */
  function minimal(list) {
    return list.filter(function (r) { return r.has_pages && !r.fork; })
      .map(function (r) {
        return {
          name: r.name, description: r.description || '',
          updated_at: (r.updated_at || '').slice(0, 10),
          default_branch: r.default_branch || 'main'
        };
      });
  }

  function applyLive(list) {
    var added = 0;
    list.forEach(function (r) {
      if (r.name === OWNER + '.github.io') return;
      if (byName[r.name]) return;
      var cat = autoCat(r.name, r.description || '');
      var s = {
        name: r.name,
        title: r.name.replace(/_/g, ' '),
        desc: r.description || (CATS[cat].label + ' 網站'),
        cat: cat,
        tags: [],
        updated: r.updated_at || '',
        url: r.name + '/',
        pages: [],
        pagesLoaded: false,
        branch: r.default_branch || 'main',
        _new: true
      };
      s._hay = siteHay(s);
      sites.push(s);
      byName[s.name] = s;
      added++;
    });
    if (added) {
      renderChips();
      renderAll();
    }
    return added;
  }

  function sync(force) {
    if (!window.fetch) { setSync('離線快照 · ' + (seed.generated_human || ''), true); return; }
    var cached = force ? null : read('portal-sync', SYNC_TTL);
    if (cached) {
      var n = applyLive(cached.list);
      setSync('已同步 GitHub' + (n ? ' · 新增 ' + n + ' 個' : ''));
      return;
    }
    el.syncBtn.classList.add('spin');
    setSync('同步 GitHub…');
    fetch('https://api.github.com/users/' + OWNER + '/repos?per_page=100&sort=updated&type=owner',
      { headers: { 'Accept': 'application/vnd.github+json' } })
      .then(function (r) {
        if (r.status === 403 || r.status === 429) throw new Error('quota');
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (list) {
        var m = minimal(list);
        store('portal-sync', { at: Date.now(), list: m });
        var n = applyLive(m);
        setSync('已同步 GitHub · ' + m.length + ' 個 repo' + (n ? '（新增 ' + n + '）' : ''));
      })
      .catch(function (err) {
        var old = read('portal-sync', 0);
        var msg = err && err.message === 'quota'
          ? 'GitHub 配額已滿 · 顯示快照'
          : '離線快照 · ' + (seed.generated_human || '');
        if (old) applyLive(old.list);
        setSync(msg, true);
        seed._stale = true;
      })
      .then(function () { el.syncBtn.classList.remove('spin'); });
  }

  /* ------------------------------------------------- 其他 UI */
  el.input.addEventListener('input', function () {
    clearTimeout(searchTimer);
    var v = el.input.value.trim().toLowerCase();
    searchTimer = setTimeout(function () { q = v; applyFilter(); }, 90);
  });

  el.chips.addEventListener('click', function (e) {
    var chip = e.target.closest('.chip');
    if (!chip) return;
    activeCat = chip.getAttribute('data-filter');
    Array.prototype.forEach.call(el.chips.children, function (c) {
      c.setAttribute('aria-pressed', String(c === chip));
    });
    applyFilter();
  });

  document.getElementById('reset').addEventListener('click', function () {
    el.input.value = '';
    q = '';
    activeCat = 'all';
    Array.prototype.forEach.call(el.chips.children, function (c) {
      c.setAttribute('aria-pressed', String(c.getAttribute('data-filter') === 'all'));
    });
    applyFilter();
    el.input.focus();
  });

  document.addEventListener('keydown', function (e) {
    var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if (e.key === '/' && !typing) { e.preventDefault(); el.input.focus(); }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault(); el.input.focus(); el.input.select();
    }
    if (e.key === 'Escape' && document.activeElement === el.input) {
      el.input.value = ''; q = ''; applyFilter();
    }
  });

  /* 深色模式 */
  var root = document.documentElement;
  var saved = null;
  try { saved = localStorage.getItem('theme'); } catch (e) {}
  var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  root.setAttribute('data-theme', saved || (prefersDark ? 'dark' : 'light'));
  document.getElementById('themeToggle').addEventListener('click', function () {
    var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) {}
  });

  /* 重新掃描 */
  el.syncBtn.addEventListener('click', function () {
    try { localStorage.removeItem('portal-sync'); } catch (e) {}
    sync(true);
  });

  window.addEventListener('scroll', function () {
    el.topbar.classList.toggle('stuck', window.scrollY > 8);
  }, { passive: true });

  /* ------------------------------------------------- 啟動 */
  renderChips();
  renderAll();
  sync(false);
  refreshDynamic();
  refreshStale();
})();
