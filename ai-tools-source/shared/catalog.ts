export type CategoryId = 'chat' | 'research' | 'image' | 'video' | 'audio' | 'code' | 'office' | 'slides';

export interface AIPlan {
  name: string;
  price: string;
  billing: string;
  summary: string;
}

export interface AITool {
  id: string;
  name: string;
  category: CategoryId;
  tagline: string;
  description: string;
  features: string[];
  bestFor: string[];
  pros: string[];
  limitations: string[];
  platforms: string[];
  languages: string;
  regionNote: string;
  officialUrl: string;
  pricingUrl: string;
  hasFree: boolean;
  freeSummary: string;
  priceLabel: string;
  monthlyUSD: number | null;
  billingNote: string;
  plans: AIPlan[];
  sources: { title: string; url: string }[];
  verifiedDate: string;
  verificationNote: string;
}

export const categories: { id: CategoryId; name: string; short: string; description: string }[] = [
  { id: 'chat', name: '聊天與寫作', short: '聊天寫作', description: '由日常問題，到文字創作' },
  { id: 'research', name: '搜尋與研究', short: '搜尋研究', description: '找資料、讀文件、整理知識' },
  { id: 'image', name: '圖像與設計', short: '圖像設計', description: '將腦海嘅想法變成畫面' },
  { id: 'video', name: '影片與數字人', short: '影片製作', description: '生成影片，同內容講故事' },
  { id: 'audio', name: '語音與音樂', short: '語音音樂', description: '配音、創作音樂、聲音製作' },
  { id: 'code', name: '編程與開發', short: '編程開發', description: '寫程式、除錯、加快開發' },
  { id: 'office', name: '辦公與自動化', short: '辦公效率', description: '整理工作、減少重複操作' },
  { id: 'slides', name: '簡報與演示', short: '簡報演示', description: '由大綱，到清晰嘅簡報' },
];

export const featuredIds = ['chatgpt', 'notebooklm', 'canva', 'cursor'];

export function selectTools(tools: AITool[], query: string, category: string, price: string, sort: string): AITool[] {
  const needle = query.trim().toLocaleLowerCase();
  const selected = tools.filter(tool => {
    const group = categories.find(c => c.id === tool.category);
    const text = [tool.name, tool.tagline, tool.description, group?.name, ...tool.features, ...tool.bestFor].join(' ').toLocaleLowerCase();
    return (!needle || text.includes(needle)) && (category === 'all' || category === tool.category)
      && (price === 'all' || (price === 'free' ? tool.hasFree : !tool.hasFree));
  });
  if (sort === 'name') return selected.sort((a, b) => a.name.localeCompare(b.name));
  if (sort === 'price') return selected.sort((a, b) => (a.monthlyUSD ?? Infinity) - (b.monthlyUSD ?? Infinity));
  return selected;
}
