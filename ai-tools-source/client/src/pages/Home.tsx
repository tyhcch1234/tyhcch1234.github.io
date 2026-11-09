import { useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Bookmark,
  Check,
  ChevronDown,
  Loader2,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { categories, selectTools, type AITool } from "@shared/catalog";
import { readBookmarks, saveBookmarks, useCatalog } from "@/lib/catalogClient";
import {
  categoryIcons,
  LayoutGrid,
  PriceCaveat,
} from "@/components/catalog/CatalogElements";
import { CompareBar, CompareDialog } from "@/components/catalog/CompareTools";
import { FeaturedTools } from "@/components/catalog/FeaturedTools";
import { GuideSections } from "@/components/catalog/GuideSections";
import { Hero, SiteHeader } from "@/components/catalog/SiteHeader";
import { ToolCard } from "@/components/catalog/ToolCard";
import { ToolDialog } from "@/components/catalog/ToolDialog";

const emptyTools: AITool[] = [];

export default function Home() {
  const catalog = useCatalog();
  const tools = catalog.data?.tools ?? emptyTools;
  const verifiedDate = catalog.data?.verifiedDate ?? "2026-11-09";
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [price, setPrice] = useState("all");
  const [sort, setSort] = useState("editorial");
  const [savedOnly, setSavedOnly] = useState(false);
  const [bookmarks, setBookmarks] = useState(readBookmarks);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [detail, setDetail] = useState<AITool | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const detailTrigger = useRef<HTMLButtonElement | null>(null);
  const compareTrigger = useRef<HTMLButtonElement | null>(null);

  const selected = useMemo(
    () =>
      selectTools(
        savedOnly
          ? tools.filter(tool => bookmarks.ids.includes(tool.id))
          : tools,
        query,
        category,
        price,
        sort
      ),
    [tools, bookmarks.ids, savedOnly, query, category, price, sort]
  );
  const comparedTools = tools.filter(tool => compareIds.includes(tool.id));
  const bookmarkCount = tools.filter(tool =>
    bookmarks.ids.includes(tool.id)
  ).length;
  const activeCategory = categories.find(item => item.id === category);
  const hasFilters = Boolean(
    query || category !== "all" || price !== "all" || savedOnly
  );

  function openDetail(tool: AITool, trigger: HTMLButtonElement) {
    detailTrigger.current = trigger;
    setDetail(tool);
  }

  function toggleBookmark(tool: AITool) {
    const exists = bookmarks.ids.includes(tool.id);
    const ids = exists
      ? bookmarks.ids.filter(id => id !== tool.id)
      : [...bookmarks.ids, tool.id];
    setBookmarks({ ids, available: saveBookmarks(ids) });
    setAnnouncement(`${tool.name} ${exists ? "已移出收藏" : "已加入收藏"}`);
  }

  function toggleCompare(tool: AITool) {
    if (compareIds.includes(tool.id)) {
      setCompareIds(previous => previous.filter(id => id !== tool.id));
      setAnnouncement(`${tool.name} 已移出比較`);
    } else if (compareIds.length < 3) {
      setCompareIds(previous => [...previous, tool.id]);
      setAnnouncement(`${tool.name} 已加入比較`);
    } else {
      setAnnouncement("最多可以比較 3 款工具，請先移除其中一款。");
    }
  }

  function resetFilters() {
    setQuery("");
    setCategory("all");
    setPrice("all");
    setSavedOnly(false);
  }

  function showBookmarks() {
    setSavedOnly(!savedOnly);
    setQuery("");
    setCategory("all");
    setPrice("all");
    document.getElementById("catalogue")?.scrollIntoView({ block: "start" });
  }

  return (
    <div
      className={`catalog-site ${comparedTools.length ? "has-compare-bar" : ""}`}
      id="top"
    >
      <a className="skip-link" href="#catalogue">
        跳到工具目錄
      </a>
      <SiteHeader
        bookmarkCount={bookmarkCount}
        onBookmarks={showBookmarks}
        savedOnly={savedOnly}
      />
      <main>
        <Hero count={catalog.data ? tools.length : undefined} />
        <FeaturedTools tools={tools} onDetails={openDetail} />
        <section
          className="catalogue-section page-shell"
          id="catalogue"
          aria-labelledby="catalogue-title"
        >
          <aside className="category-rail" aria-label="工具分類">
            <div className="rail-heading">
              <span className="eyebrow">FIND YOUR FIT</span>
              <h2>探索分類</h2>
            </div>
            <div className="category-list">
              <button
                className={`category-button ${category === "all" ? "is-active" : ""}`}
                onClick={() => setCategory("all")}
                aria-pressed={category === "all"}
              >
                <LayoutGrid size={17} aria-hidden="true" />
                <span>所有工具</span>
                <span className="category-count">
                  {catalog.data ? tools.length : "—"}
                </span>
              </button>
              {categories.map(item => {
                const Icon = categoryIcons[item.id];
                return (
                  <button
                    className={`category-button ${category === item.id ? "is-active" : ""}`}
                    key={item.id}
                    onClick={() => setCategory(item.id)}
                    aria-pressed={category === item.id}
                  >
                    <Icon size={17} aria-hidden="true" />
                    <span>{item.name}</span>
                    <span className="category-count">
                      {catalog.data
                        ? tools.filter(tool => tool.category === item.id).length
                        : "—"}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="rail-tip">
              <SlidersHorizontal size={18} aria-hidden="true" />
              <h3>先搵用途，再睇價錢。</h3>
              <p>揀最多 3 款工具，並排比較功能、免費額度同使用限制。</p>
              <a href="#start">
                睇新手入門
                <ArrowRight size={14} aria-hidden="true" />
              </a>
            </div>
          </aside>
          <div className="results-panel">
            <div className="catalogue-heading">
              <div>
                <span className="eyebrow">
                  A LITTLE HELP, A LOT OF POSSIBILITY
                </span>
                <h2 id="catalogue-title">
                  {savedOnly
                    ? "留低啱你嘅好工具。"
                    : activeCategory
                      ? activeCategory.name
                      : "好工具，按你需要搵。"}
                </h2>
              </div>
              <span className="catalogue-total">
                {catalog.data ? `${tools.length} 款精選` : "工具目錄"}
              </span>
            </div>
            <div className="catalogue-toolbar">
              <div className="search-field" role="search">
                <Search size={19} aria-hidden="true" />
                <label className="sr-only" htmlFor="tool-search">
                  搜尋工具名稱、分類、功能或關鍵字
                </label>
                <input
                  id="tool-search"
                  type="search"
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="搜尋工具、功能或關鍵字…"
                  autoComplete="off"
                />
                {query && (
                  <button
                    className="icon-button"
                    onClick={() => setQuery("")}
                    aria-label="清除搜尋"
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                )}
              </div>
              <div className="select-control">
                <label className="sr-only" htmlFor="price-filter">
                  按免費方案篩選
                </label>
                <select
                  id="price-filter"
                  value={price}
                  onChange={event => setPrice(event.target.value)}
                >
                  <option value="all">所有收費</option>
                  <option value="free">有免費方案</option>
                  <option value="paid">付費 / 試用</option>
                </select>
                <ChevronDown size={14} aria-hidden="true" />
              </div>
              <div className="select-control sort-control">
                <label className="sr-only" htmlFor="tool-sort">
                  工具排序
                </label>
                <select
                  id="tool-sort"
                  value={sort}
                  onChange={event => setSort(event.target.value)}
                >
                  <option value="editorial">編輯排列</option>
                  <option value="name">名稱 A–Z</option>
                  <option value="price">月費 USD 由低至高</option>
                </select>
                <ChevronDown size={14} aria-hidden="true" />
              </div>
            </div>
            {sort === "price" && (
              <p className="sort-note">
                以已知 USD
                月費排序；不明價格列最後，年繳折算及其他幣別請另外核對。
              </p>
            )}
            {savedOnly && (
              <div className="bookmarks-note">
                <Bookmark size={15} aria-hidden="true" />
                <p>
                  收藏只儲存在呢個瀏覽器，唔會同步到其他裝置。
                  {!bookmarks.available &&
                    "目前無法永久儲存，收藏只會保留至本次頁面關閉。"}
                </p>
                <button onClick={() => setSavedOnly(false)}>睇全部</button>
              </div>
            )}
            {!savedOnly && !bookmarks.available && (
              <p className="storage-note">
                此瀏覽器暫時無法儲存收藏；你仍然可以搜尋、查看及比較工具。
              </p>
            )}
            {catalog.isError && (
              <div className="catalog-status catalog-error" role="alert">
                <AlertCircle size={19} aria-hidden="true" />
                <div>
                  <strong>工具資料暫時未能載入</strong>
                  <p>
                    {catalog.error.message}
                    {catalog.data
                      ? " 以下仍顯示上次成功取得嘅資料，唔代表價格已重新核對。"
                      : " 我哋唔會用示範資料代替真實目錄。"}
                  </p>
                </div>
                <button
                  className="button-outline"
                  disabled={catalog.isFetching}
                  onClick={() => void catalog.refetch()}
                >
                  重新嘗試
                </button>
              </div>
            )}
            {catalog.isFetching && (
              <div className="catalog-status catalog-loading" role="status">
                <Loader2 size={16} className="spin" aria-hidden="true" />
                <span>
                  {catalog.data
                    ? "正在讀取資料庫目錄…"
                    : "正在載入真實工具資料…"}
                </span>
              </div>
            )}
            {catalog.data && (
              <div className="results-meta">
                <p role="status">
                  顯示 <strong>{selected.length}</strong> 款工具
                  {savedOnly
                    ? "・我的收藏"
                    : activeCategory
                      ? `・${activeCategory.description}`
                      : "・各有所長，冇通用排名"}
                </p>
                {hasFilters && (
                  <button className="clear-filters" onClick={resetFilters}>
                    清除篩選
                    <X size={13} aria-hidden="true" />
                  </button>
                )}
              </div>
            )}
            {catalog.isPending ? (
              <div className="tools-grid" aria-hidden="true">
                {Array.from({ length: 6 }, (_, index) => (
                  <div className="tool-skeleton" key={index}>
                    <span />
                    <div />
                    <div />
                    <div />
                  </div>
                ))}
              </div>
            ) : selected.length ? (
              <div className="tools-grid">
                {selected.map(tool => (
                  <ToolCard
                    key={tool.id}
                    tool={tool}
                    bookmarked={bookmarks.ids.includes(tool.id)}
                    compared={compareIds.includes(tool.id)}
                    compareDisabled={
                      comparedTools.length >= 3 && !compareIds.includes(tool.id)
                    }
                    onBookmark={() => toggleBookmark(tool)}
                    onCompare={() => toggleCompare(tool)}
                    onDetails={trigger => openDetail(tool, trigger)}
                  />
                ))}
              </div>
            ) : catalog.data ? (
              <div className="empty-state">
                <Search size={30} strokeWidth={1.4} aria-hidden="true" />
                <h3>
                  {savedOnly
                    ? "暫時未有符合條件嘅收藏。"
                    : "暫時搵唔到符合條件嘅工具。"}
                </h3>
                <p>
                  {savedOnly
                    ? "喺工具卡按收藏符號，留低想再睇嘅工具。"
                    : "試吓另一個關鍵字，或者放寬分類同收費條件。"}
                </p>
                {hasFilters && (
                  <button className="button-outline" onClick={resetFilters}>
                    返回所有工具
                    <ArrowRight size={15} aria-hidden="true" />
                  </button>
                )}
              </div>
            ) : null}
            {catalog.data && (
              <div className="results-footnote">
                <Check size={14} aria-hidden="true" />
                <PriceCaveat date={verifiedDate} />
              </div>
            )}
          </div>
        </section>
        <GuideSections
          tools={tools}
          onDetails={openDetail}
          date={verifiedDate}
        />
      </main>
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement}
      </div>
      <CompareBar
        tools={comparedTools}
        onRemove={id =>
          setCompareIds(previous => previous.filter(item => item !== id))
        }
        onReset={() => setCompareIds([])}
        onOpen={trigger => {
          compareTrigger.current = trigger;
          setCompareOpen(true);
        }}
      />
      <ToolDialog
        tool={detail}
        onClose={() => setDetail(null)}
        returnFocus={() => detailTrigger.current?.focus()}
      />
      <CompareDialog
        tools={comparedTools}
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        onRemove={id =>
          setCompareIds(previous => previous.filter(item => item !== id))
        }
        onReset={() => setCompareIds([])}
        returnFocus={() => {
          if (compareTrigger.current?.isConnected)
            compareTrigger.current.focus();
          else document.getElementById("tool-search")?.focus();
        }}
        date={verifiedDate}
      />
    </div>
  );
}
