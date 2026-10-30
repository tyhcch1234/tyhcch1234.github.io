/* ============================================================
   中文字工作紙生成器 — 純前端版
   資料：hanzi-writer-data（筆順）、cjkvi-ids（結構）、kfcd/chaizi（拆字）
   ============================================================ */
(function () {
  'use strict';

  // ---------------- 常數 ----------------
  const DPI = 300;
  const FONT = '微軟正黑體';
  const COLORS = ['rgb(222,30,45)', 'rgb(36,112,200)', 'rgb(24,148,76)',
                  'rgb(150,80,170)', 'rgb(214,130,20)'];
  const GREY_BOX = '#f1f2f4';
  const GREY_CHAR = '#c6c6c6';
  const DASHC = '#464646';
  const GRIDC = '#3c3c3c';
  const LW_BORDER = 0.032;
  const LW_GRID = 0.012;
  const MARGIN = 0.06;

  const GLYPH_URLS = [
    'https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0.1/{}.json',
    'https://unpkg.com/hanzi-writer-data@2.0.1/{}.json'
  ];

  const $ = (id) => document.getElementById(id);
  const f = (v) => (Math.round(v * 10000) / 10000).toString();

  // ---------------- 資料載入 ----------------
  const glyphCache = new Map();
  let idsMap = null;
  let chaiziMap = null;
  let loadingIds = null, loadingChaizi = null;

  async function fetchGlyph(ch) {
    if (glyphCache.has(ch)) return glyphCache.get(ch);
    let data = null;
    for (const tpl of GLYPH_URLS) {
      try {
        const r = await fetch(tpl.replace('{}', encodeURIComponent(ch)));
        if (!r.ok) continue;
        data = await r.json();
        if (data && data.strokes && data.strokes.length) break;
        data = null;
      } catch (e) { /* try next */ }
      if (data) break;
    }
    glyphCache.set(ch, data);
    return data;
  }

  async function loadIds() {
    if (idsMap) return idsMap;
    if (!loadingIds) {
      loadingIds = fetch('data/ids.txt').then(r => r.text()).then(t => {
        const m = new Map();
        for (const line of t.split('\n')) {
          if (line[0] === '#' || line.indexOf('\t') < 0) continue;
          const p = line.split('\t');
          if (p.length >= 3 && p[1] && !m.has(p[1])) m.set(p[1], p[2]);
        }
        idsMap = m;
        return m;
      });
    }
    return loadingIds;
  }

  async function loadChaizi() {
    if (chaiziMap) return chaiziMap;
    if (!loadingChaizi) {
      loadingChaizi = fetch('data/chaizi-ft.txt').then(r => r.text()).then(t => {
        const m = new Map();
        for (const line of t.split('\n')) {
          const p = line.replace(/\r$/, '').split('\t');
          if (p.length >= 2 && p[0]) {
            const cands = p.slice(1).filter(s => s.trim()).map(s => s.trim().split(/\s+/));
            if (cands.length) m.set(p[0], cands);
          }
        }
        chaiziMap = m;
        return m;
      });
    }
    return loadingChaizi;
  }

  // ---------------- 筆畫幾何 ----------------
  const NUMRE = /-?\d*\.?\d+(?:[eE]-?\d+)?/g;

  function quad(p0, p1, p2, n) {
    const out = [];
    for (let i = 1; i <= n; i++) {
      const t = i / n, mt = 1 - t;
      out.push([mt * mt * p0[0] + 2 * mt * t * p1[0] + t * t * p2[0],
                mt * mt * p0[1] + 2 * mt * t * p1[1] + t * t * p2[1]]);
    }
    return out;
  }

  function cubic(p0, p1, p2, p3, n) {
    const out = [];
    for (let i = 1; i <= n; i++) {
      const t = i / n, mt = 1 - t;
      const a = mt * mt * mt, b = 3 * mt * mt * t, c = 3 * mt * t * t, d = t * t * t;
      out.push([a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
                a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]]);
    }
    return out;
  }

  function parsePath(d) {
    const toks = d.match(/[A-Za-z]|-?\d*\.?\d+(?:[eE]-?\d+)?/g) || [];
    let i = 0, cmd = null, cur = [0, 0], start = [0, 0];
    const polys = [];
    let pts = [];
    while (i < toks.length) {
      const t = toks[i];
      if (/[A-Za-z]/.test(t)) {
        cmd = t; i++;
        if (cmd === 'Z' || cmd === 'z') {
          if (pts.length) { pts.push(start.slice()); polys.push(pts); pts = []; }
          cur = start.slice();
        }
        continue;
      }
      if (cmd === 'M') {
        cur = [parseFloat(toks[i]), parseFloat(toks[i + 1])]; i += 2;
        if (pts.length) polys.push(pts);
        start = cur.slice(); pts = [cur.slice()]; cmd = 'L';
      } else if (cmd === 'L') {
        cur = [parseFloat(toks[i]), parseFloat(toks[i + 1])]; i += 2;
        pts.push(cur.slice());
      } else if (cmd === 'Q') {
        const c = [parseFloat(toks[i]), parseFloat(toks[i + 1])];
        const p = [parseFloat(toks[i + 2]), parseFloat(toks[i + 3])]; i += 4;
        pts = pts.concat(quad(cur, c, p, 14)); cur = p.slice();
      } else if (cmd === 'C') {
        const v = [0, 1, 2, 3, 4, 5].map(k => parseFloat(toks[i + k])); i += 6;
        pts = pts.concat(cubic(cur, [v[0], v[1]], [v[2], v[3]], [v[4], v[5]], 18));
        cur = [v[4], v[5]];
      } else { i++; }
    }
    if (pts.length) polys.push(pts);
    return polys;
  }

  class Glyf {
    constructor(ch, data) {
      this.ch = ch;
      this.strokes = data.strokes;
      this.medians = data.medians || [];
      this.n = this.strokes.length;
      this.polys = this.strokes.map(parsePath);
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const sp of this.polys) {
        for (const poly of sp) {
          for (const p of poly) {
            const x = p[0], y = 900 - p[1];
            if (x < x0) x0 = x; if (x > x1) x1 = x;
            if (y < y0) y0 = y; if (y > y1) y1 = y;
          }
        }
      }
      this.bbox = [x0, y0, x1, y1];
      this.centroids = [];
      for (let i = 0; i < this.n; i++) {
        const m = (this.medians[i] && this.medians[i].length) ? this.medians[i] : [[512, 512]];
        let mx = 0, my = 0;
        for (const p of m) { mx += p[0]; my += 900 - p[1]; }
        this.centroids.push([mx / m.length, my / m.length]);
      }
    }

    strokeBBox(idxs) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const i of idxs) {
        for (const poly of this.polys[i]) {
          for (const p of poly) {
            const x = p[0], y = 900 - p[1];
            if (x < x0) x0 = x; if (x > x1) x1 = x;
            if (y < y0) y0 = y; if (y > y1) y1 = y;
          }
        }
      }
      return [x0, y0, x1, y1];
    }

    medianBBox(idxs) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, any = false;
      for (const i of idxs) {
        const m = this.medians[i] || [];
        for (const p of m) {
          any = true;
          const x = p[0], y = 900 - p[1];
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
      return any ? [x0, y0, x1, y1] : this.strokeBBox(idxs);
    }
  }

  // ---------------- 部件拆解 ----------------
  const OPS = '⿰⿱⿲⿳⿴⿵⿶⿷⿸⿹⿺⿻⿼⿽⿾⿿〾';
  const ENCLOSE = '⿴⿵⿶⿷⿸⿹⿺⿻⿼⿽';

  function parseIds(s) {
    s = (s || '').replace(/\[[^\]]*\]/g, '').replace(/[&;]/g, '').trim();
    let i = 0;
    function rec() {
      if (i >= s.length) return null;
      const c = s[i];
      if (OPS.indexOf(c) >= 0) {
        i++;
        const n = '⿲⿳'.indexOf(c) >= 0 ? 3 : 2;
        const ch = [];
        for (let k = 0; k < n; k++) { const x = rec(); if (x) ch.push(x); }
        return ch.length ? { op: c, ch } : null;
      }
      i++;
      if ('？?＃#@①②③④⑤⑥⑦⑧⑨⑩'.indexOf(c) >= 0 || /\d/.test(c)) return null;
      return { leaf: c };
    }
    return rec();
  }

  function kmeans1d(values, k) {
    const n = values.length;
    if (!n) return [];
    k = Math.max(1, Math.min(k, n));
    const order = values.map((v, i) => i).sort((a, b) => values[a] - values[b]);
    const vals = order.map(i => values[i]);
    const centers = [];
    for (let j = 0; j < k; j++) centers.push(vals[Math.min(n - 1, Math.floor((j + 0.5) * n / k))]);
    let assign = new Array(n).fill(0);
    for (let it = 0; it < 30; it++) {
      const next = vals.map(v => {
        let bi = 0, bd = Infinity;
        for (let j = 0; j < k; j++) {
          const d = Math.abs(v - centers[j]);
          if (d < bd) { bd = d; bi = j; }
        }
        return bi;
      });
      const changed = next.some((v, idx) => v !== assign[idx]);
      assign = next;
      for (let j = 0; j < k; j++) {
        let sum = 0, cnt = 0;
        for (let idx = 0; idx < n; idx++) if (assign[idx] === j) { sum += vals[idx]; cnt++; }
        if (cnt) centers[j] = sum / cnt;
      }
      if (!changed) break;
    }
    const out = new Array(n).fill(0);
    order.forEach((idx, pos) => { out[idx] = assign[pos]; });
    return out;
  }

  function splitByAxis(idxs, g, axis, k) {
    const vals = idxs.map(i => g.centroids[i][axis === 'x' ? 0 : 1]);
    const lab = kmeans1d(vals, k);
    const groups = [];
    for (let j = 0; j < k; j++) groups.push([]);
    idxs.forEach((idx, pos) => groups[lab[pos]].push(idx));
    groups.sort((A, B) => {
      const ma = A.reduce((s, i) => s + g.centroids[i][axis === 'x' ? 0 : 1], 0) / Math.max(1, A.length);
      const mb = B.reduce((s, i) => s + g.centroids[i][axis === 'x' ? 0 : 1], 0) / Math.max(1, B.length);
      return ma - mb;
    });
    return groups;
  }

  function splitEnclosure(idxs, g, k) {
    const [x0, y0, x1, y1] = g.bbox;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const hw = Math.max(1, (x1 - x0) / 2), hh = Math.max(1, (y1 - y0) / 2);
    const vals = idxs.map(i => Math.max(Math.abs(g.centroids[i][0] - cx) / hw,
                                        Math.abs(g.centroids[i][1] - cy) / hh));
    const lab = kmeans1d(vals, 2);
    const outer = [], inner = [];
    idxs.forEach((idx, pos) => { (lab[pos] === 1 ? outer : inner).push(idx); });
    if (!outer.length || !inner.length) return splitByAxis(idxs, g, 'x', k);
    return [outer].concat(k === 2 ? [inner] : splitByAxis(inner, g, 'y', k - 1));
  }

  function assignStrokes(node, idxs, g) {
    if (!node || !idxs.length) return [];
    if (node.leaf) return [{ name: node.leaf, strokes: idxs.slice() }];
    const ch = node.ch, k = ch.length;
    if (k === 1) return assignStrokes(ch[0], idxs, g);
    let groups;
    if (k > idxs.length) {
      groups = [];
      for (let j = 0; j < k; j++) groups.push([]);
      idxs.forEach((v, n) => groups[n % k].push(v));
    } else if (node.op === '⿰' || node.op === '⿲') {
      groups = splitByAxis(idxs, g, 'x', k);
    } else if (node.op === '⿱' || node.op === '⿳') {
      groups = splitByAxis(idxs, g, 'y', k);
    } else if (ENCLOSE.indexOf(node.op) >= 0) {
      groups = splitEnclosure(idxs, g, k);
    } else {
      groups = splitByAxis(idxs, g, 'x', k);
    }
    groups = groups.filter(gp => gp.length);
    const out = [];
    groups.forEach((gp, i) => { if (ch[i]) out.push(...assignStrokes(ch[i], gp, g)); });
    const used = new Set();
    out.forEach(o => o.strokes.forEach(s => used.add(s)));
    const left = idxs.filter(i => !used.has(i));
    if (left.length && out.length) out[out.length - 1].strokes.push(...left);
    return out;
  }

  async function strokeCount(ch) {
    const d = await fetchGlyph(ch);
    return d && d.strokes ? d.strokes.length : 0;
  }

  async function pickChaizi(ch, g) {
    const db = await loadChaizi();
    const cands = db.get(ch) || [];
    let best = null;
    for (const cand of cands) {
      const parts = cand.filter(p => p.length === 1);
      if (parts.length < 2 || parts.length !== cand.length || parts.length > 5) continue;
      const counts = [];
      for (const p of parts) counts.push(await strokeCount(p));
      if (counts.some(c => !c)) continue;
      if (counts.reduce((a, b) => a + b, 0) !== g.n) continue;
      if (Math.min.apply(null, counts) < 2) continue;   // 不接受單筆部件
      if (!best || parts.length > best.parts.length) best = { parts, counts };
    }
    return best;
  }

  function sequentialGroups(counts, n) {
    const groups = [];
    let pos = 0;
    for (const c of counts) {
      groups.push([]);
      for (let i = pos; i < Math.min(n, pos + c); i++) groups[groups.length - 1].push(i);
      pos += c;
    }
    return groups;
  }

  async function decompose(ch, g, overrides) {
    const ov = overrides[ch] || null;

    if (ov && ov.counts && ov.counts.reduce((a, b) => a + b, 0) === g.n) {
      const groups = sequentialGroups(ov.counts, g.n);
      const names = (ov.names && ov.names.length === groups.length)
        ? ov.names : groups.map((_, i) => '部件' + (i + 1));
      return { names, groups };
    }
    if (ov && ov.names) {
      const counts = [];
      for (const p of ov.names) counts.push(await strokeCount(p));
      if (counts.every(c => c) && counts.reduce((a, b) => a + b, 0) === g.n) {
        return { names: ov.names, groups: sequentialGroups(counts, g.n) };
      }
    }

    const [picked, ids] = await Promise.all([pickChaizi(ch, g), loadIds()]);
    let idsParts = null;
    const node = parseIds(ids.get(ch));
    if (node) {
      try {
        const parts = assignStrokes(node, Array.from({ length: g.n }, (_, i) => i), g)
          .filter(p => p.strokes.length);
        if (parts.length >= 2) idsParts = parts;
      } catch (e) { idsParts = null; }
    }

    let names, groups;
    if (picked) {
      if (idsParts && idsParts.length === picked.parts.length) {
        names = idsParts.map(p => p.name);
        groups = idsParts.map(p => p.strokes.slice().sort((a, b) => a - b));
      } else {
        names = picked.parts;
        groups = sequentialGroups(picked.counts, g.n);
      }
    } else if (idsParts) {
      names = idsParts.map(p => p.name);
      groups = idsParts.map(p => p.strokes.slice().sort((a, b) => a - b));
    } else {
      names = [ch];
      groups = [Array.from({ length: g.n }, (_, i) => i)];
    }

    if (groups.length > 5) {
      const k = 3, cuts = [0, Math.round(g.n / k), Math.round(2 * g.n / k), g.n];
      groups = [];
      for (let i = 0; i < k; i++) {
        const arr = [];
        for (let s = cuts[i]; s < cuts[i + 1]; s++) arr.push(s);
        groups.push(arr);
      }
      names = groups.map((_, i) => '部件' + (i + 1));
    }
    names = names.map((n, i) => (n && '？?＃#@①②③④⑤⑥⑦⑧⑨⑩'.indexOf(n) < 0 && !/^\d+$/.test(n))
      ? n : '部件' + (i + 1));
    return { names, groups };
  }

  // ---------------- 繪圖（SVG） ----------------
  function fit(bbox, bw, bh, pad) {
    const [x0, y0, x1, y1] = bbox;
    const sc = Math.min(bw * (1 - 2 * pad) / Math.max(1e-6, x1 - x0),
                        bh * (1 - 2 * pad) / Math.max(1e-6, y1 - y0));
    const gx = (x0 + x1) / 2, gy = (y0 + y1) / 2;
    return [sc, bw / 2 - gx * sc, bh / 2 - gy * sc];
  }

  function rectTag(x, y, w, h, opt) {
    opt = opt || {};
    const lw = opt.lw === undefined ? LW_BORDER : opt.lw;
    const t = lw / 2;
    let s = '<rect x="' + f(x + t) + '" y="' + f(y + t) + '" width="' + f(Math.max(0, w - lw)) +
            '" height="' + f(Math.max(0, h - lw)) + '" fill="' + (opt.fill || 'none') + '"';
    if (opt.stroke !== null) s += ' stroke="' + (opt.stroke || '#000') + '" stroke-width="' + lw + '"';
    return s + '/>';
  }

  function lineTag(x1, y1, x2, y2, opt) {
    opt = opt || {};
    let s = '<line x1="' + f(x1) + '" y1="' + f(y1) + '" x2="' + f(x2) + '" y2="' + f(y2) +
            '" stroke="' + (opt.stroke || '#000') + '" stroke-width="' + (opt.lw || 0.02) + '"';
    if (opt.dash) s += ' stroke-dasharray="' + opt.dash[0] + ' ' + opt.dash[1] + '"';
    return s + '/>';
  }

  function glyphTag(g, idxs, tf, color) {
    const [sc, dx, dy] = tf;
    let s = '<g transform="translate(' + f(dx) + ',' + f(dy) + ') scale(' + f(sc) + ',' +
            f(-sc) + ') translate(0,-900)" fill="' + color + '">';
    for (const i of idxs) s += '<path d="' + g.strokes[i] + '"/>';
    return s + '</g>';
  }

  function gridLines(x, y, w, h, kind) {
    let s = '';
    const o = { stroke: GRIDC, lw: LW_GRID };
    if (kind === 'jiugong') {
      for (const k of [1 / 3, 2 / 3]) {
        s += lineTag(x + w * k, y, x + w * k, y + h, o);
        s += lineTag(x, y + h * k, x + w, y + h * k, o);
      }
    } else if (kind === 'mi') {
      s += lineTag(x + w / 2, y, x + w / 2, y + h, o);
      s += lineTag(x, y + h / 2, x + w, y + h / 2, o);
      s += lineTag(x, y, x + w, y + h, o);
      s += lineTag(x + w, y, x, y + h, o);
    }
    return s;
  }

  function svgDoc(w, h, body) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + f(w) + ' ' + f(h) +
           '" preserveAspectRatio="xMidYMid meet">' +
           '<rect x="0" y="0" width="' + f(w) + '" height="' + f(h) + '" fill="#fff"/>' + body + '</svg>';
  }

  // 各圖塊（回傳 { w, h, body }）
  function blkTarget(g, box) {
    const gap = 1.6, w = box * 3 + gap * 2;
    let body = '';
    const tf = fit(g.bbox, box, box, 0.09);
    ['none', 'jiugong', 'mi'].forEach((kind, i) => {
      const x = i * (box + gap);
      body += rectTag(x, 0, box, box);
      body += gridLines(x + LW_BORDER / 2, LW_BORDER / 2, box - LW_BORDER, box - LW_BORDER, kind);
      body += glyphTag(g, Array.from({ length: g.n }, (_, k) => k), [tf[0], tf[1] + x, tf[2]], '#111');
    });
    return { w, h: box, body };
  }

  function blkSplit(g, groups, box) {
    let body = rectTag(0, 0, box, box);
    const tf = fit(g.bbox, box, box, 0.09);
    groups.forEach((grp, i) => {
      body += glyphTag(g, grp, tf, COLORS[i % COLORS.length]);
    });
    return { w: box, h: box, body };
  }

  function blkParts(g, groups, h, width) {
    const n = Math.max(1, groups.length), cw = width / n;
    let body = '';
    const base = fit(g.bbox, cw, h, 0.06)[0];
    groups.forEach((grp, i) => {
      const x = i * cw;
      body += rectTag(x, 0, cw, h);
      const [bx0, by0, bx1, by1] = g.strokeBBox(grp);
      const dx = x + cw / 2 - (bx0 + bx1) / 2 * base;
      const dy = h / 2 - (by0 + by1) / 2 * base;
      body += glyphTag(g, grp, [base, dx, dy], COLORS[i % COLORS.length]);
    });
    return { w: width, h, body };
  }

  function strokeLayout(n) {
    let rows = 1;
    for (;;) {
      const per = Math.ceil(n / rows);
      const cell = Math.min(2.3, 18.2 / per);
      if (cell >= 1.3 || rows >= 4) return { cell, rows, per };
      rows++;
    }
  }

  function blkStrokes(g) {
    const { cell, rows, per } = strokeLayout(g.n);
    const w = 18.2, h = cell * rows;
    let body = '';
    const tf = fit(g.bbox, cell, cell, 0.09);
    for (let k = 0; k < g.n; k++) {
      const r = Math.floor(k / per), c = k % per;
      const x = c * cell, y = r * cell;
      body += rectTag(x, y, cell, cell);
      body += glyphTag(g, Array.from({ length: k + 1 }, (_, i) => i),
                       [tf[0], tf[1] + x, tf[2] + y], '#111');
    }
    return { w, h, body };
  }

  function blkCopy(g) {
    const sizes = [4.8, 3.6, 2.4, 1.2], gap = 1.2;
    const w = sizes.reduce((a, b) => a + b, 0) + gap * (sizes.length - 1);
    const h = Math.max.apply(null, sizes);
    let body = '', x = 0;
    sizes.forEach((s, i) => {
      const y = h - s;
      body += rectTag(x, y, s, s);
      if (i === 0) {
        const tf = fit(g.bbox, s, s, 0.11);
        body += glyphTag(g, Array.from({ length: g.n }, (_, k) => k),
                         [tf[0], tf[1] + x, tf[2] + y], GREY_CHAR);
      }
      x += s + gap;
    });
    return { w, h, body };
  }

  function hiddenColumns(k) {
    const cols = [];
    const add = (c) => { if (!cols.some(x => x.length === c.length && x.every((v, i) => v === c[i]))) cols.push(c); };
    add(Array.from({ length: k }, (_, i) => i));
    for (let i = k - 1; i >= 1; i--) add(Array.from({ length: i }, (_, j) => j));
    for (let i = 0; i < k; i++) add([i]);
    add([]);
    return cols;
  }

  function blkHidden(g, groups) {
    const cols = hiddenColumns(groups.length);
    const n = cols.length, cell = Math.min(3.05, 18.3 / n), w = cell * n;
    const tf = fit(g.bbox, cell, cell, 0.14);
    const [sc, dx0, dy0] = tf;
    const m = 0.07;
    let body = '';
    cols.forEach((visible, c) => {
      const x = c * cell;
      const hidden = groups.map((_, i) => i).filter(i => visible.indexOf(i) < 0);
      for (const hi of hidden) {
        const [bx0, by0, bx1, by1] = g.medianBBox(groups[hi]);
        let ax0 = Math.min(Math.max(x + m, (dx0 + x) + bx0 * sc - 0.05), x + cell - m);
        let ay0 = Math.min(Math.max(m, dy0 + by0 * sc - 0.05), cell - m);
        let ax1 = Math.max(ax0, Math.min(x + cell - m, (dx0 + x) + bx1 * sc + 0.05));
        let ay1 = Math.max(ay0, Math.min(cell - m, dy0 + by1 * sc + 0.05));
        body += rectTag(ax0, ay0, ax1 - ax0, ay1 - ay0, { fill: GREY_BOX, stroke: null });
      }
      body += rectTag(x, 0, cell, cell);
      const idxs = [];
      visible.forEach(vi => groups[vi].forEach(s => idxs.push(s)));
      body += glyphTag(g, idxs, [sc, dx0 + x, dy0], '#111');
    });
    return { w, h: cell, body };
  }

  function blkDictation() {
    const sizes = [4.8, 3.6, 2.4, 1.2], gap = 1.2;
    const w = sizes.reduce((a, b) => a + b, 0) + gap * (sizes.length - 1);
    const h = Math.max.apply(null, sizes);
    let body = '', x = 0;
    sizes.forEach((s, i) => {
      const y = h - s;
      body += rectTag(x, y, s, s);
      if (i < 2) {
        const cx = x + s / 2, cy = y + s / 2;
        body += lineTag(cx, y + 0.03, cx, y + s - 0.03, { stroke: DASHC, lw: 0.02, dash: [0.26, 0.15] });
        body += lineTag(x + 0.03, cy, x + s - 0.03, cy, { stroke: DASHC, lw: 0.02, dash: [0.26, 0.15] });
      }
      x += s + gap;
    });
    return { w, h, body };
  }

  // ---------------- SVG → PNG ----------------
  async function svgToPng(svg, w, h) {
    const bad = svg.match(/NaN|undefined|Infinity/g);
    if (bad) {
      const i = svg.search(/NaN|undefined|Infinity/);
      throw new Error('SVG 含有無效數值（' + bad[0] + '）：' + svg.slice(Math.max(0, i - 120), i + 40));
    }
    const k = DPI / 2.54;
    const cw = Math.round(w * k), ch = Math.round(h * k);
    const sized = svg.replace('<svg ', '<svg width="' + cw + '" height="' + ch + '" ');
    const blob = new Blob([sized], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
      const cv = document.createElement('canvas');
      cv.width = cw; cv.height = ch;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, cw, ch);
      ctx.drawImage(img, 0, 0, cw, ch);
      const png = await new Promise(r => cv.toBlob(r, 'image/png'));
      return new Uint8Array(await png.arrayBuffer());
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  // ---------------- DOCX ----------------
  const TW = { page: [11906, 16838], margin: { top: 794, right: 720, bottom: 680, left: 720 } };
  const cm2px = (cm) => cm / 2.54 * 96;

  function run(text, opts) {
    opts = opts || {};
    return new docx.TextRun({
      text: text,
      bold: !!opts.bold,
      size: opts.size || 21,
      color: opts.color || '1A1A1A',
      font: { ascii: FONT, hAnsi: FONT, eastAsia: FONT, cs: FONT }
    });
  }

  function para(children, opts) {
    opts = opts || {};
    return new docx.Paragraph({
      children: children,
      alignment: opts.align,
      spacing: { before: opts.before || 0, after: opts.after || 0,
                 line: 240, lineRule: docx.LineRuleType.AUTO },
      indent: opts.indent ? { left: opts.indent } : undefined,
      keepNext: !!opts.keepNext,
      pageBreakBefore: !!opts.pageBreakBefore
    });
  }

  function labelPara(text, note, opts) {
    opts = opts || {};
    const children = [run(text, { bold: true, size: opts.size || 21 })];
    if (note) children.push(run(note, { size: (opts.size || 21) - 2, color: '595959' }));
    return para(children, {
      before: opts.before === undefined ? 160 : opts.before,
      after: opts.after === undefined ? 60 : opts.after,
      indent: opts.indent === undefined ? 312 : opts.indent,
      keepNext: true,
      pageBreakBefore: !!opts.pageBreakBefore
    });
  }

  async function imagePara(block) {
    const png = await svgToPng(svgDoc(block.w, block.h, block.body), block.w, block.h);
    return para([new docx.ImageRun({
      data: png,
      type: 'png',
      transformation: { width: cm2px(block.w), height: cm2px(block.h) }
    })], { align: docx.AlignmentType.CENTER });
  }

  async function buildDocx(items, onProgress) {
    const children = [];
    for (let idx = 0; idx < items.length; idx++) {
      const { ch, g, names, groups } = items[idx];
      onProgress(idx, items.length, ch);

      const { cell, rows } = strokeLayout(g.n);
      const box = Math.max(3.0, Math.min(3.8, (13.9 - cell * rows) / 3));

      // 標題（每字新一頁）
      children.push(para([
        run('中文字練習工作紙', { bold: true, size: 34 }),
        run('　' + ch + '（' + g.n + ' 筆）', { size: 22, color: '595959' })
      ], { align: docx.AlignmentType.CENTER, after: 160, pageBreakBefore: idx > 0 }));

      children.push(labelPara('一、目標字',
        '（字形以楷書筆畫繪製；左格無輔助線，中格有九格線，右格有米字線）',
        { size: 22, indent: 0, before: 0, after: 80 }));
      children.push(await imagePara(blkTarget(g, box)));

      children.push(labelPara('二、學習步驟', null, { size: 22, indent: 0, before: 160, after: 40 }));

      children.push(labelPara('1. 分拆部首部件', '（不同部件用不同顏色顯示）', { before: 160 }));
      children.push(await imagePara(blkSplit(g, groups, box)));

      children.push(labelPara('2. 展示已拆細的組成部首部件', '（按筆順次序顯示，顏色與上一步驟相同）', { before: 160 }));
      children.push(await imagePara(blkParts(g, groups, box, 18.0)));

      children.push(labelPara('3. 筆順展示',
        '（一格增加一筆劃，自動加格數：全字 ' + g.n + ' 筆，共 ' + g.n + ' 格）', { before: 160 }));
      children.push(await imagePara(blkStrokes(g)));

      children.push(labelPara('4. 按筆順順序謄寫',
        '（格的大小：最大 4.8×4.8cm，第二 3.6×3.6cm，第三 2.4×2.4cm，最小 1.2×1.2cm）',
        { before: 160 }));
      children.push(await imagePara(blkCopy(g)));

      // 第 2 頁
      children.push(labelPara('5. 隱藏部份部首部件默寫',
        '（灰色長方形為隱藏位置，面積與原有部份相若，先隱藏一個部首部件，逐步增加）',
        { indent: 0, pageBreakBefore: true }));
      children.push(await imagePara(blkHidden(g, groups)));

      children.push(labelPara('6. 默寫字詞', '（首兩格有輔助線）', { before: 440 }));
      children.push(para([run('（格的大小：最大 4.8×4.8cm，第二 3.6×3.6cm，第三 2.4×2.4cm，最小 1.2×1.2cm）',
        { size: 17, color: '595959' })], { indent: 652, after: 40, keepNext: true }));
      children.push(await imagePara(blkDictation()));
    }

    const doc = new docx.Document({
      title: '中文字練習工作紙',
      description: '中文字書寫練習工作紙',
      styles: {
        default: {
          document: {
            run: { font: { ascii: FONT, hAnsi: FONT, eastAsia: FONT, cs: FONT }, size: 21 }
          }
        }
      },
      sections: [{
        properties: {
          page: {
            size: { width: TW.page[0], height: TW.page[1] },
            margin: TW.margin
          }
        },
        children: children
      }]
    });
    return docx.Packer.toBlob(doc);
  }

  // ---------------- 介面 ----------------
  function parseList(text) {
    const out = [], seen = new Set();
    for (const line of text.split(/\r?\n/)) {
      const l = line.trim();
      if (!l || l[0] === '#') continue;
      for (const tok of l.split(/[\s,，、;；]+/)) {
        for (const ch of tok) {
          if (!ch.trim()) continue;
          if (!seen.has(ch)) { seen.add(ch); out.push(ch); }
        }
      }
    }
    return out;
  }

  function parseOverrides(text) {
    const map = {};
    for (const line of text.split(/\r?\n/)) {
      const l = line.trim();
      if (!l || l[0] === '#' || l.indexOf('=') < 0) continue;
      const i = l.indexOf('=');
      const ch = l.slice(0, i).trim();
      const items = l.slice(i + 1).trim().split(/[\s,，]+/).filter(Boolean);
      if (!ch || !items.length) continue;
      if (items.every(x => /^\d+$/.test(x))) {
        map[ch] = { counts: items.map(Number) };
      } else {
        map[ch] = { names: items.filter(x => x.length === 1) };
      }
    }
    return map;
  }

  const state = { busy: false, blob: null, name: '' };

  function setStatus(html, kind) {
    const el = $('status');
    el.hidden = false;
    el.className = 'status' + (kind ? ' ' + kind : '');
    el.innerHTML = html;
  }

  function clearStatus() { $('status').hidden = true; }

  let previewItems = [], previewIdx = 0;

  function renderPreview(items, idx) {
    previewItems = items;
    previewIdx = idx === undefined ? 0 : idx;
    const box = $('preview');
    box.innerHTML = '';
    if (!items.length) {
      box.innerHTML = '<div class="empty">輸入要練習的字，再按「產生工作紙」。</div>';
      return;
    }
    const it = items[previewIdx];
    const { cell, rows } = strokeLayout(it.g.n);
    const b = Math.max(3.0, Math.min(3.8, (13.9 - cell * rows) / 3));
    const page1 = [blkTarget(it.g, b), blkSplit(it.g, it.groups, b),
                   blkParts(it.g, it.groups, b, 18.0), blkStrokes(it.g), blkCopy(it.g)];
    const page2 = [blkHidden(it.g, it.groups), blkDictation()];

    const head = document.createElement('div');
    head.className = 'preview-head';
    head.innerHTML = '<b>' + it.ch + '</b>　' + it.g.n + ' 筆　' + it.groups.length +
      ' 個部件（' + it.groups.map(gp => gp.length).join('／') + ' 筆）　·　共 ' +
      items.length + ' 個字、' + (items.length * 2) + ' 頁';
    box.appendChild(head);

    if (items.length > 1) {
      const chips = document.createElement('div');
      chips.className = 'chips';
      items.forEach((x, i) => {
        const c = document.createElement('button');
        c.className = 'chip' + (i === previewIdx ? ' on' : '');
        c.textContent = x.ch;
        c.onclick = () => renderPreview(items, i);
        chips.appendChild(c);
      });
      box.appendChild(chips);
    }

    const grid = document.createElement('div');
    grid.className = 'preview-grid';
    [['第 1 頁', page1], ['第 2 頁', page2]].forEach(([lab, blocks]) => {
      const card = document.createElement('div');
      card.className = 'pv-card';
      const t = document.createElement('div');
      t.className = 'pv-label';
      t.textContent = lab;
      card.appendChild(t);
      const page = document.createElement('div');
      page.className = 'pv-page';
      blocks.forEach(bl => {
        const holder = document.createElement('div');
        holder.className = 'pv-block';
        holder.innerHTML = svgDoc(bl.w, bl.h, bl.body);
        const svg = holder.firstElementChild;
        svg.style.width = (bl.w / 18.46 * 100).toFixed(2) + '%';
        page.appendChild(holder);
      });
      card.appendChild(page);
      grid.appendChild(card);
    });
    box.appendChild(grid);
  }

  async function generate() {
    if (state.busy) return;
    const chars = parseList($('chars').value);
    if (!chars.length) {
      setStatus('請先輸入至少一個字。', 'warn');
      return;
    }
    if (chars.length > 80) {
      setStatus('一次最多 80 個字（約 160 頁），請分批產生。', 'warn');
      return;
    }

    state.busy = true;
    $('go').disabled = true;
    $('go').textContent = '產生中…';
    clearStatus();
    localStorage.setItem('hanzi.list', $('chars').value);
    localStorage.setItem('hanzi.ov', $('ov').value);

    const overrides = parseOverrides($('ov').value);
    const items = [];
    const missing = [];

    try {
      setStatus('正在載入資料…');
      await Promise.all([loadIds(), loadChaizi()]);

      for (let i = 0; i < chars.length; i++) {
        const ch = chars[i];
        setStatus('讀取筆順 ' + (i + 1) + ' / ' + chars.length + '：' + ch);
        const data = await fetchGlyph(ch);
        if (!data) { missing.push(ch); continue; }
        const g = new Glyf(ch, data);
        const { names, groups } = await decompose(ch, g, overrides);
        items.push({ ch, g, names, groups });
        await new Promise(r => setTimeout(r, 0));
      }

      if (!items.length) {
        setStatus('找不到這些字的筆順資料，請檢查網絡或換字。', 'error');
        return;
      }

      renderPreview(items, 0);

      const blob = await buildDocx(items, (idx, total, ch) => {
        setStatus('排版中 ' + (idx + 1) + ' / ' + total + '：' + ch);
      });

      state.blob = blob;
      state.name = '工作紙_' + items.slice(0, 3).map(x => x.ch).join('') +
        (items.length > 3 ? '等' + items.length + '字' : '') + '.docx';

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = state.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);

      let msg = '✓ 完成：' + items.length + ' 個字、' + (items.length * 2) + ' 頁，已開始下載。<br>' +
        '<span class="small">如果沒有自動下載，按下面的按鈕。</span>';
      if (missing.length) {
        msg += '<br><span class="small warn-text">略過（找不到筆順）：' + missing.join('、') + '</span>';
      }
      setStatus(msg, 'ok');
      addDownloadButton();
    } catch (err) {
      console.error(err);
      setStatus('產生失敗：' + (err && err.message ? err.message : err) +
        '<br><span class="small">請重新整理再試；若持續失敗，可能是網絡無法讀取筆順資料。</span>', 'error');
    } finally {
      state.busy = false;
      $('go').disabled = false;
      $('go').textContent = '產生工作紙';
    }
  }

  function addDownloadButton() {
    let btn = $('dl');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'dl';
      btn.className = 'primary dl';
      btn.textContent = '下載 DOCX';
      btn.onclick = () => {
        if (!state.blob) return;
        const url = URL.createObjectURL(state.blob);
        const a = document.createElement('a');
        a.href = url; a.download = state.name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      };
      $('actions').appendChild(btn);
    }
    btn.hidden = false;
  }

  // ---------------- 啟動 ----------------
  function init() {
    $('chars').value = localStorage.getItem('hanzi.list') ||
      '別 學 習\n聲\n國 語 想\n時間 讀書';
    $('ov').value = localStorage.getItem('hanzi.ov') || '';

    $('go').addEventListener('click', generate);
    $('clear').addEventListener('click', () => {
      $('chars').value = '';
      $('preview').innerHTML = '<div class="empty">輸入要練習的字，再按「產生工作紙」。</div>';
      clearStatus();
      const dl = $('dl'); if (dl) dl.hidden = true;
    });

    const counter = () => {
      const n = parseList($('chars').value).length;
      $('count').textContent = n ? n + ' 個字 · ' + (n * 2) + ' 頁' : '';
    };
    $('chars').addEventListener('input', counter);
    counter();

    // Ctrl/Cmd + Enter 直接產生
    $('chars').addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') generate();
    });
  }

  // 供除錯用
  window.__ws = { fetchGlyph, Glyf, decompose, svgDoc, svgToPng,
                  blkTarget, blkSplit, blkParts, blkStrokes, blkCopy, blkHidden, blkDictation,
                  strokeLayout };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
