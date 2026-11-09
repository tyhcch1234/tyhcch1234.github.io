import { ArrowDown, ArrowUpRight, Bookmark, Check } from "lucide-react";
import { Brand } from "./CatalogElements";

export function SiteHeader({
  bookmarkCount,
  onBookmarks,
  savedOnly,
}: {
  bookmarkCount: number;
  onBookmarks: () => void;
  savedOnly: boolean;
}) {
  return (
    <header className="site-header">
      <div className="page-shell header-inner">
        <Brand />
        <nav className="main-nav" aria-label="主要導覽">
          <a href="#catalogue">探索工具</a>
          <a href="#start">快速入門</a>
          <a href="#about">關於指南</a>
        </nav>
        <button
          className={`button-outline bookmark-nav ${savedOnly ? "is-active" : ""}`}
          onClick={onBookmarks}
          aria-pressed={savedOnly}
        >
          <Bookmark size={15} aria-hidden="true" />
          <span>我的收藏</span>
          {bookmarkCount > 0 && (
            <span className="bookmark-count">{bookmarkCount}</span>
          )}
        </button>
      </div>
    </header>
  );
}

export function Hero({ count }: { count: number | undefined }) {
  return (
    <section className="hero page-shell" aria-labelledby="hero-title">
      <div className="hero-copy">
        <span className="curation-tag">
          <span aria-hidden="true" />
          精選工具・實用至上
        </span>
        <h1 id="hero-title">
          搵到啱用嘅 <em>AI</em>，<br />
          將時間留畀好點子。
        </h1>
        <p className="hero-description">
          由靈感到完成，總有工具幫到你。
          <br className="desktop-break" />
          一次睇清功能、免費額度同收費，揀得明白，用得順手。
        </p>
        <a className="button-primary hero-cta" href="#catalogue">
          探索所有工具
          <ArrowUpRight size={19} aria-hidden="true" />
        </a>
        <div className="hero-data" aria-label="指南資料概覽">
          <span>
            <strong>{count === undefined ? "—" : count}</strong>款精選工具
          </span>
          <span>
            <strong>8</strong>個實用分類
          </span>
          <span>
            <Check size={15} aria-hidden="true" />
            官方資料來源
          </span>
        </div>
      </div>
      <figure className="hero-art">
        <img
          src={
            import.meta.env.BASE_URL === "/"
              ? "/manus-storage/async-images/KUhICE84ZiGzMbuooIrn1d/image-1.webp"
              : `${import.meta.env.BASE_URL}assets/hero.webp`
          }
          alt="以綠色模組與創作物件組成的AI工具探索插畫"
          fetchPriority="high"
        />
        <figcaption>
          <span>YOUR NEXT TOOL, DISCOVERED.</span>
          <ArrowDown size={14} aria-hidden="true" />
        </figcaption>
      </figure>
    </section>
  );
}
