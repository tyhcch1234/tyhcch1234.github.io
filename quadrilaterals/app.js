/* 四邊形家族圖鑑 — 圖形繪製與互動 */
(function () {
  'use strict';

  var PAR = '#2563eb', EQ = '#e11d48', RIGHT = '#059669', DIAG = '#f59e0b';
  var STROKE = '#334155';

  /* ---------- 幾何小工具 ---------- */
  function sub(p, q) { return [q[0] - p[0], q[1] - p[1]]; }
  function unit(p, q) { var d = sub(p, q), L = Math.hypot(d[0], d[1]) || 1; return [d[0] / L, d[1] / L]; }
  function move(p, d, k) { return [p[0] + d[0] * k, p[1] + d[1] * k]; }
  function mid(p, q) { return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; }
  function nrm(d) { return [-d[1], d[0]]; }
  function f(n) { return Math.round(n * 10) / 10; }

  /* 平行箭咀 */
  function chevron(m, d, n) {
    var tip = move(m, d, 4), back = move(m, d, -4);
    var a = move(back, n, 5.2), b = move(back, n, -5.2);
    return '<path d="M' + f(a[0]) + ' ' + f(a[1]) + 'L' + f(tip[0]) + ' ' + f(tip[1]) +
      'L' + f(b[0]) + ' ' + f(b[1]) + '" fill="none" stroke="' + PAR + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
  }
  /* 等長短劃：沿邊方向排開，每劃橫跨條邊 */
  function ticks(m, d, n, count) {
    var out = '', offs = count === 1 ? [0] : [-4.5, 4.5];
    offs.forEach(function (o) {
      var c = move(m, d, o);
      var a = move(c, n, -5.5), b = move(c, n, 5.5);
      out += '<line x1="' + f(a[0]) + '" y1="' + f(a[1]) + '" x2="' + f(b[0]) + '" y2="' + f(b[1]) +
        '" stroke="' + EQ + '" stroke-width="2" stroke-linecap="round"/>';
    });
    return out;
  }
  /* 直角記號 */
  function rightAngle(v, a, b) {
    var u = unit(v, a), w = unit(v, b), s = 13;
    var p1 = move(v, u, s), p2 = move(p1, w, s), p3 = move(v, w, s);
    return '<path d="M' + f(p1[0]) + ' ' + f(p1[1]) + 'L' + f(p2[0]) + ' ' + f(p2[1]) +
      'L' + f(p3[0]) + ' ' + f(p3[1]) + '" fill="none" stroke="' + RIGHT + '" stroke-width="2"/>';
  }

  /* ---------- 各圖形頂點 ---------- */
  var V = {
    trap:    [[38, 172], [102, 56], [200, 56], [296, 172]],
    iso:     [[52, 172], [104, 56], [216, 56], [268, 172]],
    para:    [[46, 172], [106, 50], [262, 50], [202, 172]],
    rect:    [[58, 62], [262, 62], [262, 168], [58, 168]],
    rhombus: [[160, 42], [262, 112], [160, 182], [58, 112]],
    square:  [[86, 44], [238, 44], [238, 196], [86, 196]],
    kite:    [[160, 28], [250, 110], [160, 196], [70, 110]],
    irr:     [[48, 172], [104, 46], [272, 88], [236, 194]]
  };

  /* 每邊：par=平行箭咀數（0/1/2）、eq=等長短劃數 */
  var MARK = {
    trap:   { par: [0, 1, 0, 1], eq: [0, 0, 0, 0], right: [] },
    iso:    { par: [0, 1, 0, 1], eq: [1, 0, 1, 0], right: [] },
    para:   { par: [1, 2, 1, 2], eq: [1, 2, 1, 2], right: [] },
    rect:   { par: [1, 2, 1, 2], eq: [1, 2, 1, 2], right: [0, 1] },
    rhombus:{ par: [1, 2, 1, 2], eq: [1, 1, 1, 1], right: [] },
    square: { par: [1, 2, 1, 2], eq: [1, 1, 1, 1], right: [0, 1] },
    kite:   { par: [0, 0, 0, 0], eq: [1, 2, 2, 1], right: [] },
    irr:    { par: [0, 0, 0, 0], eq: [0, 0, 0, 0], right: [] }
  };

  var FILL = {
    trap: '#fff4e6', iso: '#fff4e6', para: '#eef2ff', rect: '#e8f6ff',
    rhombus: '#f4ecff', square: '#e9f9ef', kite: '#ffeef4', irr: '#f1f3f9'
  };

  /* 畫一個圖形：
     opts.diag     畫對角線（虛線）
     opts.bisect   對角線交點加圓點（互相平分）
     opts.perp     對角線交點加直角記號（互相垂直）
     opts.size     額外參數（預留） */
  function shapeSVG(id, opts) {
    opts = opts || {};
    var v = V[id], mk = MARK[id], out = '';
    var pts = v.map(function (p) { return p.join(','); }).join(' ');

    out += '<polygon points="' + pts + '" fill="' + (FILL[id] || '#eef2ff') +
      '" stroke="' + STROKE + '" stroke-width="2.6" stroke-linejoin="round"/>';

    /* 對角線（畫在邊之下、標記之上） */
    if (opts.diag) {
      out += '<line x1="' + v[0][0] + '" y1="' + v[0][1] + '" x2="' + v[2][0] + '" y2="' + v[2][1] +
        '" stroke="' + DIAG + '" stroke-width="2" stroke-dasharray="7 5" opacity=".95"/>';
      out += '<line x1="' + v[1][0] + '" y1="' + v[1][1] + '" x2="' + v[3][0] + '" y2="' + v[3][1] +
        '" stroke="' + DIAG + '" stroke-width="2" stroke-dasharray="7 5" opacity=".95"/>';
    }

    /* 邊上標記：箭咀擺中間，短劃擺前段，兩者唔會疊 */
    for (var i = 0; i < 4; i++) {
      var a = v[i], b = v[(i + 1) % 4], m = mid(a, b), d = unit(a, b), n = nrm(d);
      var L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (mk.par[i] === 1) out += chevron(m, d, n);
      if (mk.par[i] === 2) { out += chevron(move(m, d, -7), d, n) + chevron(move(m, d, 7), d, n); }
      if (mk.eq[i]) out += ticks(move(a, d, L * 0.3), d, n, mk.eq[i]);
    }

    /* 直角 */
    mk.right.forEach(function (k) {
      out += rightAngle(v[k], v[(k + 3) % 4], v[(k + 1) % 4]);
    });

    /* 對角線交點 */
    if (opts.diag && (opts.bisect || opts.perp)) {
      var c = [(v[0][0] + v[2][0]) / 2, (v[0][1] + v[2][1]) / 2];
      out += '<circle cx="' + f(c[0]) + '" cy="' + f(c[1]) + '" r="4" fill="' + DIAG + '"/>';
      if (opts.perp) {
        var d1 = unit(v[0], v[2]), d2 = unit(v[1], v[3]);
        var p1 = move(c, d1, 12), p2 = move(move(c, d1, 12), d2, 12), p3 = move(c, d2, 12);
        out += '<path d="M' + f(p1[0]) + ' ' + f(p1[1]) + 'L' + f(p2[0]) + ' ' + f(p2[1]) +
          'L' + f(p3[0]) + ' ' + f(p3[1]) + '" fill="none" stroke="' + RIGHT + '" stroke-width="2"/>';
      }
    }
    return '<svg viewBox="0 0 320 224" role="img" aria-label="' + id + '">' + out + '</svg>';
  }

  /* ---------- 圖形資料 ---------- */
  var SHAPES = [
    {
      id: 'trap', name: '梯形', en: 'Trapezium', accent: '#d97706',
      def: '只有一組對邊平行。平行嗰組叫「底」（上底、下底），另外兩條叫「腰」。',
      yes: ['兩底平行', '同一條腰上嘅兩個內角互補（加埋 180°）', '面積 = (上底＋下底) × 高 ÷ 2'],
      no: ['兩腰唔一定相等（等腰梯形先等）', '對角唔一定相等', '對角線唔一定相等，亦唔會互相平分']
    },
    {
      id: 'iso', name: '等腰梯形', en: 'Isosceles trapezium', accent: '#d97706',
      def: '兩條腰相等嘅梯形。',
      yes: ['兩腰相等', '同一底上嘅兩個底角相等', '兩條對角線相等', '有 1 條對稱軸'],
      no: ['對角唔相等（對角係互補）', '對角線唔會互相平分', '唔會係平行四邊形']
    },
    {
      id: 'para', name: '平行四邊形', en: 'Parallelogram', accent: '#4338ca',
      def: '兩組對邊分別平行。',
      yes: ['對邊平行且相等', '對角相等', '鄰角互補', '對角線互相平分', '面積 = 底 × 高'],
      no: ['四邊唔一定相等', '唔一定有直角', '對角線唔一定相等', '對角線唔一定垂直']
    },
    {
      id: 'rect', name: '長方形', en: 'Rectangle', accent: '#0284c7',
      def: '有一個直角嘅平行四邊形（一有直角，四個都係直角）。',
      yes: ['四個角都係 90°', '對邊平行且相等', '對角線相等且互相平分', '有 2 條對稱軸', '面積 = 長 × 闊'],
      no: ['四邊唔一定相等', '對角線唔一定垂直（除非係正方形）']
    },
    {
      id: 'rhombus', name: '菱形', en: 'Rhombus', accent: '#7c3aed',
      def: '四條邊都相等嘅平行四邊形。',
      yes: ['四邊相等', '對角線互相垂直', '每條對角線平分一組對角', '對角相等', '有 2 條對稱軸（沿對角線）'],
      no: ['唔一定有直角', '對角線唔一定相等']
    },
    {
      id: 'square', name: '正方形', en: 'Square', accent: '#15803d',
      def: '四邊相等兼四個直角——即係長方形同菱形嘅交集。',
      yes: ['四邊相等、四角 90°', '對角線相等、垂直、互相平分', '對角線平分頂角（45°）', '有 4 條對稱軸', '旋轉 90° 都一樣', '上面每一項都一定成立，冇例外'],
      no: []
    },
    {
      id: 'kite', name: '箏形', en: 'Kite', accent: '#be185d',
      def: '兩對相鄰邊分別相等（好似一隻風箏）。',
      yes: ['一條對角線垂直平分另一條', '一組對角相等', '有一條對角線平分頂角', '有 1 條對稱軸'],
      no: ['對邊唔平行（一般情況）', '對邊唔相等', '對角線唔會互相平分']
    }
  ];

  /* ---------- ① 條件鏈 ---------- */
  var CHAIN = [
    { id: null, name: '四邊形', add: '起點', desc: '四條直邊圍成，內角和 360°。', fig: 'irr' },
    { id: 'trap', name: '梯形', add: '+ 一組對邊平行', desc: '加一個條件：其中一組對邊平行，另一組唔平行。', fig: 'trap' },
    { id: 'para', name: '平行四邊形', add: '+ 另一組都平行', desc: '兩組對邊都平行。對邊、對角隨即自動相等，對角線亦會互相平分。', fig: 'para' },
    { id: 'branch', name: '', add: '', desc: '', fig: null },
    { id: 'square', name: '正方形', add: '＋ 兩邊條件同時成立', desc: '四邊相等（菱形）＋ 四個直角（長方形）。條件最嚴，所以性質最多。', fig: 'square' }
  ];

  function renderChain() {
    var box = document.getElementById('chainBox');
    var html = '';
    function stepHTML(s) {
      return '<div class="step">' +
        '<div class="fig">' + shapeSVG(s.fig, { diag: false }) + '</div>' +
        '<div><h3>' + s.name + ' <span class="add">' + s.add + '</span></h3>' +
        '<small>' + s.desc + '</small></div></div>';
    }
    html += stepHTML(CHAIN[0]);
    html += '<div class="arrow">↓</div>' + stepHTML(CHAIN[1]);
    html += '<div class="arrow">↓</div>' + stepHTML(CHAIN[2]);
    html += '<div class="arrow">↓</div>';
    html += '<div class="branchlabel">以下兩條路都可以，行到同一個終點</div>';
    html += '<div class="branch">' +
      '<div class="step"><div class="fig">' + shapeSVG('rect', { diag: false }) + '</div>' +
      '<div><h3>長方形 <span class="add">+ 一個直角</span></h3><small>平行四邊形再加「有直角」，四個角就全部變 90°，對角線亦變相等。</small></div></div>' +
      '<div class="step"><div class="fig">' + shapeSVG('rhombus', { diag: false }) + '</div>' +
      '<div><h3>菱形 <span class="add">+ 四邊相等</span></h3><small>平行四邊形再加「四邊相等」，對角線就變互相垂直。</small></div></div>' +
      '</div>';
    html += '<div class="arrow">↓</div>' + stepHTML(CHAIN[4]);
    box.innerHTML = html;
  }

  /* ---------- ③ 圖形卡 ---------- */
  var DIAG_OPTS = {
    trap: { diag: true }, iso: { diag: true }, para: { diag: true, bisect: true },
    rect: { diag: true, bisect: true }, rhombus: { diag: true, bisect: true, perp: true },
    square: { diag: true, bisect: true, perp: true }, kite: { diag: true, perp: true }
  };

  function renderShapes() {
    var g = document.getElementById('shapeGrid'), html = '';
    SHAPES.forEach(function (s) {
      html += '<div class="scard">' +
        '<div class="top"><h3 style="color:' + s.accent + '">' + s.name + '</h3>' +
        '<span class="en">' + s.en + '</span></div>' +
        '<p class="def">' + s.def + '</p>' +
        shapeSVG(s.id, DIAG_OPTS[s.id]) +
        '<ul>' + s.yes.map(function (t) { return '<li class="yes">✓ ' + t + '</li>'; }).join('') +
        s.no.map(function (t) { return '<li class="no">✗ ' + t + '</li>'; }).join('') +
        '</ul></div>';
    });
    g.innerHTML = html;
  }

  /* ---------- ④ 對照表 ---------- */
  var COLS = [
    '兩組對邊<br>平行', '對邊相等', '對角相等', '鄰角互補', '四邊相等', '四個直角',
    '對角線<br>互相平分', '對角線<br>相等', '對角線<br>互相垂直', '對角線<br>平分頂角', '對稱軸', '旋轉對稱'
  ];
  var ROWS = [
    { n: '梯形', v: [false, false, false, true, false, false, false, false, false, false, '0', '1'] },
    { n: '等腰梯形', v: [false, 'q', false, true, false, false, false, true, false, false, '1', '1'] },
    { n: '平行四邊形', v: [true, true, true, true, false, false, true, false, false, false, '0', '2'] },
    { n: '長方形', v: [true, true, true, true, false, true, true, true, false, false, '2', '2'] },
    { n: '菱形', v: [true, true, true, true, true, false, true, false, true, true, '2', '2'] },
    { n: '正方形', v: [true, true, true, true, true, true, true, true, true, true, '4', '4'] },
    { n: '箏形', v: [false, false, 'q', false, false, false, 'q', false, true, 'q', '1', '1'] }
  ];

  function cell(v, colIdx) {
    if (v === true) return '<td class="y" title="一定成立">✓</td>';
    if (v === false) return '<td class="n" title="唔一定成立">✗</td>';
    if (v === 'q') {
      var t = colIdx === 1 ? '要等腰梯形先有' : colIdx === 6 ? '只平分其中一條' : colIdx === 9 ? '只平分其中一組' : '要額外條件';
      return '<td class="q" title="' + t + '">△</td>';
    }
    return '<td>' + v + '</td>';
  }

  function renderMatrix() {
    var t = document.getElementById('matrixTable');
    var head = '<tr><th>圖形</th>' + COLS.map(function (c) { return '<th>' + c + '</th>'; }).join('') + '</tr>';
    t.querySelector('thead').innerHTML = head;
    var body = ROWS.map(function (r) {
      return '<tr><th>' + r.n + '</th>' + r.v.map(function (v, i) { return cell(v, i); }).join('') + '</tr>';
    }).join('');
    t.querySelector('tbody').innerHTML = body;
  }

  /* ---------- ⑤ 判斷流程 ---------- */
  var FLOW = {
    start: { s: '兩組對邊平行', q: '呢個四邊形，兩組對邊係唔係都分別平行？', o: [['係', 'q2'], ['唔係', 'q3']] },
    q2: { s: '四個直角', q: '四個內角係唔係都係直角（90°）？', o: [['係', 'q4'], ['唔係', 'q5']] },
    q3: { s: '只有一組平行', q: '係唔係「只有」一組對邊平行？', o: [['係', 'q6'], ['唔係', 'q7']] },
    q4: { s: '四邊相等', q: '四條邊係唔係都一樣長？', o: [['係', 'r_square'], ['唔係', 'r_rect']] },
    q5: { s: '四邊相等', q: '四條邊係唔係都一樣長？', o: [['係', 'r_rhombus'], ['唔係', 'r_para']] },
    q6: { s: '兩腰相等', q: '兩條腰（唔平行嗰兩邊）係唔係一樣長？', o: [['係', 'r_iso'], ['唔係', 'r_trap']] },
    q7: { s: '兩對相鄰邊相等', q: '有冇兩對相鄰邊分別相等（一左一右對稱）？', o: [['有', 'r_kite'], ['冇', 'r_none']] }
  };

  var RESULT = {
    r_square: { id: 'square', t: '正方形', d: '兩組對邊平行 ＋ 四邊相等 ＋ 四個直角。家族裡面條件最嚴、性質最多嘅一個。', chips: ['對角線相等・垂直・互相平分', '4 條對稱軸'] },
    r_rect: { id: 'rect', t: '長方形', d: '兩組對邊平行 ＋ 四個直角，但四邊唔全部相等。', chips: ['對角線相等且互相平分', '2 條對稱軸'] },
    r_rhombus: { id: 'rhombus', t: '菱形', d: '兩組對邊平行 ＋ 四邊相等，但冇直角。', chips: ['對角線互相垂直', '2 條對稱軸'] },
    r_para: { id: 'para', t: '平行四邊形', d: '兩組對邊平行，但四邊唔全等、亦冇直角。', chips: ['對角線只會互相平分', '0 條對稱軸'] },
    r_iso: { id: 'iso', t: '等腰梯形', d: '只有一組對邊平行，而兩條腰相等。', chips: ['對角線相等', '1 條對稱軸'] },
    r_trap: { id: 'trap', t: '梯形', d: '只有一組對邊平行，兩條腰唔相等。', chips: ['同一腰上兩角互補', '對角線唔會互相平分'] },
    r_kite: { id: 'kite', t: '箏形', d: '冇對邊平行，但有兩對相鄰邊分別相等。', chips: ['對角線垂直', '1 條對稱軸'] },
    r_none: { id: 'irr', t: '不規則四邊形', d: '以上條件都唔符合——就係一個普通四邊形。內角和一樣係 360°。', chips: ['冇特別性質'] }
  };

  var flowState = { node: 'start', path: [] };

  function renderFlow() {
    var body = document.getElementById('flowBody');
    var crumbs = document.getElementById('crumbs');
    crumbs.innerHTML = flowState.path.map(function (t) { return '<span>' + t + '</span>'; }).join('');

    if (FLOW[flowState.node]) {
      var n = FLOW[flowState.node];
      body.innerHTML = '<div class="qtext">' + n.q + '</div><div class="btnrow">' +
        n.o.map(function (o, i) {
          return '<button class="btn ' + (i === 0 ? 'primary' : '') + '" data-go="' + o[1] + '" data-label="' + n.s + '：' + o[0] + '">' + o[0] + '</button>';
        }).join('') +
        (flowState.path.length ? '<button class="btn ghost" data-go="start" data-label="">重新開始</button>' : '') +
        '</div>';
      return;
    }

    var r = RESULT[flowState.node];
    body.innerHTML = '<div class="result">' +
      shapeSVG(r.id, DIAG_OPTS[r.id]) +
      '<div><h4>' + r.t + '</h4><p>' + r.d + '</p><div class="chips">' +
      r.chips.map(function (c) { return '<b>' + c + '</b>'; }).join('') + '</div></div></div>' +
      '<div class="btnrow" style="margin-top:14px"><button class="btn" data-go="start" data-label="">再試另一個</button></div>';
  }

  document.getElementById('flowBody').addEventListener('click', function (e) {
    var b = e.target.closest('[data-go]');
    if (!b) return;
    var go = b.getAttribute('data-go');
    if (go === 'start') { flowState = { node: 'start', path: [] }; }
    else { flowState.path.push(b.getAttribute('data-label')); flowState.node = go; }
    renderFlow();
  });

  /* ---------- ⑥ 易錯位 ---------- */
  var MYTHS = [
    { ok: false, q: '「正方形唔係長方形，佢係另一種圖形。」', a: '錯。正方形符合長方形嘅全部條件（四個直角、對邊平行且相等），只係多咗「四邊相等」。所以正方形係長方形嘅一種，好似「正方形係特別嘅長方形」。' },
    { ok: false, q: '「平行四邊形嘅兩條對角線一定一樣長。」', a: '錯。一般平行四邊形嘅對角線長度唔同，只會互相平分。對角線相等要有直角（長方形、正方形）或者等腰（等腰梯形）。' },
    { ok: false, q: '「菱形嘅對角線會相等。」', a: '錯。菱形嘅對角線互相垂直、互相平分，但長度通常唔同；要兩條都相等，就要係正方形。' },
    { ok: true, q: '「平行四邊形嘅對角線會互相平分。」', a: '對。兩條對角線嘅交點就係各自嘅中點，所以四條小線段兩兩相等。呢個性質由「兩組對邊平行」直接推出。' },
    { ok: false, q: '「四條邊相等，就一定是正方形。」', a: '錯。四邊相等只能肯定是菱形；要有埋直角（或對角線相等）才升級做正方形。' },
    { ok: false, q: '「長方形同正方形一樣，都有 4 條對稱軸。」', a: '錯。長方形只有 2 條（穿過對邊中點），正方形才有 4 條（2 條穿對邊中點＋2 條沿對角線）。' }
  ];

  function renderMyths() {
    document.getElementById('mythsBox').innerHTML = MYTHS.map(function (m) {
      return '<div class="myth"><div class="q"><span class="badge ' + (m.ok ? 'ok' : 'no') + '">' +
        (m.ok ? '正確' : '錯誤') + '</span>' + m.q + '</div><div class="a">' + m.a + '</div></div>';
    }).join('');
  }

  /* ---------- ⑦ 面積互動 ---------- */
  function drawTrap() {
    var a = +document.getElementById('sa').value;
    var b = +document.getElementById('sb').value;
    var h = +document.getElementById('sh').value;
    document.getElementById('oa').textContent = a;
    document.getElementById('ob').textContent = b;
    document.getElementById('oh').textContent = h;

    var s = 13, baseY = 170, cx = 200, hp = h * 14;
    var tw = a * s, bw = b * s, topY = baseY - hp;
    var p1 = [cx - tw / 2, topY], p2 = [cx + tw / 2, topY], p3 = [cx + bw / 2, baseY], p4 = [cx - bw / 2, baseY];
    var pts = [p1, p2, p3, p4].map(function (p) { return p.join(','); }).join(' ');

    var svg = '<polygon points="' + pts + '" fill="#eef2ff" stroke="#334155" stroke-width="2.4" stroke-linejoin="round"/>';
    /* 高 */
    svg += '<line x1="' + cx + '" y1="' + topY + '" x2="' + cx + '" y2="' + baseY +
      '" stroke="#059669" stroke-width="2" stroke-dasharray="6 4"/>';
    svg += '<path d="M' + (cx - 9) + ' ' + (baseY - 12) + 'L' + cx + ' ' + baseY + 'L' + (cx + 9) + ' ' + (baseY - 12) + '" fill="none" stroke="#059669" stroke-width="2"/>';
    /* 平行箭咀 */
    svg += '<path d="M' + (cx - 6) + ' ' + (topY - 6) + 'L' + cx + ' ' + (topY - 12) + 'L' + (cx + 6) + ' ' + (topY - 6) + '" fill="none" stroke="#2563eb" stroke-width="2"/>';
    svg += '<path d="M' + (cx - 6) + ' ' + (baseY + 6) + 'L' + cx + ' ' + (baseY + 12) + 'L' + (cx + 6) + ' ' + (baseY + 6) + '" fill="none" stroke="#2563eb" stroke-width="2"/>';
    /* 標籤 */
    svg += '<text x="' + cx + '" y="' + (topY - 16) + '" font-size="12" fill="#4338ca" text-anchor="middle" font-weight="700">上底 ' + a + '</text>';
    svg += '<text x="' + cx + '" y="' + (baseY + 32) + '" font-size="12" fill="#4338ca" text-anchor="middle" font-weight="700">下底 ' + b + '</text>';
    svg += '<text x="' + (cx + 8) + '" y="' + (baseY - hp / 2) + '" font-size="12" fill="#059669" font-weight="700">高 ' + h + '</text>';

    document.getElementById('trapSvg').innerHTML = svg;
    var area = (a + b) / 2 * h;
    document.getElementById('areaOut').innerHTML =
      '面積 = (' + a + ' + ' + b + ') × ' + h + ' ÷ 2 = <b>' + area + '</b> cm²' +
      (a === b ? '<br><span style="color:#b45309">上底＝下底，呢個其實已經係平行四邊形。</span>' : '');
  }

  ['sa', 'sb', 'sh'].forEach(function (id) {
    document.getElementById(id).addEventListener('input', drawTrap);
  });

  /* ---------- ⑧ 小測驗 ---------- */
  var QUIZ = [
    { q: '正方形係長方形嘅一種。', a: true, e: '正方形完全符合長方形嘅條件（四個直角、對邊平行且相等），只係多咗「四邊相等」，所以係長方形嘅特例。' },
    { q: '平行四邊形嘅兩條對角線一定一樣長。', a: false, e: '一般平行四邊形嘅對角線只會互相平分，長度唔同。要對角線相等，要有直角（長方形／正方形）或等腰（等腰梯形）。' },
    { q: '菱形嘅兩條對角線互相垂直。', a: true, e: '菱形嘅對角線互相垂直，而且每條對角線平分一組對角——呢兩個係菱形獨有嘅好幫手。' },
    { q: '梯形有兩組對邊平行。', a: false, e: '梯形只有一組對邊平行。兩組都平行就係平行四邊形（香港定義下兩者唔重疊）。' },
    { q: '一個四邊形四條邊相等，佢一定係正方形。', a: false, e: '四邊相等只可以肯定是菱形。要有直角（或對角線相等）才升級做正方形。' },
    { q: '長方形有 4 條對稱軸。', a: false, e: '長方形只有 2 條對稱軸（穿過對邊中點）。正方形才有 4 條。' },
    { q: '平行四邊形嘅對角線互相平分。', a: true, e: '對角線交點係兩條對角線嘅中點，所以分成四條兩兩相等嘅線段。' },
    { q: '等腰梯形嘅兩條對角線相等。', a: true, e: '等腰梯形沿垂直中線對稱，所以兩條對角線互為鏡像，長度相等；一般梯形就唔一定。' }
  ];

  var answered = 0, correct = 0;

  function renderQuiz() {
    var box = document.getElementById('quizBox');
    box.innerHTML = QUIZ.map(function (item, i) {
      return '<div class="qq" data-i="' + i + '">' +
        '<div class="stem"><i>第 ' + (i + 1) + ' 題</i>' + item.q + '</div>' +
        '<div class="opts"><button class="opt" data-v="1">對</button><button class="opt" data-v="0">錯</button></div>' +
        '<div class="exp"><b>答案：' + (item.a ? '對' : '錯') + '。</b>' + item.e + '</div></div>';
    }).join('');
  }

  document.getElementById('quizBox').addEventListener('click', function (e) {
    var b = e.target.closest('.opt');
    if (!b) return;
    var card = b.closest('.qq');
    if (card.dataset.done) return;
    card.dataset.done = '1';
    var item = QUIZ[+card.dataset.i];
    var pick = b.dataset.v === '1';
    var ok = pick === item.a;
    b.classList.add(ok ? 'correct' : 'wrong');
    if (!ok) {
      var rightBtn = card.querySelector('.opt[data-v="' + (item.a ? 1 : 0) + '"]');
      if (rightBtn) rightBtn.classList.add('correct');
    }
    card.querySelector('.exp').classList.add('show');
    answered++; if (ok) correct++;
    document.getElementById('score').textContent =
      '已答 ' + answered + ' / ' + QUIZ.length + '　·　答對 ' + correct + ' 題' +
      (answered === QUIZ.length ? '　→　' + (correct === QUIZ.length ? '全對，好嘢！' : correct >= 6 ? '唔錯，再睇一次錯嗰幾題。' : '建議由第 1 節重看一次。') : '');
  });

  /* ---------- 導覽高亮 ---------- */
  function spy() {
    var links = Array.prototype.slice.call(document.querySelectorAll('#tabs a'));
    var secs = links.map(function (a) { return document.querySelector(a.getAttribute('href')); });
    function upd() {
      var y = window.scrollY + 90, idx = 0;
      secs.forEach(function (s, i) { if (s && s.offsetTop <= y) idx = i; });
      links.forEach(function (a, i) { a.classList.toggle('on', i === idx); });
    }
    window.addEventListener('scroll', upd, { passive: true });
    upd();
  }

  /* ---------- 啟動 ---------- */
  renderChain();
  renderShapes();
  renderMatrix();
  renderFlow();
  renderMyths();
  drawTrap();
  renderQuiz();
  spy();
})();
