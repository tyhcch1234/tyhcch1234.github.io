/* 學習與工具總覽 — 即時 repo 索引 + 站內頁面搜尋
 *
 * 資料來源（三層，全部以「實際存在的網站」為準）：
 *   1. sites.json     發佈時由 build_index.py 掃描 GitHub 產生，含每個網站的頁面清單
 *   2. index.html 內嵌的 seed（sites.json 讀不到時的離線備份）
 *   3. 開頁時向 GitHub API 核對 repo 清單，發佈後新開的 repo 會即時補上
 * 畫面上的「N 個網站」永遠等於下面真正列出的卡片數。
 */
(function () {
  'use strict';

  var OWNER = 'tyhcch1234';
  var ROOT_REPO = OWNER + '.github.io';
  var REPO_TTL = 5 * 60 * 1000;          // repo 清單快取 5 分鐘
  var TREE_TTL = 6 * 60 * 60 * 1000;     // 站內頁面清單快取 6 小時
  var DYN_PER_LOAD = 2;                  // 每次開頁最多更新 2 個每日累積網站

  var CATS = {
    math:   { label: '數學 · 文憑試與測驗', glyph: 'g-math' },
    lang:   { label: '中文 · 識字與書寫',   glyph: 'g-lang' },
    junior: { label: '小學 · 常識與科學',   glyph: 'g-flask' },
    mind:   { label: '身心 · 益智 · 記憶',  glyph: 'g-mind' },
    design: { label: '設計 · 繪本 · 導覽',  glyph: 'g-cube' },
    daily:  { label: '每日日誌 · 自動累積', glyph: 'g-cal' },
    media:  { label: '作品庫 · 圖文影音',   glyph: 'g-media' },
    play:   { label: '遊戲 · 互動教學',     glyph: 'g-play' },
    tools:  { label: '工具 · 應用',         glyph: 'g-file' }
  };
  var ORDER = ['math', 'lang', 'junior', 'mind', 'design', 'daily', 'media', 'play', 'tools'];

  var seed = JSON.parse(document.getElementById('seed').textContent);

  var state = {
    sites: [],
    meta: { generated: seed.generated || '', generated_human: seed.generated_human || '' },
    quotaHit: false
  };

  var byName = Object.create(null);
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
    footStamp: document.getElementById('footStamp'),
    syncBtn: document.getElementById('syncBtn'),
    topbar: document.getElementById('topbar')
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
  function pageHay(p) { return ((p.t || '') + ' ' + p.u).toLowerCase(); }
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
  function fmtStamp(human) { return human || '未提供'; }

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
    state.sites.forEach(function (s) { pages += s.pages.length; });
    return { sites: state.sites.length, pages: pages };
  }
  function paintTotals() {
    var t = totals();
    el.statSites.textContent = t.sites;
    el.statPages.textContent = t.pages;
    el.footSites.textContent = t.sites;
    el.footPages.textContent = t.pages;
    if (el.footStamp) el.footStamp.textContent = fmtStamp(state.meta.generated_human);
  }
  function setSync(text, warn) {
    el.statSync.textContent = text;
    el.statLive.classList.toggle('warn', !!warn);
  }

  /* ------------------------------------------------------------ 篩選器 */
  function renderChips() {
    var counts = { all: state.sites.length };
    state.sites.forEach(function (s) { counts[s.cat] = (counts[s.cat] || 0) + 1; });
    var html = '<button class="chip" type="button" data-filter="all" aria-pressed="' +
      (activeCat === 'all') + '">全部<span>' + state.sites.length + '</span></button>';
    ORDER.forEach(function (c) {
      if (!counts[c]) return;
      html += '<button class="chip" type="button" data-filter="' + c + '" aria-pressed="' +
        (activeCat === c) + '">' + esc(CATS[c].label.split(' · ')[0]) +
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
        (n ? '<button class="pages-toggle" type="button">' +
          '<span class="pt-label">站內 ' + n + ' 個頁面</span>' +
          '<svg><use href="#i-chevron"/></svg></button>' : '') +
        '<ul class="pages"></ul>' +
      '</article>';
  }

  function renderAll() {
    var html = '';
    ORDER.forEach(function (cat) {
      var list = state.sites.filter(function (s) { return s.cat === cat; });
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

  /* 顯示全部頁面（不設上限） */
  function paintPages(card, s, matches) {
    var ul = card.querySelector('.pages');
    if (!ul) return 0;
    var list = matches || s.pages;
    ul.innerHTML = list.map(function (p) {
      return '<li><a href="' + esc(link(s, p)) + '" target="_blank" rel="noopener">' +
        '<span class="pt">' + mark(p.t, q) + '</span>' +
        '<span class="p">' + esc(p.u) + '</span></a></li>';
    }).join('');
    return list.length;
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

  /* ------------------------------------------------- 事件：卡片展開 */
  el.sections.addEventListener('click', function (e) {
    var btn = e.target.closest('.pages-toggle');
    if (!btn) return;
    var card = btn.closest('.card');
    var s = byName[card.getAttribute('data-name')];
    if (!s) return;
    expanded[s.name] = !expanded[s.name];
    card.classList.toggle('open', expanded[s.name]);
    if (expanded[s.name]) paintPages(card, s, null);
  });

  /* ------------------------------------------- 套用一份完整網站清單 */
  function normalize(list) {
    return list.map(function (s) {
      s.pages = s.pages || [];
      if (s._new === undefined) s._new = false;
      s._hay = siteHay(s);
      return s;
    });
  }
  function setSites(list, meta) {
    state.sites = normalize(list);
    byName = Object.create(null);
    state.sites.forEach(function (s) { byName[s.name] = s; });
    if (meta) state.meta = meta;
    renderChips();
    renderAll();
  }

  function signature(s) {
    return [s.name, s.cat, s.title, s.updated, (s.pages || []).length, s.dyn ? 1 : 0].join('|');
  }

  /* ------------------------------------------- 1. 發佈時的完整清單 */
  function loadManifest(force) {
    if (!window.fetch) return Promise.resolve(false);
    if (!force && state.meta.generated && read('manifest:skip', 60 * 1000)) return Promise.resolve(false);
    return fetch('sites.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) {
        if (!j || !Array.isArray(j.sites) || !j.sites.length) return false;
        if (j.generated && state.meta.generated && j.generated < state.meta.generated) return false;
        var before = state.sites.map(signature).join('\n');
        var after = j.sites.map(signature).join('\n');
        setSites(j.sites, { generated: j.generated || '', generated_human: j.generated_human || '' });
        store('manifest:skip', { at: Date.now() });
        return before !== after;
      })
      .catch(function () { return false; });
  }

  /* ------------------------------------------- 2. 即時核對 repo 清單 */
  function repoList(force) {
    var cached = force ? null : read('repos:list', REPO_TTL);
    if (cached && Array.isArray(cached.list)) return Promise.resolve(cached.list);
    return fetch('https://api.github.com/users/' + OWNER +
      '/repos?per_page=100&sort=updated&type=owner',
      { headers: { 'Accept': 'application/vnd.github+json' }, cache: 'no-store' })
      .then(function (r) {
        if (r.status === 403 || r.status === 429) { state.quotaHit = true; throw new Error('quota'); }
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (list) {
        if (!Array.isArray(list)) throw new Error('bad payload');
        store('repos:list', { at: Date.now(), list: list });
        return list;
      });
  }

  /* 檢查一個 repo 是否真的有網站（有根目錄 index.html 或已啟用 Pages） */
  function probeRepo(name, branch, hasPages) {
    var url = 'https://api.github.com/repos/' + OWNER + '/' + encodeURIComponent(name) +
      '/git/trees/' + encodeURIComponent(branch || 'main') + '?recursive=1';
    return fetch(url, { headers: { 'Accept': 'application/vnd.github+json' }, cache: 'no-store' })
      .then(function (r) {
        if (r.status === 403 || r.status === 429) { state.quotaHit = true; return null; }
        if (!r.ok) return null;
        return r.json();
      })
      .then(function (j) {
        if (!j) return null;
        var paths = (j.tree || []).filter(function (t) { return t.type === 'blob'; })
          .map(function (t) { return t.path; });
        var hasRootIndex = paths.some(function (p) { return p.toLowerCase() === 'index.html'; });
        if (!hasPages && !hasRootIndex) return null;
        var pages = extractPages(paths);
        store('tree:' + name, { at: Date.now(), pages: pages });
        return pages;
      })
      .catch(function () { return null; });
  }

  function addSite(r, pages) {
    if (byName[r.name]) return false;
    var cat = autoCat(r.name, r.description || '');
    var s = {
      name: r.name,
      title: r.name.replace(/_/g, ' '),
      desc: r.description || (CATS[cat].label + ' 網站'),
      cat: cat,
      tags: [],
      updated: (r.updated_at || '').slice(0, 10),
      url: r.name + '/',
      pages: pages || [],
      virtual: false,
      _new: true
    };
    s._hay = siteHay(s);
    state.sites.push(s);
    byName[s.name] = s;
    return true;
  }

  function liveCheck(force) {
    if (!window.fetch) { setSync('離線 · 本地清單', true); return Promise.resolve(0); }
    return repoList(force).then(function (list) {
      var repos = list.filter(function (r) {
        return r.name !== ROOT_REPO && !r.fork && !r.archived && !r.private;
      });
      var alive = Object.create(null);
      repos.forEach(function (r) { alive[r.name] = 1; });

      /* 已刪除／改名的 repo 一併移除，令數字與 GitHub 一致 */
      var gone = 0;
      if (repos.length >= 5) {
        state.sites = state.sites.filter(function (s) {
          if (s.virtual || alive[s.name]) return true;
          gone++;
          return false;
        });
      }

      var fresh = repos.filter(function (r) { return !byName[r.name]; })
        .slice(0, 8);                       // 一次最多補 8 個，避免用盡 API 配額
      var added = 0;
      var chain = Promise.resolve();
      fresh.forEach(function (r) {
        chain = chain.then(function () {
          if (state.quotaHit) return;
          return probeRepo(r.name, r.default_branch, r.has_pages).then(function (pages) {
            if (pages && addSite(r, pages)) added++;
          });
        });
      });
      return chain.then(function () {
        if (added || gone) setSites(state.sites, null);
        else paintTotals();
        var note = [];
        if (added) note.push('新增 ' + added + ' 個');
        if (gone) note.push('移除 ' + gone + ' 個');
        setSync('已即時檢查 GitHub' + (note.length ? ' · ' + note.join(' · ') : ''),
          !!state.quotaHit);
        return added;
      });
    }).catch(function (err) {
      var quota = err && err.message === 'quota';
      setSync(quota ? 'GitHub 用量上限 · 顯示完整清單' : '未能連線 GitHub · 顯示完整清單', true);
      return 0;
    });
  }

  /* ------------------------------------ 3. 每日累積網站：補上新增頁面 */
  function refreshDynamic(limit) {
    if (state.quotaHit || !window.fetch) return Promise.resolve(0);
    var queue = state.sites.filter(function (s) { return s.dyn && !s.virtual; })
      .map(function (s) {
        var raw = null;
        try { raw = JSON.parse(localStorage.getItem('tree:' + s.name) || 'null'); } catch (e) {}
        return { s: s, at: raw && raw.at ? raw.at : 0 };
      })
      .filter(function (o) { return Date.now() - o.at > TREE_TTL; })
      .sort(function (a, b) { return a.at - b.at; })
      .slice(0, limit);
    if (!queue.length) return Promise.resolve(0);
    var changed = 0, chain = Promise.resolve();
    queue.forEach(function (o) {
      chain = chain.then(function () {
        if (state.quotaHit) return;
        var url = 'https://api.github.com/repos/' + OWNER + '/' + encodeURIComponent(o.s.name) +
          '/git/trees/' + encodeURIComponent(o.s.branch || 'main') + '?recursive=1';
        return fetch(url, { headers: { 'Accept': 'application/vnd.github+json' }, cache: 'no-store' })
          .then(function (r) {
            if (r.status === 403 || r.status === 429) { state.quotaHit = true; return null; }
            if (!r.ok) return null;
            return r.json();
          })
          .then(function (j) {
            if (!j) return;
            var paths = (j.tree || []).filter(function (t) { return t.type === 'blob'; })
              .map(function (t) { return t.path; });
            var pages = extractPages(paths);
            store('tree:' + o.s.name, { at: Date.now(), pages: pages });
            if (JSON.stringify(pages) !== JSON.stringify(o.s.pages)) {
              o.s.pages = pages;
              o.s._hay = siteHay(o.s);
              changed++;
            }
          })
          .catch(function () {});
      });
    });
    return chain.then(function () {
      if (changed) setSites(state.sites, null);
      return changed;
    });
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

  /* 重新掃描：重讀 sites.json + 即時核對 GitHub + 更新累積頁面 */
  el.syncBtn.addEventListener('click', function () {
    if (el.syncBtn.classList.contains('spin')) return;
    el.syncBtn.classList.add('spin');
    setSync('重新掃描 GitHub…');
    loadManifest(true)
      .then(function () { return liveCheck(true); })
      .then(function () { return refreshDynamic(6); })
      .then(function () {
        el.syncBtn.classList.remove('spin');
        setSync('已重新掃描 · ' + state.sites.length + ' 個網站',
          !!state.quotaHit);
      })
      .catch(function () {
        el.syncBtn.classList.remove('spin');
        setSync('未能完成掃描 · 請稍後再試', true);
      });
  });

  window.addEventListener('scroll', function () {
    el.topbar.classList.toggle('stuck', window.scrollY > 8);
  }, { passive: true });

  /* ------------------------------------------------- 啟動 */
  setSites(seed.sites, { generated: seed.generated || '', generated_human: seed.generated_human || '' });
  setSync('讀取中…');

  loadManifest(false)
    .then(function () { return liveCheck(false); })
    .then(function () { return refreshDynamic(DYN_PER_LOAD); })
    .catch(function () {});
})();
