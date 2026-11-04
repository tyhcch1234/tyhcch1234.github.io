/* 把 build_index.py 產生的明文 index.html（同 sites.json）轉成「加密 + 密碼鎖」版本。
 *
 * 用法：
 *   node lock_build.mjs [--manifest <sites.json 路徑>] < index.html > index.html.locked
 *   有 --manifest 時，會用同一條金鑰（新 IV）把該檔原地覆寫成密文。
 *
 * 密碼來源（順序）：環境變數 PAGE_PASSWORD → 同目錄 .lockpass（已列入 .gitignore）
 * 密碼本身不會寫進 repo，repo 內只有 salt / iv / 密文。
 */
import { webcrypto as crypto } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ITER = 210000;

function readPassword() {
  const env = (process.env.PAGE_PASSWORD || '').trim();
  if (env) return env;
  try {
    return fs.readFileSync(path.join(HERE, '.lockpass'), 'utf8').trim();
  } catch {
    return '';
  }
}

const b64 = (buf) => Buffer.from(new Uint8Array(buf)).toString('base64');

const manifestArg = (() => {
  const i = process.argv.indexOf('--manifest');
  return i === -1 ? null : process.argv[i + 1];
})();

const password = readPassword();
if (!password) {
  console.error('lock_build: 找不到密碼（請設定 PAGE_PASSWORD 或建立 .lockpass）');
  process.exit(2);
}

const html = fs.readFileSync(0, 'utf8'); // stdin
const headMatch = html.match(/<head>[\s\S]*?<\/head>/i);
const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
if (!headMatch || !bodyMatch) {
  console.error('lock_build: 輸入不是完整的 HTML（找不到 head/body）');
  process.exit(3);
}
if (/id="lockdata"/.test(html)) {
  console.error('lock_build: 輸入已經是加密版，拒絕重複加密');
  process.exit(4);
}

const head = headMatch[0];
const payload = bodyMatch[1];

const enc = new TextEncoder();
const salt = crypto.getRandomValues(new Uint8Array(16));

const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
const key = await crypto.subtle.deriveKey(
  { name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' },
  baseKey,
  { name: 'AES-GCM', length: 256 },
  false,
  ['encrypt']
);

async function seal(text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, enc.encode(text));
  return JSON.stringify({ v: 1, iter: ITER, salt: b64(salt), iv: b64(iv), ct: b64(ct) });
}

// 同一條金鑰加密 sites.json（新 IV），令清單檔都唔會以明文出現
if (manifestArg) {
  const plain = fs.readFileSync(manifestArg, 'utf8');
  JSON.parse(plain); // 先用錯誤中斷，避免寫壞
  fs.writeFileSync(manifestArg, await seal(plain), 'utf8');
}

const data = await seal(payload);

const css = `
  html.locked, body.locked{overflow:hidden}
  .lock-gate{
    position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;
    padding:24px;background:
      radial-gradient(900px 460px at 12% -10%, rgba(79,110,247,.16), transparent 62%),
      radial-gradient(760px 420px at 100% 0%, rgba(139,92,246,.14), transparent 58%),
      #f4f6fb;
  }
  .lock-card{
    width:100%;max-width:360px;background:#fff;border:1px solid #e6e9f2;border-radius:18px;
    box-shadow:0 1px 2px rgba(16,24,40,.04),0 18px 46px rgba(16,24,40,.12);
    padding:26px 24px 22px;text-align:center;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang TC","Microsoft JhengHei","Noto Sans TC",Roboto,Helvetica,Arial,sans-serif;
    color:#171c2b;
  }
  .lock-badge{
    width:44px;height:44px;margin:0 auto 12px;border-radius:14px;
    display:flex;align-items:center;justify-content:center;
    background:linear-gradient(135deg,#4f6ef7,#8b5cf6);color:#fff;font-size:20px;
    box-shadow:0 8px 20px rgba(79,110,247,.28);
  }
  .lock-card h1{font-size:19px;margin:0 0 6px;letter-spacing:.02em}
  .lock-sub{margin:0 0 18px;font-size:13px;color:#6e7688}
  .lock-card input{
    width:100%;box-sizing:border-box;padding:12px 14px;font-size:16px;letter-spacing:.18em;
    border:1px solid #d6dbea;border-radius:12px;background:#fbfcff;color:inherit;outline:none;
    transition:border-color .15s, box-shadow .15s;
  }
  .lock-card input:focus{border-color:#4f6ef7;box-shadow:0 0 0 3px rgba(79,110,247,.16)}
  .lock-card button{
    width:100%;margin-top:12px;padding:12px 14px;font-size:15px;font-weight:600;cursor:pointer;
    border:0;border-radius:12px;color:#fff;background:linear-gradient(135deg,#4f6ef7,#8b5cf6);
    box-shadow:0 8px 22px rgba(79,110,247,.26);
  }
  .lock-card button:disabled{opacity:.65;cursor:default}
  .lock-err{min-height:18px;margin:10px 0 0;font-size:13px;color:#dc2626;opacity:0;transition:opacity .15s}
  .lock-err.show{opacity:1}
  .lock-note{margin:14px 0 0;font-size:11.5px;color:#8b93a7;line-height:1.5}
  @media (prefers-color-scheme: dark){
    .lock-gate{background:
      radial-gradient(900px 460px at 12% -10%, rgba(79,110,247,.20), transparent 62%),
      radial-gradient(760px 420px at 100% 0%, rgba(139,92,246,.18), transparent 58%),
      #0d1017;}
    .lock-card{background:#161b24;border-color:#242c39;color:#e9edf7;box-shadow:0 18px 46px rgba(0,0,0,.5)}
    .lock-sub{color:#8b93a7}
    .lock-card input{background:#1a202b;border-color:#2f3847}
  }
`;

const out = `<!DOCTYPE html>
<html lang="zh-Hant" class="locked">
${head.replace('</head>', `<style>${css}</style>\n</head>`)}
<body class="locked">

<div id="lockGate" class="lock-gate">
  <form id="lockForm" class="lock-card" autocomplete="off" novalidate>
    <div class="lock-badge" aria-hidden="true">&#128274;</div>
    <h1>請輸入密碼</h1>
    <p class="lock-sub">此頁只供指定人士瀏覽</p>
    <input id="lockPw" type="password" inputmode="numeric" autocomplete="current-password"
           placeholder="密碼" aria-label="密碼" required>
    <button id="lockBtn" type="submit">進入</button>
    <p id="lockErr" class="lock-err" role="alert"></p>
    <p class="lock-note">解鎖後會記住這部裝置，下次毋須再輸入。</p>
  </form>
</div>

<div id="siteRoot"></div>

<noscript>
  <div class="lock-gate"><div class="lock-card"><h1>需要啟用 JavaScript</h1>
  <p class="lock-sub">此頁以密碼加密，請開啟 JavaScript 後重新載入。</p></div></div>
</noscript>

<script id="lockdata" type="application/json">${data}</script>
<script src="lock.js?v=1"></script>
</body>
</html>
`;

process.stdout.write(out);
