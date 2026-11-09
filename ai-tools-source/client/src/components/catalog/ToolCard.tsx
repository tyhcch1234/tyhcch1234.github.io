import { ArrowRight, Bookmark, Check } from "lucide-react";
import type { AITool } from "@shared/catalog";
import { CategoryLabel, OfficialLink, ToolMark } from "./CatalogElements";

interface ToolCardProps {
  tool: AITool;
  bookmarked: boolean;
  compared: boolean;
  compareDisabled: boolean;
  onBookmark: () => void;
  onCompare: () => void;
  onDetails: (trigger: HTMLButtonElement) => void;
}

export function ToolCard({
  tool,
  bookmarked,
  compared,
  compareDisabled,
  onBookmark,
  onCompare,
  onDetails,
}: ToolCardProps) {
  return (
    <article
      className={`tool-card ${compared ? "is-compared" : ""}`}
      aria-labelledby={`tool-${tool.id}`}
    >
      <div className="tool-card-top">
        <ToolMark tool={tool} />
        <CategoryLabel id={tool.category} />
        <button
          className={`icon-button bookmark-button ${bookmarked ? "is-bookmarked" : ""}`}
          onClick={onBookmark}
          aria-label={`${bookmarked ? "取消收藏" : "收藏"} ${tool.name}`}
          aria-pressed={bookmarked}
          title={bookmarked ? "取消收藏" : "收藏工具"}
        >
          <Bookmark
            size={17}
            fill={bookmarked ? "currentColor" : "none"}
            aria-hidden="true"
          />
        </button>
      </div>
      <h3 id={`tool-${tool.id}`}>{tool.name}</h3>
      <p className="tool-tagline">{tool.tagline}</p>
      {["chatgpt", "claude"].includes(tool.id) && (
        <span className="region-badge">官方未列香港</span>
      )}
      <div className="feature-chips">
        {tool.features.slice(0, 3).map(feature => (
          <span key={feature}>{feature}</span>
        ))}
      </div>
      <div className="tool-price">
        <span className={`free-label ${tool.hasFree ? "has-free" : "is-paid"}`}>
          {tool.hasFree && <Check size={12} aria-hidden="true" />}
          {tool.hasFree ? "有免費方案" : "付費 / 試用"}
        </span>
        <p className="price-label">{tool.priceLabel}</p>
        <p className="billing-note" title={tool.billingNote}>
          {tool.billingNote}
        </p>
      </div>
      <div className="tool-card-actions">
        <button
          className="details-button"
          onClick={event => onDetails(event.currentTarget)}
          aria-label={`查看 ${tool.name} 詳情`}
        >
          睇詳情
          <ArrowRight size={15} aria-hidden="true" />
        </button>
        <OfficialLink url={tool.officialUrl} className="card-official">
          官方網站
        </OfficialLink>
      </div>
      <label
        className={`compare-toggle ${compareDisabled ? "is-disabled" : ""}`}
      >
        <input
          type="checkbox"
          checked={compared}
          disabled={compareDisabled}
          onChange={onCompare}
          aria-label={`加入比較：${tool.name}`}
        />
        <span>{compared ? "已加入比較" : "加入比較"}</span>
        {compareDisabled && <span className="compare-limit">最多 3 款</span>}
      </label>
    </article>
  );
}
