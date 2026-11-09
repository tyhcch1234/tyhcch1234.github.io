import type { ReactNode } from "react";
import {
  ArrowUpRight,
  AudioLines,
  Code2,
  Image,
  Layers3,
  LayoutGrid,
  MessageSquare,
  Presentation,
  Search,
  Video,
  Workflow,
} from "lucide-react";
import { categories, type AITool, type CategoryId } from "@shared/catalog";
import { safeExternalUrl } from "@/lib/catalogClient";

export const categoryIcons = {
  chat: MessageSquare,
  research: Search,
  image: Image,
  video: Video,
  audio: AudioLines,
  code: Code2,
  office: Workflow,
  slides: Presentation,
};

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <a
      className={`brand ${compact ? "brand-compact" : ""}`}
      href={`${import.meta.env.BASE_URL}#top`}
      aria-label="AI 精選指南，返回頂部"
    >
      <svg
        className="brand-mark"
        width="35"
        height="35"
        viewBox="0 0 36 36"
        fill="none"
        aria-hidden="true"
      >
        <path d="M3 3H17V17H3V3Z" fill="currentColor" />
        <path d="M20 3H33V16H20V3Z" fill="currentColor" opacity=".44" />
        <path d="M3 20H16V33H3V20Z" fill="currentColor" opacity=".44" />
        <path d="M20 20H33V33H20V20Z" fill="currentColor" />
        <path d="M25 23L29 27L25 31" stroke="#F7F8F5" strokeWidth="1.8" />
      </svg>
      <span>
        <span className="brand-english">AI PICKS</span>
        <span className="brand-chinese">AI 精選指南</span>
      </span>
    </a>
  );
}

export function ToolMark({
  tool,
  small = false,
}: {
  tool: AITool;
  small?: boolean;
}) {
  return (
    <span
      className={`tool-mark tone-${tool.category} ${small ? "tool-mark-small" : ""}`}
      aria-hidden="true"
    >
      {tool.name
        .replace(/[^a-zA-Z0-9]/g, "")
        .slice(0, 2)
        .toUpperCase() || "AI"}
    </span>
  );
}

export function CategoryLabel({ id }: { id: CategoryId }) {
  return (
    <span className="category-label">
      {categories.find(category => category.id === id)?.short}
    </span>
  );
}

export function OfficialLink({
  url,
  children,
  className = "",
}: {
  url: string;
  children: ReactNode;
  className?: string;
}) {
  const href = safeExternalUrl(url);
  if (!href)
    return <span className={className}>{children}（連結未能讀取）</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`external-link ${className}`}
    >
      {children}
      <ArrowUpRight size={15} aria-hidden="true" />
      <span className="sr-only">（於新分頁開啟）</span>
    </a>
  );
}

export function PriceCaveat({ date = "2026-11-09" }: { date?: string }) {
  return (
    <p className="price-caveat">
      官方資料核對：<time dateTime={date}>{date}</time>。價格以 USD
      為主，其他幣別另有標示；年繳折算月費不等於月繳價。稅項、額度及地區供應可能不同，付款前請再核對官方頁面。本指南並非自動更新。
    </p>
  );
}

export { Layers3, LayoutGrid };
