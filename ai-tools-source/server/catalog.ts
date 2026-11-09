import mysql, { type RowDataPacket } from 'mysql2/promise';
import type { AITool } from '../shared/catalog';

let pool: mysql.Pool | undefined;

function catalogPool() {
  if (!process.env.DATABASE_URL) throw new Error('Catalog database not configured');
  pool ??= mysql.createPool({ uri: process.env.DATABASE_URL, connectionLimit: 5 });
  return pool;
}

export async function getTools(): Promise<AITool[]> {
  const [rows] = await catalogPool().execute<RowDataPacket[]>(
    'SELECT detail FROM ai_tools ORDER BY display_order ASC, id ASC LIMIT 100'
  );
  return rows.map(row => typeof row.detail === 'string' ? JSON.parse(row.detail) as AITool : row.detail as AITool);
}

export async function closeCatalogPool() {
  if (pool) await pool.end();
  pool = undefined;
}

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]!);

function safeLink(url: string): string {
  try { return new URL(url).protocol === 'https:' ? escapeHtml(url) : '#'; }
  catch { return '#'; }
}

// Public catalogue body and initial data are taken from the same persistent database.
// React enhances this meaningful initial HTML; no private user data is included.
export async function injectCatalog(html: string): Promise<string> {
  const tools = await getTools();
  if (!tools.length) throw new Error('Catalog data not initialized');
  const body = `<main class="initial-catalog"><h1>AI 精選指南：搵到啱用嘅 AI 工具</h1>
    <p>按用途探索 AI 工具，了解主要功能、免費方案與付費收費。官方資料查核日期：2026-11-09；收費及供應地區可能變動，以官方網站為準。</p>
    ${tools.map(tool => `<article><h2>${escapeHtml(tool.name)}</h2><p>${escapeHtml(tool.tagline)}</p>
    <p>${escapeHtml(tool.description)}</p><p>主要功能：${tool.features.map(escapeHtml).join('；')}</p>
    <p>適合：${tool.bestFor.map(escapeHtml).join('；')}</p>
    <p>收費：${escapeHtml(tool.priceLabel)}。${escapeHtml(tool.billingNote)}</p>
    <p>免費方案：${escapeHtml(tool.freeSummary)}</p>
    <a href="${safeLink(tool.officialUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(tool.name)} 官方網站（外部連結）</a>
    <a href="${safeLink(tool.pricingUrl)}" target="_blank" rel="noopener noreferrer">官方收費</a>
    <details><summary>功能、限制與來源</summary><p>${tool.pros.map(escapeHtml).join('；')}</p><p>${tool.limitations.map(escapeHtml).join('；')}</p>
    <p>支援平台：${tool.platforms.map(escapeHtml).join('；')}</p><p>${escapeHtml(tool.regionNote)}</p>
    ${tool.plans.map(plan => `<p>${escapeHtml(plan.name)}：${escapeHtml(plan.price)}；${escapeHtml(plan.billing)}；${escapeHtml(plan.summary)}</p>`).join('')}
    ${tool.sources.map(source => `<p><a href="${safeLink(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.title)}</a></p>`).join('')}
    <p>核實日期：${escapeHtml(tool.verifiedDate)}。${escapeHtml(tool.verificationNote)}</p></details></article>`).join('')}
    </main>`;
  const serialized = JSON.stringify({ tools, verifiedDate: '2026-11-09' }).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  return html.replace('<div id="root"></div>', `<div id="root">${body}</div><script id="catalog-data" type="application/json">${serialized}</script>`);
}
