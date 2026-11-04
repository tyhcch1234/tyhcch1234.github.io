/* 首頁密碼鎖 — 內容以 AES-GCM 加密後才放進 index.html。
 * 只有輸入正確密碼（PBKDF2 派生金鑰）才能解出頁面內容。
 * 使用者按「記住這部裝置」後，金鑰存於 localStorage，下次免再輸入。
 */
(function () {
  'use strict';

  var STORE_KEY = 'tyhcch.hub.key.v1';

  var gate = document.getElementById('lockGate');
  var form = document.getElementById('lockForm');
  var input = document.getElementById('lockPw');
  var errEl = document.getElementById('lockErr');
  var btn = document.getElementById('lockBtn');
  var root = document.getElementById('siteRoot');
  var dataEl = document.getElementById('lockdata');

  if (!gate || !form || !root || !dataEl) return;

  var data;
  try {
    data = JSON.parse(dataEl.textContent);
  } catch (e) {
    errEl.textContent = '頁面資料損壞，請重新載入。';
    return;
  }

  var subtle = window.crypto && window.crypto.subtle;
  var enc = new TextEncoder();

  function b64d(s) {
    var bin = atob(s), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function b64e(buf) {
    var b = new Uint8Array(buf), s = '';
    for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s);
  }

  function deriveKey(pw) {
    return subtle
      .importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveKey'])
      .then(function (base) {
        return subtle.deriveKey(
          { name: 'PBKDF2', salt: b64d(data.salt), iterations: data.iter, hash: 'SHA-256' },
          base,
          { name: 'AES-GCM', length: 256 },
          true,
          ['decrypt']
        );
      });
  }

  function decrypt(key) {
    return subtle.decrypt({ name: 'AES-GCM', iv: b64d(data.iv), tagLength: 128 }, key, b64d(data.ct));
  }

  var currentKey = null;

  // 供 app.js 解密 sites.json（清單檔同樣以密文存放，不以明文出現）
  window.__hubDecryptJSON = function (obj) {
    if (!obj || !obj.ct || !currentKey) return Promise.resolve(obj);
    return subtle
      .decrypt({ name: 'AES-GCM', iv: b64d(obj.iv), tagLength: 128 }, currentKey, b64d(obj.ct))
      .then(function (buf) { return JSON.parse(new TextDecoder().decode(buf)); })
      .catch(function () { return null; });
  };

  function reveal(html, key) {
    currentKey = key;
    root.innerHTML = html;

    // innerHTML 不會執行 <script>，要逐一換成真正的 script 節點（保留 type 等屬性，
    // 所以 type="application/json" 的 seed 只會插入 DOM、不會被執行）。
    var scripts = [].slice.call(root.querySelectorAll('script'));
    scripts.forEach(function (old) {
      var s = document.createElement('script');
      for (var i = 0; i < old.attributes.length; i++) {
        s.setAttribute(old.attributes[i].name, old.attributes[i].value);
      }
      s.text = old.textContent;
      old.parentNode.replaceChild(s, old);
    });

    document.body.classList.remove('locked');
    document.documentElement.classList.remove('locked');
    if (gate.parentNode) gate.parentNode.removeChild(gate);
    if (dataEl.parentNode) dataEl.parentNode.removeChild(dataEl);
  }

  function fail(msg) {
    errEl.textContent = msg;
    errEl.classList.add('show');
    form.classList.remove('busy');
    btn.disabled = false;
    try { input.select(); } catch (e) {}
  }

  function saveKey(key) {
    try {
      return subtle.exportKey('raw', key).then(function (raw) {
        localStorage.setItem(STORE_KEY, b64e(raw));
      });
    } catch (e) {
      return Promise.resolve();
    }
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var pw = input.value;
    if (!pw) return;
    if (!subtle) {
      fail('此瀏覽器不支援解密，請改用較新的瀏覽器。');
      return;
    }
    form.classList.add('busy');
    btn.disabled = true;
    errEl.classList.remove('show');

    deriveKey(pw)
      .then(function (key) {
        return decrypt(key).then(function (buf) {
          reveal(new TextDecoder().decode(buf), key);
          saveKey(key);
        });
      })
      .catch(function () {
        input.value = '';
        fail('密碼不正確，請再試一次。');
      });
  });

  // 同一部裝置已解鎖過：直接用存下的金鑰還原
  (function autoUnlock() {
    if (!subtle) {
      input.focus();
      return;
    }
    var saved = null;
    try { saved = localStorage.getItem(STORE_KEY); } catch (e) {}
    if (!saved) { input.focus(); return; }

    subtle
      .importKey('raw', b64d(saved), { name: 'AES-GCM' }, false, ['decrypt'])
      .then(function (key) {
        return decrypt(key).then(function (buf) { return { key: key, buf: buf }; });
      })
      .then(function (r) { reveal(new TextDecoder().decode(r.buf), r.key); })
      .catch(function () {
        try { localStorage.removeItem(STORE_KEY); } catch (e) {}
        input.focus();
      });
  })();
})();
