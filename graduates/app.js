/* 香港大學畢業生出路。數據在 data.json，圖表用本機 Chart.js。 */
(function () {
  "use strict";

  const nf = new Intl.NumberFormat("zh-HK");
  const state = { tab: "overview", level: "ug", uni: "all", year: "all", jobQ: "" };
  const charts = {};
  const sortState = {};
  let DATA = null;

  const $ = (sel, root) => (root || document).querySelector(sel);
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  const SIT_COLOR = {
    light: { ft: "#0c7a6e", under: "#b8860b", unemp: "#b23b32", further: "#1d4e89", other: "#8d8478" },
    dark: { ft: "#7ddecb", under: "#f0c36a", unemp: "#f0a198", further: "#9ec3ef", other: "#d5cdc2" },
  };
  const DISC_COLOR = {
    light: ["#c2410c", "#0b6e99", "#0f7a5a", "#a16207", "#9d174d", "#5b3f8c", "#1e4e8c"],
    dark: ["#fdba74", "#7dd3fc", "#6ee7b7", "#fcd34d", "#f9a8d4", "#d8b4fe", "#93c5fd"],
  };
  const UNI_COLOR = {
    light: ["#0f766e", "#b45309", "#7c3aed", "#1d4ed8", "#be123c", "#0369a1", "#3f6212", "#9a3412"],
    dark: ["#5eead4", "#fdba74", "#d8b4fe", "#93c5fd", "#fda4af", "#7dd3fc", "#bef264", "#fdba74"],
  };

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }
  function fmt(n) {
    return n == null || Number.isNaN(n) ? "—" : nf.format(Math.round(n));
  }
  function fmt1(n) {
    if (n == null || Number.isNaN(n)) return "—";
    return n.toLocaleString("zh-HK", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }
  function money(n) {
    if (n == null || Number.isNaN(n)) return "—";
    const digits = Number.isInteger(n) ? 0 : 2;
    return "HK$" + n.toLocaleString("zh-HK", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }
  function pct(a, b) {
    return b ? (a / b) * 100 : null;
  }
  function uniq(list) {
    return [...new Set(list)].sort();
  }
  function sum(rows, key) {
    return rows.reduce((a, r) => a + (r[key] || 0), 0);
  }
  function themeMode() {
    return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  }
  function uniName(id) {
    const u = DATA.unis.find((x) => x.id === id);
    return u ? u.zh : id;
  }
  function uniShort(id) {
    const u = DATA.unis.find((x) => x.id === id);
    return u ? u.short : id;
  }
  function discName(id) {
    const d = DATA.disciplines.find((x) => x.id === id);
    return d ? d.zh : id;
  }
  function occName(id) {
    const o = DATA.occupations.find((x) => x.id === id);
    return o ? o.zh : id;
  }
  function sitName(id) {
    const s = DATA.situations.find((x) => x.id === id);
    return s ? s.zh : id;
  }

  function filteredEmp() {
    return DATA.employment.filter(([y, u, l]) =>
      l === state.level &&
      (state.uni === "all" || u === state.uni) &&
      (state.year === "all" || y === state.year));
  }
  function filteredSal() {
    return DATA.salaries.filter(([y, l]) =>
      l === state.level && (state.year === "all" || y === state.year));
  }
  function filteredUaa() {
    return DATA.uaa.filter((r) =>
      (state.uni === "all" || r.uni === state.uni) &&
      (state.year === "all" || r.year === state.year));
  }
  function sumSit(rows) {
    const o = { ft: 0, under: 0, unemp: 0, further: 0, other: 0 };
    for (const r of rows) o[r[3]] += r[5];
    return o;
  }

  function baseScales(extra) {
    const ink = css("--muted") || "#5c564c";
    const grid = css("--grid") || "rgba(0,0,0,.08)";
    const scales = {
      x: { ticks: { color: ink, maxRotation: 0, autoSkip: true }, grid: { color: grid } },
      y: { ticks: { color: ink }, grid: { color: grid }, beginAtZero: true },
    };
    return Object.assign(scales, extra || {});
  }
  function basePlugins(title) {
    const ink = css("--ink") || "#1c1915";
    return {
      legend: { labels: { color: ink, boxWidth: 12, font: { size: 12 }, padding: 12 } },
      title: title ? { display: true, text: title, color: ink, font: { size: 13, weight: "600" } } : { display: false },
      tooltip: { mode: "index", intersect: false },
    };
  }
  function anim() {
    return matchMedia("(prefers-reduced-motion: reduce)").matches ? false : { duration: 380 };
  }
  function mount(id, config) {
    const el = document.getElementById(id);
    if (!el || typeof Chart === "undefined") return;
    if (charts[id]) charts[id].destroy();
    el.hidden = false;
    const note = el.parentElement.querySelector(".empty");
    if (note) note.hidden = true;
    charts[id] = new Chart(el, config);
  }
  function blank(id, message) {
    const el = document.getElementById(id);
    if (!el) return;
    if (charts[id]) { charts[id].destroy(); delete charts[id]; }
    el.hidden = true;
    let note = el.parentElement.querySelector(".empty");
    if (!note) {
      note = document.createElement("p");
      note.className = "empty";
      el.parentElement.appendChild(note);
    }
    note.hidden = false;
    note.textContent = message;
  }

  function renderTable(host, id, caption, columns, rows, initial) {
    if (!rows.length) {
      host.innerHTML = '<p class="empty">這個篩選沒有對應數字。</p>';
      return;
    }
    if (!sortState[id]) {
      sortState[id] = initial || { key: columns[0].key, dir: columns[0].num ? "desc" : "asc" };
    }
    const st = sortState[id];
    const sorted = rows.slice().sort((a, b) => {
      const va = a[st.key];
      const vb = b[st.key];
      const emptyA = va == null || va === "";
      const emptyB = vb == null || vb === "";
      if (emptyA && emptyB) return 0;
      if (emptyA) return 1;
      if (emptyB) return -1;
      let cmp;
      if (typeof va === "number" && typeof vb === "number") cmp = va - vb;
      else cmp = String(va).localeCompare(String(vb), "zh-Hant");
      return st.dir === "asc" ? cmp : -cmp;
    });
    const head = columns.map((c) => {
      const aria = st.key === c.key ? ` aria-sort="${st.dir === "asc" ? "ascending" : "descending"}"` : "";
      return `<th class="${c.left ? "left" : ""}" scope="col"${aria}><button type="button" class="sort" data-key="${esc(c.key)}" data-num="${c.num ? "1" : "0"}">${esc(c.label)}</button></th>`;
    }).join("");
    const body = sorted.map((row) => {
      const tds = columns.map((c) => {
        const raw = row[c.key];
        const text = c.fmt ? c.fmt(raw, row) : (raw == null ? "—" : esc(raw));
        return `<td class="${c.left ? "left" : ""}">${text}</td>`;
      }).join("");
      return `<tr>${tds}</tr>`;
    }).join("");
    host.innerHTML = `<div class="table-wrap"><table><caption>${esc(caption)}</caption><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
    host.querySelectorAll("button.sort").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.key;
        if (st.key === key) st.dir = st.dir === "asc" ? "desc" : "asc";
        else {
          st.key = key;
          st.dir = btn.dataset.num === "1" ? "desc" : "asc";
        }
        renderTable(host, id, caption, columns, rows, initial);
      });
    });
  }

  function fillSelects() {
    const level = $("#f-level");
    level.innerHTML = DATA.levels.map((l) => `<option value="${l.id}">${esc(l.zh)}</option>`).join("");
    level.value = "ug";
    const uni = $("#f-uni");
    uni.insertAdjacentHTML("beforeend", DATA.unis.map((u) =>
      `<option value="${u.id}">${esc(u.zh)} ${esc(u.code)}</option>`).join(""));
    const year = $("#f-year");
    const years = uniq([].concat(DATA.meta.salaryYears, DATA.meta.employmentYears, DATA.meta.uaaYears));
    year.insertAdjacentHTML("beforeend", years.map((y) => `<option value="${y}">${y}</option>`).join(""));
  }

  function renderFilterNote() {
    const el = $("#filter-note");
    const bits = [];
    if (state.uni !== "all" && (state.tab === "overview" || state.tab === "salary")) {
      bits.push("平均年薪沒有院校分列，薪酬圖仍是該修課程度的全港學科平均。");
    }
    if (state.year === "2023/24" || state.year === "2024/25") {
      bits.push("所選學年有薪酬" + (state.year === "2023/24" ? "和問責協議" : "") + "。開放數據的職業與去向人數只到 2022/23。");
    }
    if (state.level !== "ug") bits.push("問責協議的就業比例只涵蓋學士，圖表不會改用其他修課程度。");
    if (!bits.length) bits.push("院校次序依教資會數據字典，不是排名。");
    el.textContent = bits.join(" ");
  }

  function renderOverview() {
    const sal = filteredSal();
    const salYears = uniq(sal.map((r) => r[0]));
    const y = salYears.at(-1);
    const at = sal.filter((r) => r[0] === y).slice().sort((a, b) => b[3] - a[3]);
    const high = at[0];
    const low = at[at.length - 1];
    const emp = filteredEmp();
    const sums = sumSit(emp);
    const seek = sums.ft + sums.under + sums.unemp;
    const known = seek + sums.further + sums.other;
    const uaa = state.level === "ug" ? filteredUaa() : [];
    const uaaYears = uniq(uaa.map((r) => r.year));
    const uaaYear = uaaYears.at(-1);
    const uaaAt = uaa.filter((r) => r.year === uaaYear);
    const seeking = sum(uaaAt, "seeking");
    const employed = sum(uaaAt, "employed");
    const ft = sum(uaaAt, "ft");

    const cards = [];
    if (high) {
      cards.push(kpi(`${y} 最高學科年薪`, money(high[3] * 1000), discName(high[2]) + " · 全職就業平均"));
      cards.push(kpi(`${y} 最低學科年薪`, money(low[3] * 1000), discName(low[2]) + " · 同一來源"));
    }
    if (emp.length) {
      const ys = uniq(emp.map((r) => r[0]));
      const span = ys.length === 1 ? ys[0] : ys[0] + "–" + ys.at(-1) + " 合計";
      cards.push(kpi("尋求就業人士的就業比例", fmt1(pct(sums.ft + sums.under, seek)) + "%", span + " · 開放數據 · 全職 " + fmt(sums.ft) + " 人"));
    } else {
      cards.push(kpi("就業人數", "—", "開放數據沒有這個學年的去向人數"));
    }
    if (uaaAt.length) {
      cards.push(kpi(uaaYear + " 就業比例", fmt1(pct(employed, seeking)) + "%", "問責協議 · 全職比例 " + fmt1(pct(ft, seeking)) + "%"));
    } else if (cards.length < 4) {
      cards.push(kpi("問責協議", "—", "所選範圍沒有學士就業比例"));
    }
    $("#kpis").innerHTML = cards.join("");

    const parts = [];
    if (state.level === "ug" && state.year === "all" && state.uni === "all" && salYears.length) {
      const med0 = sal.find((r) => r[0] === salYears[0] && r[2] === "mdh");
      const med1 = sal.find((r) => r[0] === y && r[2] === "mdh");
      const arts0 = sal.find((r) => r[0] === salYears[0] && r[2] === "arts");
      const arts1 = sal.find((r) => r[0] === y && r[2] === "arts");
      if (med0 && med1) {
        parts.push(`學士「醫科、牙科及護理」的全職平均年薪，由 ${salYears[0]} 的 ${money(med0[3] * 1000)} 增至 ${y} 的 ${money(med1[3] * 1000)}。`);
      }
      if (arts0 && arts1) {
        parts.push(`「文科及人文學科」同期由 ${money(arts0[3] * 1000)} 增至 ${money(arts1[3] * 1000)}。`);
      }
      const eduRows = sal.filter((r) => r[2] === "edu");
      const eduPeak = eduRows.slice().sort((a, b) => b[3] - a[3])[0];
      const eduNow = sal.find((r) => r[0] === y && r[2] === "edu");
      if (eduPeak && eduNow && eduPeak[0] !== y) {
        parts.push(`教育學科在 ${eduPeak[0]} 為 ${money(eduPeak[3] * 1000)}，${y} 是 ${money(eduNow[3] * 1000)}。`);
      }
    } else if (high) {
      parts.push(`${y} 在目前篩選下，最高是${discName(high[2])}（${money(high[3] * 1000)}），最低是${discName(low[2])}（${money(low[3] * 1000)}）。`);
    }
    if (state.level === "ug" && (state.year === "all" || state.year === "2023/24")) {
      parts.push("教資會 2025 年小冊子寫明，2023/24 全日制資助學士的平均薪酬是 HK$329,000。這是整體數字，七個學科沒有在本頁被平均成這個數。");
    }
    if (emp.length) {
      const ys = uniq(emp.map((r) => r[0]));
      const span = ys.length === 1 ? ys[0] : ys[0] + " 至 " + ys.at(-1) + " 合計";
      parts.push(`${span}，已知去向 ${fmt(known)} 人，其中全職 ${fmt(sums.ft)} 人、升學 ${fmt(sums.further)} 人、失業 ${fmt(sums.unemp)} 人。尋求就業人士的就業比例是 ${fmt1(pct(sums.ft + sums.under, seek))}%，全職比例是 ${fmt1(pct(sums.ft, seek))}%。`);
    } else {
      parts.push("目前篩選沒有教資會開放數據的去向人數。該檔最新學年是 2022/23。");
    }
    if (uaaAt.length) {
      const who = state.uni === "all" ? "八校人數相加" : uniShort(state.uni);
      parts.push(`${uaaYear} 大學問責協議（${who}）：尋求就業的學士當中，${fmt1(pct(employed, seeking))}% 已就業，${fmt1(pct(ft, seeking))}% 為全職。`);
    }
    $("#lead").innerHTML = parts.map((p) => `<p>${esc(p)}</p>`).join("");

    $("#read3").innerHTML = [
      ["學科年薪", "可跨學年比較，來源沒有大學這一欄。2024/25 已公布。"],
      ["去向與職業人數", "可按院校比較。開放數據收到 2022/23。其後的空格是未公布，不是零。"],
      ["就業比例", "問責協議用同一條定義，收到 2023/24，只有學士，沒有薪酬。"],
    ].map(([h, p]) => `<article><h3>${h}</h3><p>${p}</p></article>`).join("");
  }

  function kpi(label, value, sub) {
    return `<article class="kpi"><p class="label">${esc(label)}</p><p class="value">${esc(value)}</p><p class="sub">${esc(sub)}</p></article>`;
  }

  function renderSalary() {
    const sal = filteredSal();
    const years = uniq(sal.map((r) => r[0]));
    const level = DATA.levels.find((l) => l.id === state.level);
    $("#sal-blurb").textContent = (level ? level.zh : "") + " · 已全職工作畢業生 · 年薪包括佣金及現金津貼。來源以港幣千元整數公布，圖上已乘 1,000。" +
      (years.length ? " 學年 " + years[0] + " 至 " + years.at(-1) + "。" : "");
    const head = DATA.meta.headlineSalary;
    const showHead = state.level === "ug" && (state.year === "all" || state.year === head.year);
    $("#sal-headline").hidden = !showHead;
    $("#sal-headline").innerHTML = showHead
      ? `<strong>${esc(head.year)} 整體平均 ${money(head.annualHkd)}</strong>。${esc(head.text)}。見教資會 2025 年小冊子，不是由下方七科相加或平均得出。`
      : "";
    const rows = sal.map(([y, , d, v]) => ({
      year: y,
      disc: discName(d),
      annual: v * 1000,
      monthly: Math.round((v * 1000) / 12),
    }));
    renderTable($("#sal-table"), "sal", "平均年薪", [
      { key: "year", label: "學年", left: true },
      { key: "disc", label: "主要學科", left: true },
      { key: "annual", label: "平均年薪", num: true, fmt: (v) => money(v) },
      { key: "monthly", label: "年薪 ÷ 12", num: true, fmt: (v) => money(v) },
    ], rows);
  }

  function renderEmployment() {
    const rows = filteredEmp();
    const years = uniq(rows.map((r) => r[0]));
    $("#emp-blurb").textContent = rows.length
      ? "人數是開放數據各職業列的直接相加。學年 " + years[0] + (years.length > 1 ? " 至 " + years.at(-1) : "") + "。"
      : "開放數據的去向人數收到 2022/23。";
    const grouped = new Map();
    for (const [y, u, , s, , n] of rows) {
      const k = y + "|" + u;
      if (!grouped.has(k)) grouped.set(k, { year: y, uni: uniName(u), ft: 0, under: 0, unemp: 0, further: 0, other: 0 });
      grouped.get(k)[s] += n;
    }
    const tableRows = [...grouped.values()].map((r) => {
      const seek = r.ft + r.under + r.unemp;
      return Object.assign(r, {
        known: seek + r.further + r.other,
        empRate: pct(r.ft + r.under, seek),
        ftRate: pct(r.ft, seek),
      });
    });
    renderTable($("#emp-table"), "emp", "按院校及學年的去向人數", [
      { key: "uni", label: "院校", left: true },
      { key: "year", label: "學年", left: true },
      { key: "ft", label: "全職", num: true, fmt: fmt },
      { key: "under", label: "就業不足", num: true, fmt: fmt },
      { key: "unemp", label: "失業", num: true, fmt: fmt },
      { key: "further", label: "升學", num: true, fmt: fmt },
      { key: "other", label: "其他", num: true, fmt: fmt },
      { key: "known", label: "已知去向", num: true, fmt: fmt },
      { key: "empRate", label: "就業比例", num: true, fmt: (v) => fmt1(v) + "%" },
      { key: "ftRate", label: "全職比例", num: true, fmt: (v) => fmt1(v) + "%" },
    ], tableRows);
  }

  function renderOccupation() {
    const rows = filteredEmp().filter((r) => r[3] === "ft" && r[4] !== "notft");
    const years = uniq(rows.map((r) => r[0]));
    let occBlurb = rows.length
      ? "只計全職就業，並略去「非全職就業」這個佔位類別。學年 " + years[0] + (years.length > 1 ? " 至 " + years.at(-1) : "") + "。"
      : "這個篩選沒有全職職業人數。";
    const norepN = rows.filter((r) => r[4] === "norep").reduce((a, r) => a + r[5], 0);
    const ftN = rows.reduce((a, r) => a + r[5], 0);
    if (ftN && norepN / ftN >= 0.1) {
      occBlurb += "「未有提供資料」佔 " + fmt1(pct(norepN, ftN)) + "%，這是來源裡的分類，不是本頁把職業漏掉。";
    }
    $("#occ-blurb").textContent = occBlurb;
    const map = new Map();
    for (const r of rows) map.set(r[4], (map.get(r[4]) || 0) + r[5]);
    const total = [...map.values()].reduce((a, b) => a + b, 0);
    const tableRows = [...map.entries()].map(([id, n]) => ({
      occ: occName(id), n, share: pct(n, total),
    }));
    renderTable($("#occ-table"), "occ", "全職就業人數按職業", [
      { key: "occ", label: "職業", left: true },
      { key: "n", label: "人數", num: true, fmt: fmt },
      { key: "share", label: "佔全職", num: true, fmt: (v) => fmt1(v) + "%" },
    ], tableRows, { key: "n", dir: "desc" });
  }

  function renderUaa() {
    const rows = filteredUaa();
    const note = $("#uaa-level-note");
    note.textContent = state.level === "ug"
      ? "縱軸由 70% 起，方便看出高位附近的差別。圖下留有完整人數。"
      : "上方的修課程度不是學士。這張圖仍只顯示學士，因為 PM 1.2 沒有其他修課程度。";
    let extra = "";
    if (state.uni === "all" && (state.year === "all" || state.year === "2023/24")) {
      const moves = DATA.unis.map((u) => {
        const series = DATA.uaa.filter((r) => r.uni === u.id).sort((a, b) => a.year.localeCompare(b.year));
        if (series.length < 2) return null;
        const a = series.at(-2);
        const b = series.at(-1);
        return { u, d: pct(b.ft, b.seeking) - pct(a.ft, a.seeking), a, b };
      }).filter(Boolean).sort((x, y) => x.d - y.d);
      const drop = moves[0];
      const rise = moves.at(-1);
      if (drop && drop.d <= -3) {
        extra += `${drop.u.short}的全職比例由 ${drop.a.year} 的 ${fmt1(pct(drop.a.ft, drop.a.seeking))}% 降至 ${drop.b.year} 的 ${fmt1(pct(drop.b.ft, drop.b.seeking))}%。`;
      }
      const hkbu = DATA.uaa.filter((r) => r.uni === "hkbu").sort((a, b) => a.year.localeCompare(b.year));
      if (hkbu.length === 3) {
        extra += ` 浸大全職比例在 ${hkbu[1].year} 為 ${fmt1(pct(hkbu[1].ft, hkbu[1].seeking))}%，${hkbu[2].year} 為 ${fmt1(pct(hkbu[2].ft, hkbu[2].seeking))}%。`;
      }
      if (rise && rise.d >= 3 && rise.u.id !== "hkbu") {
        extra += ` ${rise.u.short}由 ${rise.a.year} 的 ${fmt1(pct(rise.a.ft, rise.a.seeking))}% 升至 ${rise.b.year} 的 ${fmt1(pct(rise.b.ft, rise.b.seeking))}%。`;
      }
    }
    if (extra) note.textContent += " " + extra;

    const tableRows = rows.map((r) => ({
      uni: uniName(r.uni),
      year: r.year,
      graduates: r.graduates,
      responded: r.responded,
      responseRate: pct(r.responded, r.graduates),
      seeking: r.seeking,
      employed: r.employed,
      ft: r.ft,
      further: r.further,
      emigrated: r.emigrated,
      empRate: pct(r.employed, r.seeking),
      ftRate: pct(r.ft, r.seeking),
    }));
    renderTable($("#uaa-table"), "uaa", "大學問責協議 PM 1.2", [
      { key: "uni", label: "院校", left: true },
      { key: "year", label: "學年", left: true },
      { key: "graduates", label: "畢業生", num: true, fmt: fmt },
      { key: "responded", label: "回應", num: true, fmt: fmt },
      { key: "responseRate", label: "回應率", num: true, fmt: (v) => fmt1(v) + "%" },
      { key: "seeking", label: "尋求就業", num: true, fmt: fmt },
      { key: "employed", label: "已就業", num: true, fmt: fmt },
      { key: "ft", label: "全職", num: true, fmt: fmt },
      { key: "further", label: "升學", num: true, fmt: fmt },
      { key: "emigrated", label: "離港或回流", num: true, fmt: fmt },
      { key: "empRate", label: "就業比例", num: true, fmt: (v) => fmt1(v) + "%" },
      { key: "ftRate", label: "全職比例", num: true, fmt: (v) => fmt1(v) + "%" },
    ], tableRows);
  }

  function renderCampus() {
    const root = $("#campus-root");
    const list = DATA.campus.filter((c) => state.uni === "all" || c.id === state.uni);
    root.innerHTML = `<div class="campus-grid">${list.map(campusCard).join("")}</div>`;
    const q = $("#job-q");
    if (q) {
      q.value = state.jobQ || "";
      q.addEventListener("input", () => {
        state.jobQ = q.value;
        fillJobs();
      });
      fillJobs();
    }
  }

  function campusCard(c) {
    if (c.gap) {
      return `<article class="card campus-card"><h2>${esc(c.title)}</h2><p class="empty">${esc(c.gap)}</p></article>`;
    }
    if (c.id === "hku") return hkuCard(c);
    if (c.id === "cuhk") return cuhkCard(c);
    if (c.id === "polyu") return polyuCard(c);
    if (c.id === "hkbu") return hkbuCard(c);
    if (c.id === "eduhk") return eduhkCard(c);
    return "";
  }
  function notesHtml(notes) {
    return `<ul class="notes">${notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>`;
  }
  function hkuCard(c) {
    const rows = c.series.map((r) =>
      `<tr><td class="left">${r.cohort}</td><td>${money(r.avg)}</td><td>${money(r.median)}</td><td>${r.employmentRate != null ? fmt1(r.employmentRate) + "%" : "—"}</td><td>${fmt1(r.employedPct)}%</td><td>${fmt1(r.furtherPct)}%</td></tr>`).join("");
    return `<article class="card campus-card"><h2>${esc(c.title)}</h2><p>${esc(c.definition)}</p>
      <div class="chart-box"><canvas id="chart-hku" role="img" aria-label="港大平均與中位月薪"></canvas></div>
      <div class="table-wrap"><table><caption>港大學士每月總薪酬與去向</caption><thead><tr><th class="left">畢業年份</th><th>平均</th><th>中位數</th><th>就業率</th><th>已就業佔回應</th><th>升學佔回應</th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="chart-box"><canvas id="chart-hku-sec" role="img" aria-label="港大就業行業比例"></canvas></div>
      ${notesHtml(c.notes)}</article>`;
  }
  function cuhkCard(c) {
    const rows = c.status.map((r) =>
      `<tr><td class="left">${r.cohort}</td><td>${fmt(r.graduates)}</td><td>${fmt1(r.responseRate)}%</td><td>${fmt1(r.engaged)}%</td><td>${fmt1(r.further)}%</td><td>${fmt1(r.seeking)}%</td><td>${fmt1(r.others)}%</td></tr>`).join("");
    const med = c.median2022.map((r) => `<tr><td class="left">${esc(r.name)}</td><td>${money(r.median)}</td></tr>`).join("");
    const fields = c.fields2024.map((r) => `<tr><td class="left">${esc(r.name)}</td><td>${fmt1(r.share)}%</td></tr>`).join("");
    return `<article class="card campus-card"><h2>${esc(c.title)}</h2><p>${esc(c.definition)}</p>
      <div class="chart-box"><canvas id="chart-cuhk" role="img" aria-label="中大畢業生現況"></canvas></div>
      <div class="table-wrap"><table><caption>中大首個學位現況（包括內外全科醫學士）</caption><thead><tr><th class="left">畢業年份</th><th>畢業生</th><th>回應率</th><th>在職</th><th>升學</th><th>尋找工作</th><th>其他</th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="chart-box"><canvas id="chart-cuhk-sec" role="img" aria-label="中大就業行業"></canvas></div>
      <div class="grid-2">
        <div class="table-wrap"><table><caption>2022 年薪酬中位數（不包括內外全科醫學士，亦不計香港以外工作）</caption><thead><tr><th class="left">行業</th><th>中位數</th></tr></thead><tbody>${med}</tbody></table></div>
        <div class="table-wrap"><table><caption>2024 年主要職業範疇（不是完整分布）</caption><thead><tr><th class="left">範疇</th><th>佔比</th></tr></thead><tbody>${fields}</tbody></table></div>
      </div>
      ${notesHtml(c.notes)}</article>`;
  }
  function polyuCard(c) {
    const rows = c.series.map((r) =>
      `<tr><td class="left">${r.cohort}</td><td>${money(r.avg)}</td><td>${fmt(r.ftCount)}</td><td>${r.employmentRate != null ? fmt1(r.employmentRate) + "%" : "—"}</td></tr>`).join("");
    const ann = c.uaaAnnual.map((r) => `<tr><td class="left">${r.year}</td><td>${money(r.annual)}</td><td>${money(Math.round(r.annual / 12))}</td></tr>`).join("");
    return `<article class="card campus-card"><h2>${esc(c.title)}</h2><p>${esc(c.definition)}</p>
      <div class="chart-box"><canvas id="chart-polyu" role="img" aria-label="理大平均月薪"></canvas></div>
      <div class="table-wrap"><table><caption>學位課程全職受僱者的平均月薪</caption><thead><tr><th class="left">調查年份</th><th>平均月薪</th><th>全職人數</th><th>就業率</th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="table-wrap"><table><caption>問責協議 KPI：教資會資助學士全職工作的平均年薪</caption><thead><tr><th class="left">學年</th><th>平均年薪</th><th>年薪 ÷ 12</th></tr></thead><tbody>${ann}</tbody></table></div>
      <div class="chart-box"><canvas id="chart-polyu-sec" role="img" aria-label="理大行業平均月薪"></canvas></div>
      ${notesHtml(c.notes)}</article>`;
  }
  function hkbuCard(c) {
    return `<article class="card campus-card"><h2>${esc(c.title)} <span class="tag">教資會資助</span></h2><p>${esc(c.definition)}</p>
      <div class="chart-box"><canvas id="chart-hkbu" role="img" aria-label="浸大平均與中位月薪"></canvas></div>
      <div class="chart-box"><canvas id="chart-hkbu-sec" role="img" aria-label="浸大就業行業比例"></canvas></div>
      <h3>職位平均月薪</h3>
      <label class="sr" for="job-q">搜尋職位</label>
      <input id="job-q" class="search" type="search" placeholder="搜尋職位，例如教學、金融" value="${esc(state.jobQ || "")}">
      <div id="job-table"></div>
      ${notesHtml(c.notes)}</article>`;
  }
  function eduhkCard(c) {
    return `<article class="card campus-card"><h2>${esc(c.title)}</h2><p>${esc(c.definition)}</p>
      <div class="chart-box"><canvas id="chart-eduhk" role="img" aria-label="教大入職月薪"></canvas></div>
      ${notesHtml(c.notes)}</article>`;
  }
  function fillJobs() {
    const host = $("#job-table");
    const c = DATA.campus.find((x) => x.id === "hkbu");
    if (!host || !c || !c.jobs) return;
    const q = (state.jobQ || "").trim();
    const rows = c.jobs.filter((j) => !q || j.name.includes(q)).map((j) => ({
      name: j.name, y2023: j.y2023, y2024: j.y2024,
    }));
    renderTable(host, "jobs", "浸大教資會資助學士，按職位的平均月薪", [
      { key: "name", label: "職位", left: true },
      { key: "y2023", label: "2023", num: true, fmt: money },
      { key: "y2024", label: "2024", num: true, fmt: money },
    ], rows);
  }

  function sectorChart(canvasId, sectors, valueKey, title) {
    const names = uniq(sectors.map((s) => s.name));
    const cohorts = uniq(sectors.map((s) => String(s.cohort)));
    const colors = DISC_COLOR[themeMode()];
    mount(canvasId, {
      type: "bar",
      data: {
        labels: names,
        datasets: cohorts.map((cohort, i) => ({
          label: cohort,
          data: names.map((name) => {
            const row = sectors.find((s) => s.name === name && String(s.cohort) === cohort);
            return row ? row[valueKey] : null;
          }),
          backgroundColor: colors[i % colors.length],
        })),
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: anim(),
        plugins: basePlugins(title),
        scales: baseScales(),
      },
    });
  }

  function renderCharts() {
    requestAnimationFrame(() => {
      if (!DATA || typeof Chart === "undefined") return;
      const tab = state.tab;
      if (tab === "overview") { drawSalary("chart-sal-ov", true); drawSituation("chart-sit-ov"); }
      if (tab === "salary") drawSalary("chart-sal", false);
      if (tab === "employment") drawSituation("chart-sit");
      if (tab === "occupation") drawOccupation();
      if (tab === "uaa") drawUaa();
      if (tab === "campus") drawCampus();
    });
  }

  function drawSalary(id, compact) {
    const sal = filteredSal();
    if (!sal.length) { blank(id, "這個篩選沒有平均年薪。"); return; }
    const years = uniq(sal.map((r) => r[0]));
    const colors = DISC_COLOR[themeMode()];
    if (years.length === 1) {
      const items = sal.slice().sort((a, b) => b[3] - a[3]);
      mount(id, {
        type: "bar",
        data: {
          labels: items.map((r) => discName(r[2])),
          datasets: [{
            label: years[0] + " 平均年薪",
            data: items.map((r) => r[3] * 1000),
            backgroundColor: items.map((_, i) => colors[i % colors.length]),
          }],
        },
        options: {
          indexAxis: "y", responsive: true, maintainAspectRatio: false, animation: anim(),
          plugins: basePlugins("港幣千元"),
          scales: baseScales({
            x: { ticks: { color: css("--muted"), callback: (v) => nf.format(v / 1000) + "千" }, grid: { color: css("--grid") } },
          }),
        },
      });
      return;
    }
    mount(id, {
      type: "line",
      data: {
        labels: years,
        datasets: DATA.disciplines.map((d, i) => ({
          label: compact ? d.zh.replace("醫科、牙科及護理", "醫牙護") : d.zh,
          data: years.map((y) => {
            const row = sal.find((r) => r[0] === y && r[2] === d.id);
            return row ? row[3] * 1000 : null;
          }),
          borderColor: colors[i],
          backgroundColor: colors[i],
          pointRadius: 3,
          tension: 0.2,
          spanGaps: false,
        })),
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: anim(),
        plugins: Object.assign(basePlugins("港幣千元"), {
          tooltip: {
            callbacks: {
              label(ctx) {
                const v = ctx.parsed.y;
                return ctx.dataset.label + "：" + money(v) + "（÷12 為 " + money(Math.round(v / 12)) + "）";
              },
            },
          },
        }),
        scales: baseScales({
          y: {
            ticks: { color: css("--muted"), callback: (v) => nf.format(v / 1000) + "千" },
            grid: { color: css("--grid") },
            beginAtZero: false,
          },
        }),
      },
    });
  }

  function drawSituation(id) {
    const rows = filteredEmp();
    if (!rows.length) { blank(id, "開放數據沒有這個篩選的去向人數。最新學年是 2022/23。"); return; }
    const years = uniq(rows.map((r) => r[0]));
    const colors = SIT_COLOR[themeMode()];
    const order = ["ft", "under", "unemp", "further", "other"];
    mount(id, {
      type: "bar",
      data: {
        labels: years,
        datasets: order.map((sid) => ({
          label: sitName(sid),
          data: years.map((y) => rows.filter((r) => r[0] === y && r[3] === sid).reduce((a, r) => a + r[5], 0)),
          backgroundColor: colors[sid],
          stack: "s",
        })),
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: anim(),
        plugins: basePlugins("人數"),
        scales: baseScales({ x: { stacked: true, ticks: { color: css("--muted") }, grid: { display: false } }, y: { stacked: true, ticks: { color: css("--muted") }, grid: { color: css("--grid") }, beginAtZero: true } }),
      },
    });
  }

  function drawOccupation() {
    const rows = filteredEmp().filter((r) => r[3] === "ft" && r[4] !== "notft");
    if (!rows.length) { blank("chart-occ", "這個篩選沒有全職職業人數。"); return; }
    const years = uniq(rows.map((r) => r[0]));
    const bucket = {};
    const tot = {};
    for (const [y, , , , o, n] of rows) {
      tot[y] = (tot[y] || 0) + n;
      bucket[y + "|" + o] = (bucket[y + "|" + o] || 0) + n;
    }
    const colors = DISC_COLOR[themeMode()];
    if (years.length === 1) {
      const items = [...Object.entries(bucket)].map(([k, n]) => ({ name: occName(k.split("|")[1]), n }))
        .sort((a, b) => b.n - a.n);
      const top = items.slice(0, 12);
      const rest = items.slice(12).reduce((a, r) => a + r.n, 0);
      if (rest) top.push({ name: "其餘職業合計", n: rest });
      mount("chart-occ", {
        type: "bar",
        data: {
          labels: top.map((r) => r.name),
          datasets: [{ label: years[0] + " 全職人數", data: top.map((r) => r.n), backgroundColor: colors[0] }],
        },
        options: {
          indexAxis: "y", responsive: true, maintainAspectRatio: false, animation: anim(),
          plugins: basePlugins("人數"),
          scales: baseScales(),
        },
      });
      return;
    }
    const last = years.at(-1);
    const ranking = DATA.occupations.map((o) => ({ id: o.id, zh: o.zh, n: bucket[last + "|" + o.id] || 0 }))
      .filter((o) => o.n > 0).sort((a, b) => b.n - a.n).slice(0, 6);
    mount("chart-occ", {
      type: "line",
      data: {
        labels: years,
        datasets: ranking.map((o, i) => ({
          label: o.zh,
          data: years.map((y) => tot[y] ? (bucket[y + "|" + o.id] || 0) / tot[y] * 100 : null),
          borderColor: colors[i],
          backgroundColor: colors[i],
          tension: 0.2,
          pointRadius: 3,
        })),
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: anim(),
        plugins: basePlugins("佔該年全職就業的百分比 · 以最新學年人數最多的六類"),
        scales: baseScales({
          y: { ticks: { color: css("--muted"), callback: (v) => v + "%" }, grid: { color: css("--grid") }, beginAtZero: true },
        }),
      },
    });
  }

  function drawUaa() {
    const rows = filteredUaa();
    if (!rows.length) { blank("chart-uaa", "所選學年沒有問責協議的學士就業比例。"); return; }
    const colors = UNI_COLOR[themeMode()];
    const ink = css("--muted");
    if (state.uni !== "all") {
      const series = rows.slice().sort((a, b) => a.year.localeCompare(b.year));
      mount("chart-uaa", {
        type: "line",
        data: {
          labels: series.map((r) => r.year),
          datasets: [
            { label: "就業比例", data: series.map((r) => pct(r.employed, r.seeking)), borderColor: colors[0], backgroundColor: colors[0], tension: 0.15 },
            { label: "全職比例", data: series.map((r) => pct(r.ft, r.seeking)), borderColor: colors[1], backgroundColor: colors[1], tension: 0.15 },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false, animation: anim(),
          plugins: basePlugins("百分比"),
          scales: baseScales({ y: { min: 70, max: 100, ticks: { color: ink, callback: (v) => v + "%" }, grid: { color: css("--grid") } } }),
        },
      });
      return;
    }
    const years = uniq(rows.map((r) => r.year));
    const unis = DATA.unis;
    const barColors = DISC_COLOR[themeMode()];
    mount("chart-uaa", {
      type: "bar",
      data: {
        labels: unis.map((u) => u.short),
        datasets: years.map((y, i) => ({
          label: y,
          data: unis.map((u) => {
            const row = rows.find((r) => r.uni === u.id && r.year === y);
            return row ? pct(row.employed, row.seeking) : null;
          }),
          backgroundColor: barColors[i % barColors.length],
        })),
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: anim(),
        plugins: basePlugins("就業比例（%）· 軸由 70 起"),
        scales: baseScales({ y: { min: 70, max: 100, ticks: { color: ink, callback: (v) => v + "%" }, grid: { color: css("--grid") } } }),
      },
    });
  }

  function drawCampus() {
    const show = (id) => state.uni === "all" || state.uni === id;
    const c = (id) => DATA.campus.find((x) => x.id === id);
    if (show("hku") && $("#chart-hku")) {
      const h = c("hku");
      const col = DISC_COLOR[themeMode()];
      mount("chart-hku", {
        type: "line",
        data: {
          labels: h.series.map((r) => String(r.cohort)),
          datasets: [
            { label: "平均月薪", data: h.series.map((r) => r.avg), borderColor: col[0], backgroundColor: col[0], tension: 0.15 },
            { label: "中位數", data: h.series.map((r) => r.median), borderColor: col[2], backgroundColor: col[2], tension: 0.15 },
          ],
        },
        options: { responsive: true, maintainAspectRatio: false, animation: anim(), plugins: basePlugins("港大每月總薪酬"), scales: baseScales({ y: { beginAtZero: false, ticks: { color: css("--muted"), callback: (v) => nf.format(v) }, grid: { color: css("--grid") } } }) },
      });
      sectorChart("chart-hku-sec", h.sectors, "share", "港大就業行業佔已就業畢業生的百分比");
    }
    if (show("cuhk") && $("#chart-cuhk")) {
      const h = c("cuhk");
      const col = DISC_COLOR[themeMode()];
      mount("chart-cuhk", {
        type: "line",
        data: {
          labels: h.status.map((r) => String(r.cohort)),
          datasets: [
            { label: "在職", data: h.status.map((r) => r.engaged), borderColor: col[1], backgroundColor: col[1] },
            { label: "升學", data: h.status.map((r) => r.further), borderColor: col[0], backgroundColor: col[0] },
            { label: "尋找工作", data: h.status.map((r) => r.seeking), borderColor: col[4], backgroundColor: col[4] },
          ],
        },
        options: { responsive: true, maintainAspectRatio: false, animation: anim(), plugins: basePlugins("中大現況（佔回應者 %）"), scales: baseScales({ y: { ticks: { color: css("--muted"), callback: (v) => v + "%" }, grid: { color: css("--grid") }, beginAtZero: true } }) },
      });
      sectorChart("chart-cuhk-sec", h.sectors, "share", "中大行業分布（不包括內外全科醫學士，%）");
    }
    if (show("polyu") && $("#chart-polyu")) {
      const h = c("polyu");
      const col = DISC_COLOR[themeMode()];
      mount("chart-polyu", {
        type: "line",
        data: {
          labels: h.series.map((r) => String(r.cohort)),
          datasets: [{ label: "平均月薪", data: h.series.map((r) => r.avg), borderColor: col[5], backgroundColor: col[5], tension: 0.15 }],
        },
        options: { responsive: true, maintainAspectRatio: false, animation: anim(), plugins: basePlugins("理大學位課程平均月薪"), scales: baseScales({ y: { beginAtZero: false, ticks: { color: css("--muted"), callback: (v) => nf.format(v) }, grid: { color: css("--grid") } } }) },
      });
      sectorChart("chart-polyu-sec", h.sectors, "avg", "理大按行業的平均月薪");
    }
    if (show("hkbu") && $("#chart-hkbu")) {
      const h = c("hkbu");
      const col = DISC_COLOR[themeMode()];
      mount("chart-hkbu", {
        type: "line",
        data: {
          labels: h.series.map((r) => String(r.cohort)),
          datasets: [
            { label: "平均（教資會資助）", data: h.series.map((r) => r.avg), borderColor: col[0], backgroundColor: col[0] },
            { label: "中位數（教資會資助）", data: h.series.map((r) => r.median), borderColor: col[3], backgroundColor: col[3] },
            { label: "平均（非教資會資助）", data: h.nonUgcSeries.map((r) => r.avg), borderColor: col[4], backgroundColor: col[4], borderDash: [5, 4] },
          ],
        },
        options: { responsive: true, maintainAspectRatio: false, animation: anim(), plugins: basePlugins("浸大月薪"), scales: baseScales({ y: { beginAtZero: false, ticks: { color: css("--muted"), callback: (v) => nf.format(v) }, grid: { color: css("--grid") } } }) },
      });
      sectorChart("chart-hkbu-sec", h.sectors, "share", "浸大教資會資助學士的行業分布（%）");
    }
    if (show("eduhk") && $("#chart-eduhk")) {
      const h = c("eduhk");
      const col = DISC_COLOR[themeMode()];
      mount("chart-eduhk", {
        type: "line",
        data: {
          labels: h.teacherUg.map((r) => String(r.cohort)),
          datasets: [
            { label: "教師教育 · 學士", data: h.teacherUg.map((r) => r.avg), borderColor: col[2], backgroundColor: col[2], tension: 0.15 },
            { label: "補充學科 · 學士", data: h.complementUg.map((r) => r.avg), borderColor: col[5], backgroundColor: col[5], tension: 0.15 },
          ],
        },
        options: { responsive: true, maintainAspectRatio: false, animation: anim(), plugins: basePlugins("教大入職月薪"), scales: baseScales({ y: { beginAtZero: false, ticks: { color: css("--muted"), callback: (v) => nf.format(v) }, grid: { color: css("--grid") } } }) },
      });
    }
  }

  function renderSources() {
    const host = $("#source-list");
    if (!host || host.dataset.ready) return;
    host.innerHTML = DATA.sources.map((s) =>
      `<li><a href="${esc(s.url)}">${esc(s.title)}</a><br><span class="fine">${esc(s.note)} <a href="${esc(s.page)}">相關頁面</a></span></li>`).join("");
    host.dataset.ready = "1";
  }

  function render() {
    renderFilterNote();
    renderOverview();
    renderSalary();
    renderEmployment();
    renderOccupation();
    renderUaa();
    renderCampus();
    renderSources();
    renderCharts();
  }

  function setTab(id) {
    state.tab = id;
    document.querySelectorAll("[data-panel]").forEach((p) => {
      const on = p.dataset.panel === id;
      p.classList.toggle("is-on", on);
      p.hidden = !on;
    });
    document.querySelectorAll("[role=tab]").forEach((b) => {
      const on = b.dataset.tab === id;
      b.setAttribute("aria-selected", on ? "true" : "false");
      b.tabIndex = on ? 0 : -1;
    });
    if (location.hash !== "#" + id) history.replaceState(null, "", "#" + id);
    renderCharts();
  }

  function bind() {
    document.querySelectorAll("[role=tab]").forEach((b, i) => {
      b.tabIndex = i === 0 ? 0 : -1;
      b.addEventListener("click", () => setTab(b.dataset.tab));
    });
    $(".tabs").addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const buttons = [...document.querySelectorAll("[role=tab]")];
      const i = buttons.findIndex((b) => b.getAttribute("aria-selected") === "true");
      e.preventDefault();
      const n = e.key === "ArrowRight" ? (i + 1) % buttons.length : (i - 1 + buttons.length) % buttons.length;
      buttons[n].focus();
      setTab(buttons[n].dataset.tab);
    });
    $("#filters").addEventListener("change", () => {
      state.level = $("#f-level").value;
      state.uni = $("#f-uni").value;
      state.year = $("#f-year").value;
      render();
    });
    const themeBtn = $("#theme");
    themeBtn.addEventListener("click", () => {
      const next = themeMode() === "dark" ? "light" : "dark";
      applyTheme(next);
      try { localStorage.setItem("graduates-theme", next); } catch (err) { /* ignore */ }
      renderCharts();
    });
  }

  function applyTheme(mode) {
    document.documentElement.dataset.theme = mode;
    const dark = mode === "dark";
    $("#theme").setAttribute("aria-pressed", dark ? "true" : "false");
    $("#theme-icon").textContent = dark ? "淺色" : "深色";
    $("#theme-label").textContent = dark ? "切換淺色" : "切換深色";
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = dark ? "#12161b" : "#0c5c56";
  }

  async function init() {
    let saved = null;
    try { saved = localStorage.getItem("graduates-theme"); } catch (err) { /* ignore */ }
    const prefer = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    applyTheme(saved || prefer);
    bind();
    try {
      const res = await fetch("data.json");
      if (!res.ok) throw new Error(String(res.status));
      DATA = await res.json();
    } catch (err) {
      $("#lead").innerHTML = "<p>數據檔未能載入。此頁需要與 data.json 放在同一路徑。</p>";
      return;
    }
    fillSelects();
    const hash = (location.hash || "").replace("#", "");
    const tabs = [...document.querySelectorAll("[role=tab]")].map((b) => b.dataset.tab);
    if (tabs.includes(hash)) setTab(hash);
    render();
  }

  init();
})();
