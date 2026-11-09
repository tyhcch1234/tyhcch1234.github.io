import { ArrowUpRight } from "lucide-react";
import { featuredIds, type AITool } from "@shared/catalog";
import { ToolMark } from "./CatalogElements";

export function FeaturedTools({
  tools,
  onDetails,
}: {
  tools: AITool[];
  onDetails: (tool: AITool, trigger: HTMLButtonElement) => void;
}) {
  const featured = featuredIds
    .map(id => tools.find(tool => tool.id === id))
    .filter((tool): tool is AITool => Boolean(tool));
  if (!featured.length) return null;
  return (
    <section
      className="featured-section page-shell"
      aria-labelledby="featured-title"
    >
      <div className="featured-heading">
        <span className="eyebrow">THE EDITOR’S PICKS</span>
        <h2 id="featured-title">唔知由邊款開始？</h2>
        <p>由你想做嘅事，搵一個起點。</p>
      </div>
      <div className="featured-strip">
        {featured.map(tool => (
          <button
            className="featured-item"
            key={tool.id}
            onClick={event => onDetails(tool, event.currentTarget)}
            aria-label={`編輯推薦：${tool.name}，查看詳情`}
          >
            <div className="featured-item-top">
              <ToolMark tool={tool} small />
              <ArrowUpRight size={17} aria-hidden="true" />
            </div>
            <span className="featured-scenario">
              {tool.bestFor[0] || tool.tagline}
            </span>
            <strong>{tool.name}</strong>
            {["chatgpt", "claude"].includes(tool.id) && (
              <span className="featured-region-note">官方未列香港</span>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
