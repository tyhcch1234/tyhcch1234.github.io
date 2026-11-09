import { describe, expect, it } from 'vitest';
import { selectTools, type AITool } from './catalog';

const fixture = (id: string, name: string, category: AITool['category'], hasFree: boolean, monthlyUSD: number | null): AITool => ({
  id, name, category, hasFree, monthlyUSD,
  tagline: '生成圖像與文字', description: '按需要建立內容', features: ['文字改寫', '文件摘要'], bestFor: ['內容創作者'],
  pros: [], limitations: [], platforms: ['Web'], languages: '', regionNote: '', officialUrl: 'https://example.com/', pricingUrl: 'https://example.com/pricing',
  freeSummary: '', priceLabel: '', billingNote: '', plans: [], sources: [{ title: 'Official', url: 'https://example.com/' }], verifiedDate: '2026-11-09', verificationNote: '',
});
const tools = [fixture('a', 'Alpha', 'chat', true, 20), fixture('b', 'Beta', 'image', false, 10), fixture('n', 'Notion AI', 'office', false, null)];

describe('AI tool directory filters', () => {
  it('matches name ignoring case and surrounding space', () => expect(selectTools(tools, ' ALPHA ', 'all', 'all', 'editorial').map(t => t.id)).toEqual(['a']));
  it('matches Traditional Chinese category and feature words', () => {
    expect(selectTools(tools, '圖像與設計', 'all', 'all', 'editorial').map(t => t.id)).toEqual(['b']);
    expect(selectTools(tools, '文件摘要', 'all', 'all', 'editorial')).toHaveLength(3);
  });
  it('combines category and permanent free-plan filter', () => {
    expect(selectTools(tools, '', 'chat', 'free', 'editorial').map(t => t.id)).toEqual(['a']);
    expect(selectTools(tools, '', 'office', 'free', 'editorial')).toHaveLength(0);
  });
  it('paid/trial filter excludes genuine free tiers', () => expect(selectTools(tools, '', 'all', 'paid', 'editorial').map(t => t.id)).toEqual(['b', 'n']));
  it('sorts actual paid monthly fee ascending, unknown last', () => expect(selectTools(tools, '', 'all', 'all', 'price').map(t => t.id)).toEqual(['b', 'a', 'n']));
  it('does not mutate source order', () => { selectTools(tools, '', 'all', 'all', 'price'); expect(tools.map(t => t.id)).toEqual(['a', 'b', 'n']); });
  it('unmatched keyword gives an empty result', () => expect(selectTools(tools, 'nonesuch', 'all', 'all', 'editorial')).toHaveLength(0));
});
