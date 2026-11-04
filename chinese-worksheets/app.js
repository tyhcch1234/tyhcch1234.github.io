/* 中文期考練習 · 14 卷互動工作紙
 * 純前端：data.js 提供題目，作答暫存在 localStorage。
 */
(function () {
  'use strict';

  var D = window.WS_DATA;
  var CN = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  function cnNo(n) { return n <= 10 ? CN[n - 1] : (n < 20 ? '十' + CN[n - 11] : String(n)); }

  var KEY = 'ws-answers-v1';
  var store = {};
  try { store = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { store = {}; }
  var saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {}
    }, 300);
  }

  var state = { vi: 0, graded: false, revealed: false };
  var app = document.getElementById('app');

  function norm(s) {
    return String(s == null ? '' : s)
      .replace(/[\s\u3000]/g, '')
      .replace(/[，。、；：！？,.!?;:「」『』《》（）()…‥·]/g, '');
  }
  function isRef(kind, a) {
    if (kind === 'write') return true;
    return kind === 'fill' && String(a).length > 12;
  }

  /* ------------------------------------------------------------ 分頁 */
  function renderTabs() {
    var tabs = document.getElementById('tabs');
    tabs.innerHTML = '';
    D.volumes.forEach(function (v, i) {
      var b = document.createElement('button');
      b.className = 'tab' + (i === state.vi ? ' active' : '');
      b.innerHTML = '<span class="tno">卷' + cnNo(v.no) + '</span><span class="ttl">' + v.title + '</span>';
      b.addEventListener('click', function () { switchTo(i); });
      tabs.appendChild(b);
    });
  }

  function switchTo(i) {
    state.vi = i;
    state.graded = false;
    state.revealed = false;
    renderTabs();
    renderVolume();
    var act = document.querySelector('.tab.active');
    if (act && act.scrollIntoView) act.scrollIntoView({ inline: 'center', block: 'nearest' });
    try { history.replaceState(null, '', '?v=' + (i + 1)); } catch (e) {}
    window.scrollTo({ top: 0, behavior: 'smooth' });
    try { localStorage.setItem('ws-last', String(i)); } catch (e) {}
  }

  /* ------------------------------------------------------------ 音量 */
  function el(html) {
    var t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstChild;
  }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ------------------------------------------------------------ 題目 */
  function renderVolume() {
    var v = D.volumes[state.vi];
    document.getElementById('dlDoc').href = v.docx;
    document.getElementById('dlAns').href = v.docxAns;
    document.getElementById('dlDoc').setAttribute('download', '');
    document.getElementById('dlAns').setAttribute('download', '');
    document.getElementById('score').textContent = '尚未作答';

    app.innerHTML = '';
    var card = el(
      '<section class="meta">' +
        '<div class="meta-top"><span class="badge">卷' + cnNo(v.no) + '</span>' +
        '<span class="src">依據 ' + esc(v.source) + '</span>' +
        '<span class="cnt">' + v.count + ' 道小題</span></div>' +
        '<h2>' + esc(v.title) + '</h2>' +
        '<p class="book">' + esc(v.book) + '</p>' +
        '<div class="tags">' + v.focus.map(function (f) { return '<span>' + esc(f) + '</span>'; }).join('') + '</div>' +
        (v.note ? '<p class="note"><b>學習提示</b>　' + esc(v.note) + '</p>' : '') +
      '</section>');
    app.appendChild(card);

    var qno = 0;
    v.sections.forEach(function (sec, si) {
      var s = el('<section class="sec" id="s' + (si + 1) + '"><h3>' + esc(sec.head) + '</h3></section>');
      if (sec.bank) {
        s.appendChild(el('<div class="bank">' + sec.bank.map(function (w) { return '<span>' + esc(w) + '</span>'; }).join('') + '</div>'));
      }
      if (sec.kind === 'match' && sec.options) {
        s.appendChild(el('<div class="opts">' + Object.keys(sec.options).map(function (k) {
          return '<div><b>' + k + '.</b> ' + esc(sec.options[k]) + '</div>';
        }).join('') + '</div>'));
      }
      if (sec.kind === 'reorder') {
        s.appendChild(el('<div class="reorder-hint sec-hint">點選詞語，依次排成句子；點答案區的詞語可移走。</div>'));
      }
      var list = el('<div class="qlist"></div>');
      var items = sec.kind === 'cloze' ? sec.paragraphs : sec.items;
      items.forEach(function (it, ii) {
        qno++;
        list.appendChild(buildQ(v, sec, it, si, ii, qno));
      });
      s.appendChild(list);
      app.appendChild(s);
    });

    app.appendChild(el('<p class="end">— 全卷完 —</p>'));
    bindInputs();
    updateProgress();
  }

  function qid(v, si, ii) { return v.id + ':' + si + ':' + ii; }

  function buildQ(v, sec, it, si, ii, no) {
    var id = qid(v, si, ii);
    var kind = sec.kind;
    var saved = store[id];
    var q = el('<div class="q" data-kind="' + kind + '" data-id="' + id + '"></div>');
    q.appendChild(el('<span class="no">' + no + '.</span>'));

    var body = el('<div class="qbody"></div>');
    q.appendChild(body);

    function input(ph, val, cls) {
      var i = document.createElement('input');
      i.type = 'text';
      i.className = 'blank ' + (cls || '');
      i.autocomplete = 'off';
      i.spellcheck = false;
      i.placeholder = ph || '';
      i.value = val || '';
      i.setAttribute('data-id', id);
      return i;
    }

    if (kind === 'wordbank' || kind === 'fill') {
      var parts = it.q.split('___');
      if (parts.length === 1 && kind === 'fill') {
        // 整句改寫／擴寫：沒有預留空格，另設作答區
        body.appendChild(document.createTextNode(it.q));
        if (String(it.a).length > 10) {
          body.appendChild(el('<div class="prompt small">把答案寫在下面：</div>'));
          var ta0 = document.createElement('textarea');
          ta0.className = 'write';
          ta0.rows = 2;
          ta0.placeholder = '在這裏寫句子…';
          ta0.value = saved || '';
          ta0.addEventListener('input', function () {
            store[id] = ta0.value; save(); updateProgress();
            if (state.graded) gradeOne(q, true);
          });
          body.appendChild(ta0);
        } else {
          body.appendChild(input('答案', saved || '', 'wide'));
        }
      } else {
        parts.forEach(function (seg, k) {
          body.appendChild(document.createTextNode(seg));
          if (k < parts.length - 1) {
            var val = Array.isArray(saved) ? saved[k] : (k === 0 ? saved : '');
            body.appendChild(input('', val, ''));
          }
        });
      }
      if (it.hint) body.appendChild(el('<span class="hint">（' + esc(it.hint) + '）</span>'));
      q.setAttribute('data-ans', it.a);
      if (it.a === undefined) q.setAttribute('data-ans', '');

    } else if (kind === 'cloze') {
      var lines = it.q.split('\n');
      lines.forEach(function (line) {
        var p = el('<p class="para"></p>');
        var segs = line.split(/\((\d+)\)___/);
        // segs: text, num, text, num, text ...
        segs.forEach(function (seg, k) {
          if (k % 2 === 1) {
            p.appendChild(el('<span class="bno">(' + seg + ')</span>'));
            var idx = parseInt(seg, 10) - 1;
            p.appendChild(input('', Array.isArray(saved) ? saved[idx] : '', 'mid'));
          } else if (seg) {
            p.appendChild(document.createTextNode(seg));
          }
        });
        body.appendChild(p);
      });
      q.setAttribute('data-ans', JSON.stringify(it.a));

    } else if (kind === 'choice') {
      body.appendChild(document.createTextNode(it.q.split('＿＿＿＿')[0]));
      var opts = it.options || sec.options.map(function (o, k) { return o; });
      if (it.q.indexOf('＿＿＿＿') >= 0 && it.q.split('＿＿＿＿').length > 1) {
        // 句中空格：選項放後面
      }
      if (it.q.split('＿＿＿＿').length > 1) {
        body.appendChild(document.createTextNode(it.q.split('＿＿＿＿')[1] || ''));
      }
      var box = el('<div class="choices"></div>');
      opts.forEach(function (o, k) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'choice' + (saved === o ? ' on' : '');
        b.innerHTML = '<b>' + String.fromCharCode(65 + k) + '.</b> ' + esc(o);
        b.addEventListener('click', function () {
          Array.prototype.forEach.call(box.children, function (c) { c.classList.remove('on'); });
          b.classList.add('on');
          store[id] = o; save(); updateProgress();
          if (state.graded) gradeOne(q, true);
        });
        box.appendChild(b);
      });
      body.appendChild(box);
      q.setAttribute('data-ans', it.a);

    } else if (kind === 'match') {
      body.appendChild(document.createTextNode(it.q));
      var sel = document.createElement('select');
      sel.className = 'pick';
      sel.innerHTML = '<option value="">（　）</option>' + Object.keys(sec.options).map(function (k) {
        return '<option value="' + k + '"' + (saved === k ? ' selected' : '') + '>' + k + '</option>';
      }).join('');
      sel.addEventListener('change', function () {
        store[id] = sel.value; save(); updateProgress();
        if (state.graded) gradeOne(q, true);
      });
      body.appendChild(sel);
      q.setAttribute('data-ans', it.a);

    } else if (kind === 'punct') {
      var segs2 = it.q.split('□');
      segs2.forEach(function (seg, k) {
        body.appendChild(document.createTextNode(seg));
        if (k < segs2.length - 1) {
          var s2 = document.createElement('select');
          s2.className = 'punct';
          s2.innerHTML = '<option value="">□</option>' + sec.options.map(function (o) {
            return '<option value="' + esc(o) + '"' + (Array.isArray(saved) && saved[k] === o ? ' selected' : '') + '>' + esc(o) + '</option>';
          }).join('');
          (function (k2) {
            s2.addEventListener('change', function () {
              var cur = Array.isArray(store[id]) ? store[id].slice() : [];
              while (cur.length < segs2.length - 1) cur.push('');
              cur[k2] = s2.value;
              store[id] = cur; save(); updateProgress();
              if (state.graded) gradeOne(q, true);
            });
          })(k);
          body.appendChild(s2);
        }
      });
      q.setAttribute('data-ans', JSON.stringify(it.a));

    } else if (kind === 'reorder') {
      var pool = el('<div class="pool"></div>');
      var slot = el('<div class="slot"></div>');
      var words = it.words.slice();
      var target = Array.isArray(saved) ? saved.slice() : [];
      body.appendChild(pool);
      body.appendChild(slot);
      var clear = el('<button type="button" class="mini">清除</button>');
      body.appendChild(clear);

      function paint() {
        pool.innerHTML = '';
        slot.innerHTML = '';
        words.forEach(function (w, wi) {
          if (target.indexOf(wi) >= 0) return;
          var c = el('<button type="button" class="chip">' + esc(w) + '</button>');
          c.addEventListener('click', function () {
            target.push(wi); store[id] = target.slice(); save(); paint(); updateProgress();
            if (state.graded) gradeOne(q, true);
          });
          pool.appendChild(c);
        });
        if (!target.length) slot.appendChild(el('<span class="ph">答案區</span>'));
        target.forEach(function (wi, ti) {
          var c = el('<button type="button" class="chip in">' + esc(words[wi]) + '</button>');
          c.addEventListener('click', function () {
            target.splice(ti, 1); store[id] = target.slice(); save(); paint(); updateProgress();
            if (state.graded) gradeOne(q, true);
          });
          slot.appendChild(c);
        });
      }
      clear.addEventListener('click', function () {
        target.length = 0; store[id] = []; save(); paint(); updateProgress();
        if (state.graded) gradeOne(q, true);
      });
      paint();
      q.setAttribute('data-ans', it.a);
      q._readAnswer = function () { return target.map(function (wi) { return words[wi]; }).join(''); };

    } else if (kind === 'write') {
      if (it.img) {
        var img = document.createElement('img');
        img.className = 'scene';
        img.src = 'scenes/' + it.img + '.png';
        img.alt = '示意圖';
        img.loading = 'lazy';
        body.appendChild(img);
      }
      body.appendChild(el('<div class="prompt">' + esc(it.q) + '</div>'));
      if (it.hint) body.appendChild(el('<div class="hint">提示詞語：' + esc(it.hint) + '</div>'));
      var ta = document.createElement('textarea');
      ta.className = 'write';
      ta.rows = 2;
      ta.placeholder = '在這裏寫句子…';
      ta.value = saved || '';
      ta.addEventListener('input', function () {
        store[id] = ta.value; save(); updateProgress();
        if (state.graded) gradeOne(q, true);
      });
      body.appendChild(ta);
      q.setAttribute('data-ans', it.a);
    }

    q.appendChild(el('<div class="mark" aria-hidden="true"></div>'));
    return q;
  }

  /* ------------------------------------------------------------ 批改 */
  function bindInputs() {
    var inputs = app.querySelectorAll('input.blank');
    Array.prototype.forEach.call(inputs, function (inp) {
      inp.addEventListener('input', function () {
        var q = inp.closest('.q');
        var kind = q.getAttribute('data-kind');
        var id = q.getAttribute('data-id');
        if (kind === 'wordbank' || kind === 'fill') {
          var all = q.querySelectorAll('input.blank');
          store[id] = all.length === 1 ? all[0].value : Array.prototype.map.call(all, function (x) { return x.value; });
        } else {
          var arr = Array.prototype.map.call(q.querySelectorAll('input.blank'), function (x) { return x.value; });
          store[id] = arr;
        }
        save(); updateProgress();
        if (state.graded) gradeOne(q, true);
      });
      inp.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        var all = Array.prototype.slice.call(app.querySelectorAll('input.blank, textarea.write'));
        var i = all.indexOf(inp);
        if (i >= 0 && i < all.length - 1) all[i + 1].focus();
      });
    });
  }

  function updateProgress() {
    var total = D.volumes[state.vi].count;
    var done = 0;
    Array.prototype.forEach.call(app.querySelectorAll('.q'), function (q) {
      var kind = q.getAttribute('data-kind');
      if (kind === 'wordbank' || kind === 'fill' || kind === 'cloze') {
        Array.prototype.forEach.call(q.querySelectorAll('input.blank, textarea.write'), function (x) {
          if (String(x.value || '').trim()) done++;
        });
      } else if (kind === 'punct') {
        Array.prototype.forEach.call(q.querySelectorAll('select.punct'), function (s2) {
          if (s2.value) done++;
        });
      } else if (kind === 'choice') {
        if (q.querySelector('.choice.on')) done++;
      } else if (kind === 'match') {
        if (q.querySelector('select').value) done++;
      } else if (kind === 'reorder') {
        if (q.querySelector('.slot .chip')) done++;
      } else if (kind === 'write') {
        var ta = q.querySelector('textarea');
        if (ta && ta.value.trim()) done++;
      }
    });
    if (!state.graded) {
      document.getElementById('score').textContent =
        '已作答 ' + Math.min(done, total) + ' / ' + total + ' 題';
    }
  }

  function markOf(q) {
    var m = q.querySelector('.mark');
    return m;
  }

  function setMark(q, ok, refText) {
    var m = markOf(q);
    q.classList.remove('ok', 'bad', 'ref');
    if (ok === true) { q.classList.add('ok'); m.textContent = '✓'; }
    else if (ok === false) { q.classList.add('bad'); m.textContent = '✗'; }
    else { q.classList.add('ref'); m.textContent = '參考'; }
    var old = q.querySelector('.refbox');
    if (old) old.remove();
    if (refText) {
      q.appendChild(el('<div class="refbox"><b>參考答案：</b>' + esc(refText) + '</div>'));
    }
  }

  function gradeOne(q, silent) {
    var kind = q.getAttribute('data-kind');
    var ans = q.getAttribute('data-ans');
    var ok = null, refText = '';

    if (kind === 'choice' || kind === 'match') {
      var on = q.querySelector('.choice.on');
      var val = kind === 'match' ? (q.querySelector('select').value || '') : (on ? on.textContent.replace(/^[A-J]\.\s*/, '') : '');
      ok = val && norm(val) === norm(ans);
      if (!silent && !ok) refText = ans;

    } else if (kind === 'reorder') {
      var got = q._readAnswer ? q._readAnswer() : '';
      ok = norm(got) && norm(got) === norm(ans);
      if (!silent && !ok) refText = ans;

    } else if (kind === 'punct') {
      var sels = q.querySelectorAll('select.punct');
      var arr = JSON.parse(ans);
      var allOk = true, any = false;
      Array.prototype.forEach.call(sels, function (s, i) {
        if (s.value) any = true;
        if (s.value !== arr[i]) allOk = false;
      });
      ok = any ? allOk : null;
      if (!silent && !allOk) refText = arr.join('　');

    } else if (kind === 'cloze') {
      var ins = q.querySelectorAll('input.blank');
      var a2 = JSON.parse(ans);
      var good = true, filled = false;
      Array.prototype.forEach.call(ins, function (i2, i) {
        if (String(i2.value).trim()) filled = true;
        if (norm(i2.value) !== norm(a2[i])) good = false;
      });
      ok = filled ? good : null;
      if (!silent && !good) refText = a2.join('、');

    } else { // wordbank / fill / write
      var parts = (kind === 'write') ? [q.querySelector('textarea')]
        : Array.prototype.slice.call(q.querySelectorAll('input.blank, textarea.write'));
      var given = parts.map(function (p) { return p ? p.value : ''; });
      var filled2 = given.some(function (g) { return String(g).trim(); });
      if (!filled2) { ok = null; }
      else if (isRef(kind, ans)) {
        ok = norm(given.join('')) === norm(ans) ? true : 'ref';
        refText = ans;
      } else {
        ok = norm(given.join('')) === norm(ans);
        if (!ok) refText = ans;
      }
    }

    if (ok === null) { setMark(q, null, ''); return null; }
    setMark(q, ok, refText);
    return ok;
  }

  function gradeAll(showRef) {
    var okN = 0, badN = 0, refN = 0, autoN = 0, blankN = 0;
    Array.prototype.forEach.call(app.querySelectorAll('.q'), function (q) {
      var r = gradeOne(q, true);
      if (r === true) { okN++; autoN++; }
      else if (r === false) { badN++; autoN++; }
      else if (r === 'ref') { refN++; }
      else { blankN++; }
    });
    state.graded = true;
    var pct = autoN ? Math.round(okN / autoN * 100) : 0;
    document.getElementById('score').innerHTML =
      '<b>' + (okN + badN) + ' / ' + (okN + badN + blankN + refN) + '</b> 題已作答　' +
      '答對 <b class="g">' + okN + '</b>　答錯 <b class="r">' + badN + '</b>' +
      (refN ? '　參考題 <b>' + refN + '</b>' : '') +
      (autoN ? '　<span class="pc">' + pct + '%</span>' : '');

    var s = document.getElementById('summary');
    if (s) s.remove();
    var box = el('<section class="summary" id="summary"></section>');
    box.innerHTML =
      '<h3>成績</h3><div class="grid">' +
      '<div><span class="k">答對</span><span class="v g">' + okN + '</span></div>' +
      '<div><span class="k">答錯</span><span class="v r">' + badN + '</span></div>' +
      '<div><span class="k">未作答</span><span class="v">' + blankN + '</span></div>' +
      '<div><span class="k">參考／開放題</span><span class="v">' + refN + '</span></div>' +
      '</div><p class="tip">選擇題、填充、配對、重組、標點題會自動批改；造句、擴寫、改寫題答案可有多種寫法，請對照紅色「參考答案」自行檢查。' +
      (badN ? ' 紅色為答錯題目，可修正後再按「對答案」。' : '') + '</p>';
    app.appendChild(box);
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function revealAll() {
    var v = D.volumes[state.vi];
    v.sections.forEach(function (sec, si) {
      var items = sec.kind === 'cloze' ? sec.paragraphs : sec.items;
      items.forEach(function (it, ii) {
        var q = app.querySelector('[data-id="' + qid(v, si, ii) + '"]');
        if (!q) return;
        var kind = sec.kind;
        if (kind === 'wordbank' || kind === 'fill') {
          var ins = q.querySelectorAll('input.blank');
          var tas = q.querySelectorAll('textarea.write');
          var ans = String(it.a);
          if (tas.length) tas[0].value = ans;
          else if (ins.length >= 1) ins[0].value = ans;
        } else if (kind === 'write') {
          var ta = q.querySelector('textarea');
          if (ta && !ta.value.trim()) ta.value = it.a;
        } else if (kind === 'cloze') {
          var i3 = q.querySelectorAll('input.blank');
          Array.prototype.forEach.call(i3, function (x, k) { x.value = it.a[k]; });
        } else if (kind === 'punct') {
          var sels = q.querySelectorAll('select.punct');
          Array.prototype.forEach.call(sels, function (s, k) { s.value = it.a[k]; });
        } else if (kind === 'match') {
          q.querySelector('select').value = it.a;
        } else if (kind === 'choice') {
          var opts = Array.prototype.slice.call(q.querySelectorAll('.choice'));
          opts.forEach(function (b) {
            if (norm(b.textContent.replace(/^[A-J]\.\s*/, '')) === norm(it.a)) b.classList.add('on');
            else b.classList.remove('on');
          });
        }
      });
    });
    // 重組題：顯示答案
    Array.prototype.forEach.call(app.querySelectorAll('.q[data-kind="reorder"]'), function (q) {
      var ans = q.getAttribute('data-ans');
      var old = q.querySelector('.refbox');
      if (old) old.remove();
      q.appendChild(el('<div class="refbox"><b>參考答案：</b>' + esc(ans) + '</div>'));
    });
    state.revealed = true;
    state.graded = true;
    document.getElementById('score').textContent = '已顯示答案（練習模式）';
  }

  function resetVolume() {
    var v = D.volumes[state.vi];
    Object.keys(store).forEach(function (k) {
      if (k.indexOf(v.id + ':') === 0) delete store[k];
    });
    save();
    state.graded = false;
    state.revealed = false;
    renderVolume();
    var s = document.getElementById('summary');
    if (s) s.remove();
  }

  /* ------------------------------------------------------------ 啟動 */
  function init() {
    document.getElementById('stats').innerHTML =
      '<li><b>' + D.volumes.length + '</b> 卷</li>' +
      '<li><b>' + D.total + '</b> 道小題</li>' +
      '<li><b>14</b> 份 Word</li>' +
      '<li>自動批改</li>';
    document.getElementById('footTotal').textContent = D.total;
    var fromUrl = parseInt((location.search.match(/[?&]v=(\d+)/) || [])[1], 10);
    var last = isNaN(fromUrl) ? parseInt(localStorage.getItem('ws-last') || '0', 10) : fromUrl - 1;
    if (isNaN(last) || last < 0 || last >= D.volumes.length) last = 0;
    state.vi = last;
    renderTabs();
    renderVolume();
    var act0 = document.querySelector('.tab.active');
    if (act0 && act0.scrollIntoView) act0.scrollIntoView({ inline: 'center', block: 'nearest' });

    document.getElementById('checkBtn').addEventListener('click', function () { gradeAll(true); });
    document.getElementById('revealBtn').addEventListener('click', revealAll);
    document.getElementById('resetBtn').addEventListener('click', function () {
      if (confirm('清除本卷所有作答？')) resetVolume();
    });
    window.addEventListener('beforeunload', function () {
      try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {}
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
