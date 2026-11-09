import { useQuery } from "@tanstack/react-query";
import { categories, type AITool } from "@shared/catalog";

export interface CatalogResponse {
  tools: AITool[];
  verifiedDate: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isStrings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === "string");

function isTool(value: unknown): value is AITool {
  if (!isRecord(value)) return false;
  const strings = [
    "id",
    "name",
    "tagline",
    "description",
    "languages",
    "regionNote",
    "officialUrl",
    "pricingUrl",
    "freeSummary",
    "priceLabel",
    "billingNote",
    "verifiedDate",
    "verificationNote",
  ];
  const arrays = ["features", "bestFor", "pros", "limitations", "platforms"];
  return (
    strings.every(key => typeof value[key] === "string") &&
    arrays.every(key => isStrings(value[key])) &&
    categories.some(category => category.id === value.category) &&
    typeof value.hasFree === "boolean" &&
    (value.monthlyUSD === null ||
      (typeof value.monthlyUSD === "number" &&
        Number.isFinite(value.monthlyUSD) &&
        value.monthlyUSD >= 0)) &&
    Array.isArray(value.plans) &&
    value.plans.every(
      plan =>
        isRecord(plan) &&
        ["name", "price", "billing", "summary"].every(
          key => typeof plan[key] === "string"
        )
    ) &&
    Array.isArray(value.sources) &&
    value.sources.every(
      source =>
        isRecord(source) &&
        typeof source.title === "string" &&
        typeof source.url === "string"
    )
  );
}

export function parseCatalog(value: unknown): CatalogResponse | undefined {
  if (
    !isRecord(value) ||
    typeof value.verifiedDate !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value.verifiedDate) ||
    !Array.isArray(value.tools) ||
    !value.tools.every(isTool)
  )
    return undefined;
  const ids = value.tools.map(tool => tool.id);
  if (new Set(ids).size !== ids.length) return undefined;
  return { tools: value.tools, verifiedDate: value.verifiedDate };
}

export function readInitialCatalog(): CatalogResponse | undefined {
  if (typeof document === "undefined") return undefined;
  try {
    const element = document.getElementById("catalog-data");
    if (!element || element.getAttribute("type") !== "application/json")
      return undefined;
    return parseCatalog(JSON.parse(element.textContent || ""));
  } catch {
    return undefined;
  }
}

export function readCatalogUrl(): string {
  if (typeof document === "undefined") return "/api/tools";
  return (
    document.getElementById("catalog-data")?.getAttribute("data-catalog-url") ||
    "/api/tools"
  );
}

export function isCatalogSnapshot(): boolean {
  return readCatalogUrl() === "./catalog.json";
}

export function useCatalog() {
  return useQuery<CatalogResponse, Error>({
    queryKey: ["ai-tools-catalog"],
    queryFn: async ({ signal }) => {
      const response = await fetch(readCatalogUrl(), {
        signal,
        headers: { Accept: "application/json" },
        cache: "no-store",
      }).catch(error => {
        if (signal.aborted) throw error;
        throw new Error("網絡暫時未能連接，請檢查連線後再試。");
      });
      if (!response.ok) throw new Error("暫時連唔到工具資料庫，請稍後再試。");
      const payload: unknown = await response.json().catch(() => {
        throw new Error("工具資料未能讀取，請重新載入。");
      });
      const catalog = parseCatalog(payload);
      if (!catalog) throw new Error("工具資料格式未能讀取，請重新載入。");
      return catalog;
    },
    initialData: readInitialCatalog,
    initialDataUpdatedAt: 0,
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

const bookmarkKey = "aipicks-bookmarks-v1";
export function readBookmarks(): { ids: string[]; available: boolean } {
  try {
    if (typeof window === "undefined") return { ids: [], available: true };
    const raw = window.localStorage.getItem(bookmarkKey);
    if (!raw) return { ids: [], available: true };
    const value: unknown = JSON.parse(raw);
    return {
      ids: isStrings(value) ? [...new Set(value)] : [],
      available: true,
    };
  } catch {
    return { ids: [], available: false };
  }
}

export function saveBookmarks(ids: string[]): boolean {
  try {
    window.localStorage.setItem(bookmarkKey, JSON.stringify(ids));
    return true;
  } catch {
    return false;
  }
}

export function safeExternalUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    return ["https:", "http:"].includes(parsed.protocol)
      ? parsed.href
      : undefined;
  } catch {
    return undefined;
  }
}
