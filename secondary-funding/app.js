(() => {
  'use strict';

  const STORAGE_KEY = 'hk-secondary-funding-saved';
  const ALL = 'all';
  const byId = (id) => document.getElementById(id);
  const controls = {
    search: byId('search'), schoolSearch: byId('school-search'),
    schoolType: byId('school-type'), sector: byId('sector'), route: byId('route'),
    status: byId('application-status'),
    categories: byId('category-nav'), cards: byId('cards'), count: byId('result-count'),
    summary: byId('active-filter-summary'), empty: byId('empty-state'),
    savedOnly: byId('saved-only'), saveCount: byId('save-count'),
    schoolNote: byId('school-match-note'), storageNote: byId('storage-note'),
    export: byId('export-csv')
  };
  if (!controls.cards || !controls.search) return;

  function readEmbedded(id, keys) {
    try {
      const parsed = JSON.parse(byId(id)?.textContent || '[]');
      if (Array.isArray(parsed)) return parsed;
      for (const key of keys) if (Array.isArray(parsed?.[key])) return parsed[key];
    } catch (error) {
      console.warn('無法讀取內嵌資料：', id, error);
      announceStorage('部分資料未能載入；您仍可閱讀原有資助卡及官方來源。');
    }
    return [];
  }

  function announceStorage(message) {
    if (!controls.storageNote) return;
    controls.storageNote.textContent = message;
    controls.storageNote.hidden = !message;
  }

  function text(value) {
    if (value === null || value === undefined) return '';
    if (Array.isArray(value)) return value.map(text).filter(Boolean).join('；');
    if (typeof value === 'object') return Object.values(value).map(text).filter(Boolean).join('；');
    return String(value);
  }

  function first(record, keys) {
    for (const key of keys) {
      if (record?.[key] !== undefined && record[key] !== null && text(record[key]).trim()) return record[key];
    }
    return '';
  }

  function normalizeName(value) {
    return text(value).normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('zh-Hant');
  }

  function normalizeSchoolType(value) {
    const label = text(value).replace(/\s+/g, '');
    if (/特殊|特教|special/i.test(label)) return '特殊';
    if (/國際|国际|英基|international|englishschoolsfoundation/i.test(label)) return '國際';
    if (/直資|直接資助|\bDSS\b/i.test(label)) return '直資';
    if (/官立|government/i.test(label)) return '官立';
    if (/資助|津貼|按位|aided|subsidized|subsidised/i.test(label)) return '資助';
    if (/私立|private/i.test(label)) return '私立';
    return '';
  }

  // Broad eligibility must be explicitly stated; missing or empty arrays do not qualify.
  function isBroadSchoolLabel(value) {
    const label = text(value).replace(/[\s（）()]/g, '');
    return /^(?:香港)?(?:(?:全部|所有|全港|各類|各|全)(?:的)?)?(?:中學|學校|校類)(?:均可|皆可|適用)?$/.test(label)
      || /^(?:全部|所有|全港)(?:香港)?(?:中學|學校|校類)$/.test(label);
  }

  function schoolLabels(record) {
    const value = first(record, ['schoolTypes', 'school_types', 'eligibleSchoolTypes']);
    if (Array.isArray(value)) return value.map(text).map((item) => item.trim()).filter(Boolean);
    return text(value).split(/[、,，;；/|]/).map((item) => item.trim()).filter(Boolean);
  }

  function normalizeSector(value) {
    const label = text(value).trim();
    if (/非政府|民間|慈善|ngo|non.?government/i.test(label)) return '非政府';
    if (/政府|government/i.test(label)) return '政府';
    return label;
  }

  function routeLabel(record) {
    return text(first(record, ['applicationRoute', 'application_route', 'route'])).trim();
  }

  function normalizedRoute(value) {
    if (['按校撥款／年度申報', '教師個人申請（學校核證）', '學校報名（非現金支援）'].includes(value)) return value;
    if (/合作|伙伴|夥伴|partner/i.test(value)) return '合作渠道';
    if (/辦學|機構申請|團體申請|sponsor|organisation|organization/i.test(value)) return '辦學團體或機構申請';
    if (/代學生|代.*申請|onbehalf/i.test(value)) return '學校代學生申請';
    if (/直接申請|學校申請|direct/i.test(value)) return '學校直接申請';
    return value;
  }

  function requiresPartner(record) {
    return ['辦學團體或機構申請', '合作渠道'].includes(normalizedRoute(routeLabel(record)));
  }

  function safeUrl(value) {
    try {
      const url = new URL(text(value).trim());
      return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
    } catch { return ''; }
  }

  const records = readEmbedded('funding-data', ['records', 'items', 'grants', 'funding']);
  const schools = readEmbedded('schools-data', ['schools', 'records', 'items']);
  const recordMap = new Map(records.filter((record) => record?.id !== undefined).map((record) => [String(record.id), record]));
  const entries = Array.from(controls.cards.querySelectorAll('.fund-card')).map((card) => {
    const id = card.dataset.id || card.id.replace(/^grant-/, '');
    const record = recordMap.get(id) || {};
    return { id, card, record, searchText: normalizeName(text(record) || card.textContent) };
  });
  const validIds = new Set(entries.map((entry) => entry.id));
  const schoolIndex = new Map();
  schools.forEach((school) => {
    const aliases = [school.name, school.nameEn, school.nameZh, school.name_zh].filter(Boolean);
    new Set(aliases.map(normalizeName)).forEach((name) => {
      if (!schoolIndex.has(name)) schoolIndex.set(name, []);
      schoolIndex.get(name).push(school);
    });
  });

  function lookupSchool(value) {
    const matches = schoolIndex.get(normalizeName(value));
    if (!matches?.length) return null;
    const types = [...new Set(matches.map((school) => normalizeSchoolType(school.type || school.schoolType)))];
    return {
      name: text(matches[0].name || matches[0].nameZh || value),
      type: types.length === 1 && types[0] ? types[0] : '',
      locations: matches.length,
      notes: [...new Set(matches.map((school) => text(school.note || school.notes)).filter(Boolean))].join('；')
    };
  }

  function decodeSaved(value) {
    const parsed = JSON.parse(value || '[]');
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id) => typeof id === 'string' || typeof id === 'number').map(String).filter((id) => validIds.has(id)));
  }

  let saved = new Set();
  let storageAvailable = true;
  try { saved = decodeSaved(localStorage.getItem(STORAGE_KEY)); }
  catch {
    storageAvailable = false;
    announceStorage('本機收藏儲存未能使用。您仍可暫存本頁收藏及匯出 CSV，但重新整理後可能不會保留。');
  }

  const state = { category: ALL, savedOnly: false, manualSchoolType: ALL, visible: entries };
  const categoryButtons = () => Array.from(controls.categories?.querySelectorAll('button[data-category]') || []);
  const isAllCategory = (value) => !value || ['all', '全部', '全部資助', '全部項目'].includes(value);

  function schoolContext() {
    const specificName = controls.schoolSearch.value.trim();
    const generalName = controls.search.value.trim();
    const specific = specificName ? lookupSchool(specificName) : null;
    const general = generalName ? lookupSchool(generalName) : null;
    const matched = specific || general;
    const type = matched?.type || state.manualSchoolType;
    controls.schoolType.value = type;
    const notes = [];
    if (specificName && !specific) notes.push('未找到精確的學校名稱，請從官方名單選擇完整名稱，或改用「校類」篩選。');
    if (matched?.type) {
      notes.push(`已配對「${matched.name}」：${matched.type}。校類初步配對，不代表個別學校必然合資格。`);
      if (matched.locations > 1) notes.push('同名校址／校部的校類一致，已合併作初步配對。');
      if (matched.notes) notes.push(matched.notes);
    } else if (matched) {
      notes.push(`已找到「${matched.name}」，但校類資料未明或同名校址的校類不一致，未自動判定資格；請改用「校類」。`);
    }
    if (type !== ALL && !matched?.type) notes.push(`目前按「${type}」作校類初步篩選，不代表個別學校必然合資格。`);
    controls.schoolNote.textContent = notes.join(' ');
    controls.schoolNote.hidden = !notes.length;
    controls.schoolNote.classList.toggle('is-warning', Boolean((specificName && !specific) || (matched && !matched.type)));
    return { type, matched, general, query: general ? '' : normalizeName(generalName) };
  }

  function matchesSchoolType(record, type) {
    if (type === ALL) return true;
    if (requiresPartner(record)) return true; // Retain as a collaboration lead, never label it eligible.
    const labels = schoolLabels(record);
    return labels.some((label) => {
      const base = label.split(/[（(]/)[0].trim();
      if (/^(?:非官立|官立(?:中學|學校)?不適用)/.test(base) && type === '官立') return false;
      if (/不適用|不合資格|不得申請/.test(base)) return false;
      if (/^非官立/.test(base)) return type !== '官立';
      if (isBroadSchoolLabel(base)) return true;
      if (/特殊|特教/.test(base)) return type === '特殊';
      if (type === '特殊' && /[（(](?:包括|含|涵蓋)特殊學校/.test(label)) return true;
      if (/公營/.test(base)) return ['官立', '資助'].includes(type);
      if (/公帑資助/.test(base)) return ['官立', '資助', '直資', '特殊'].includes(type);
      const named = base.split(/[及與和或、,，/]/).map(normalizeSchoolType).filter(Boolean);
      if (named.length) return named.includes(type);
      // A generic secondary-school lead has additional conditions, not verified eligibility.
      return /中學|初中|高中|會員學校|非牟利學校/.test(base);
    });
  }

  function matchesStatus(record, value) {
    const status = text(record.status);
    if (value === ALL) return true;
    if (value === 'open') return status.startsWith('接受申請');
    if (value === 'annual') return status.startsWith('年度撥款');
    if (value === 'closed') return status.includes('已截止');
    if (value === 'future') return status.startsWith('尚未開放');
    if (value === 'check') return status.startsWith('需查核');
    if (value === 'existing') return /^(?:不接受新申請|非公開申請)/.test(status);
    return false;
  }

  function categoryValues(entry) {
    const value = first(entry.record, ['category', 'categories']) || entry.card.dataset.category;
    return (Array.isArray(value) ? value : text(value).split(/[|,，、;]/)).map(text).map((item) => item.trim());
  }

  function showPartnerNote(entry, active) {
    let note = entry.card.querySelector('.card-match-note');
    if (active && requiresPartner(entry.record)) {
      if (!note) {
        note = document.createElement('p');
        note.className = 'card-match-note';
        const details = entry.card.querySelector('details');
        if (details) details.before(note); else entry.card.append(note);
      }
      note.textContent = '需經機構或合作渠道確認，保留作合作線索；不表示所選校類或學校已符合申請資格。';
      note.hidden = false;
    } else if (note) note.hidden = true;
  }

  function updateSavedUI() {
    controls.saveCount.textContent = String(saved.size);
    controls.savedOnly.setAttribute('aria-pressed', String(state.savedOnly));
    entries.forEach(({ id, card }) => {
      const selected = saved.has(id);
      card.classList.toggle('is-saved', selected);
      card.querySelectorAll('.save-button').forEach((button) => {
        button.dataset.id = id;
        button.type = 'button';
        button.classList.toggle('saved', selected);
        button.setAttribute('aria-pressed', String(selected));
        const title = card.querySelector('.fund-title')?.textContent.trim() || '此項資助';
        button.setAttribute('aria-label', `${selected ? '取消收藏' : '收藏'}：${title}`);
        const label = button.querySelector('.save-label, [data-save-label]');
        if (label) label.textContent = selected ? '已收藏' : '收藏';
        else button.textContent = selected ? '已收藏' : '收藏';
      });
    });
  }

  function applyFilters() {
    const context = schoolContext();
    const sector = controls.sector.value;
    const route = controls.route.value;
    const status = controls.status?.value || ALL;
    state.visible = entries.filter((entry) => {
      const matches = (!context.query || entry.searchText.includes(context.query))
        && (isAllCategory(state.category) || categoryValues(entry).includes(state.category))
        && (sector === ALL || normalizeSector(entry.record.sector || entry.card.dataset.sector) === sector)
        && (route === ALL || normalizedRoute(routeLabel(entry.record)) === route)
        && matchesStatus(entry.record, status)
        && matchesSchoolType(entry.record, context.type)
        && (!state.savedOnly || saved.has(entry.id));
      entry.card.hidden = !matches;
      showPartnerNote(entry, context.type !== ALL);
      return matches;
    });
    categoryButtons().forEach((button) => {
      const active = isAllCategory(state.category) ? isAllCategory(button.dataset.category) : button.dataset.category === state.category;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    controls.count.textContent = String(state.visible.length);
    controls.empty.hidden = state.visible.length > 0;
    controls.export.disabled = state.visible.length === 0;
    const filters = [];
    if (context.query) filters.push(`關鍵字「${controls.search.value.trim()}」`);
    if (!isAllCategory(state.category)) filters.push(state.category);
    if (context.type !== ALL) filters.push(`${context.type}校類`);
    if (sector !== ALL) filters.push(sector);
    if (route !== ALL) filters.push(route);
    if (status !== ALL) filters.push(controls.status.selectedOptions[0].textContent);
    if (state.savedOnly) filters.push('僅收藏');
    controls.summary.textContent = filters.length
      ? `${state.visible.length} 項結果 · ${filters.join(' / ')}${context.matched?.type ? ' · 校類初步配對，非資格確認' : ''}`
      : `顯示全部 ${state.visible.length} 項資助`;
    updateSavedUI();
  }

  function resetFilters() {
    controls.search.value = '';
    controls.schoolSearch.value = '';
    controls.schoolType.value = ALL;
    controls.sector.value = ALL;
    controls.route.value = ALL;
    if (controls.status) controls.status.value = ALL;
    state.category = ALL;
    state.savedOnly = false;
    state.manualSchoolType = ALL;
    applyFilters();
  }

  function persistSaved() {
    if (!storageAvailable) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...saved])); }
    catch {
      storageAvailable = false;
      announceStorage('收藏已在本頁暫存，但瀏覽器無法寫入本機儲存。請匯出 CSV 保存清單；重新整理後可能不會保留。');
    }
  }

  // Only ID values are persisted. School names and search terms stay in memory.
  controls.cards.addEventListener('click', (event) => {
    const button = event.target.closest('.save-button');
    if (!button || !controls.cards.contains(button)) return;
    const id = button.dataset.id || button.closest('.fund-card')?.dataset.id;
    if (!validIds.has(id)) return;
    if (saved.has(id)) saved.delete(id); else saved.add(id);
    persistSaved();
    applyFilters();
    // If unsaving removes the focused card, preserve a usable keyboard focus target.
    if (button.closest('.fund-card')?.hidden) controls.savedOnly.focus();
  });

  controls.categories?.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-category]');
    if (!button || !controls.categories.contains(button)) return;
    state.category = button.dataset.category;
    applyFilters();
  });
  [controls.search, controls.schoolSearch].forEach((input) => input.addEventListener('input', applyFilters));
  [controls.sector, controls.route].forEach((select) => select.addEventListener('change', applyFilters));
  controls.status?.addEventListener('change', applyFilters);
  controls.schoolType.addEventListener('change', () => {
    state.manualSchoolType = controls.schoolType.value;
    controls.schoolSearch.value = '';
    if (lookupSchool(controls.search.value)) controls.search.value = '';
    applyFilters();
  });
  controls.savedOnly.addEventListener('click', () => {
    state.savedOnly = !state.savedOnly;
    applyFilters();
  });
  byId('reset-filters')?.addEventListener('click', resetFilters);
  document.querySelectorAll('[data-reset-filters]').forEach((button) => button.addEventListener('click', resetFilters));
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    try { saved = decodeSaved(event.newValue); applyFilters(); } catch { /* Ignore malformed external values. */ }
  });

  function amountDisplay(record) {
    const amount = first(record, ['amountDisplay', 'amountText', 'amountLabel', 'amount']);
    if (amount && typeof amount === 'object' && !Array.isArray(amount)) {
      return text(first(amount, ['display', 'text', 'label'])) || '按計劃審批';
    }
    const value = text(amount).trim();
    return !value || /^(?:unknown|n\/?a|未明|未知|null)$/i.test(value) ? '按計劃審批' : value;
  }

  function sourceUrls(record) {
    const sources = first(record, ['sources', 'source']);
    const list = Array.isArray(sources) ? sources : sources ? [sources] : [];
    const urls = list.map((source) => safeUrl(typeof source === 'object' ? source.url || source.href : source)).filter(Boolean);
    const primary = safeUrl(first(record, ['officialUrl', 'url', 'sourceUrl']));
    return [...new Set(primary ? [primary, ...urls] : urls)].join(' | ');
  }

  function csvCell(value) {
    let cell = text(value);
    // Protect spreadsheet formula injection, including leading whitespace/control characters.
    if (/^[\s\u0000-\u001f]*[=+\-@]/.test(cell)) cell = `'${cell}`;
    return `"${cell.replace(/"/g, '""')}"`;
  }

  controls.export.addEventListener('click', () => {
    const rows = [['名稱', '機構', '目的', '金額', '類別', '校類', '渠道', '狀態', '截止', '來源']];
    state.visible.forEach(({ record, card }) => {
      rows.push([
        first(record, ['name', 'title']) || card.querySelector('.fund-title')?.textContent,
        first(record, ['provider', 'organization', 'organisation']),
        first(record, ['purpose', 'summary']), amountDisplay(record),
        first(record, ['category', 'categories']), schoolLabels(record).join('；') || '未明，須查閱官方條件',
        routeLabel(record) || '待確認', first(record, ['status', 'applicationStatus']) || '待確認',
        first(record, ['deadline', 'applicationDeadline']) || '未註明，請查閱官方公告', sourceUrls(record)
      ]);
    });
    const csv = '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '香港中學資助指南-篩選結果-2026-11-09.csv';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  // Static markup is supplied by the build. Defensively reject unsafe source links.
  document.querySelectorAll('.fund-card a, .school-source a').forEach((link) => {
    const url = safeUrl(link.getAttribute('href'));
    if (!url) {
      link.removeAttribute('href');
      link.removeAttribute('target');
      link.setAttribute('aria-disabled', 'true');
      return;
    }
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  });

  applyFilters();
})();
