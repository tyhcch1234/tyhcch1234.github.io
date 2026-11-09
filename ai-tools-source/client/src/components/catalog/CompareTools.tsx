import type { ReactNode } from "react";
import { ArrowRight, Columns3, X } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { categories, type AITool } from "@shared/catalog";
import { OfficialLink, PriceCaveat, ToolMark } from "./CatalogElements";

export function CompareBar({
  tools,
  onRemove,
  onReset,
  onOpen,
}: {
  tools: AITool[];
  onRemove: (id: string) => void;
  onReset: () => void;
  onOpen: (trigger: HTMLButtonElement) => void;
}) {
  if (!tools.length) return null;
  return (
    <aside className="compare-bar" aria-label="已選工具比較">
      <div className="compare-bar-inner">
        <span className="compare-bar-label">
          <Columns3 size={18} aria-hidden="true" />
          <strong>工具比較</strong>
          <span>{tools.length} / 3</span>
        </span>
        <div className="compare-bar-tools">
          {tools.map(tool => (
            <span className="compare-pill" key={tool.id}>
              {tool.name}
              <button
                onClick={() => onRemove(tool.id)}
                aria-label={`移除 ${tool.name} 比較`}
              >
                <X size={13} aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
        <button className="compare-reset" onClick={onReset}>
          清空
        </button>
        <button
          className="button-primary compare-open"
          disabled={tools.length < 2}
          onClick={event => onOpen(event.currentTarget)}
        >
          {tools.length < 2 ? "再揀 1 款" : "開始比較"}
          <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}

export function CompareDialog({
  tools,
  open,
  onClose,
  onRemove,
  onReset,
  returnFocus,
  date,
}: {
  tools: AITool[];
  open: boolean;
  onClose: () => void;
  onRemove: (id: string) => void;
  onReset: () => void;
  returnFocus: () => void;
  date: string;
}) {
  const crossCategory = new Set(tools.map(tool => tool.category)).size > 1;
  const rows: { label: string; render: (tool: AITool) => ReactNode }[] = [
    {
      label: "工具分類",
      render: tool =>
        categories.find(category => category.id === tool.category)?.name,
    },
    {
      label: "官方價格",
      render: tool => (
        <>
          <strong>{tool.priceLabel}</strong>
          <p className="billing-note">{tool.billingNote}</p>
        </>
      ),
    },
    {
      label: "免費方案與額度",
      render: tool => (
        <>
          <span
            className={`free-label ${tool.hasFree ? "has-free" : "is-paid"}`}
          >
            {tool.hasFree ? "有免費方案" : "付費 / 試用"}
          </span>
          <p>{tool.freeSummary}</p>
        </>
      ),
    },
    {
      label: "主要功能",
      render: tool => (
        <ul>
          {tool.features.map((feature, i) => (
            <li key={i}>{feature}</li>
          ))}
        </ul>
      ),
    },
    {
      label: "適用對象／場景",
      render: tool => (
        <ul>
          {tool.bestFor.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      ),
    },
    {
      label: "使用限制",
      render: tool => (
        <ul>
          {tool.limitations.map((limit, i) => (
            <li key={i}>{limit}</li>
          ))}
        </ul>
      ),
    },
    {
      label: "平台與語言",
      render: tool => (
        <>
          <p>{tool.platforms.join("、")}</p>
          <p>{tool.languages}</p>
        </>
      ),
    },
    { label: "地區供應", render: tool => tool.regionNote },
    {
      label: "來源及核對日期",
      render: tool => (
        <>
          <OfficialLink url={tool.pricingUrl}>官方價格頁</OfficialLink>
          <p>
            <time dateTime={tool.verifiedDate}>{tool.verifiedDate}</time>
          </p>
        </>
      ),
    },
  ];
  return (
    <Dialog
      open={open}
      onOpenChange={value => {
        if (!value) onClose();
      }}
    >
      <DialogContent
        className="catalog-dialog comparison-dialog"
        showCloseButton={false}
        onCloseAutoFocus={event => {
          event.preventDefault();
          returnFocus();
        }}
      >
        <DialogClose
          className="dialog-close icon-button"
          aria-label="關閉工具比較"
        >
          <X size={20} aria-hidden="true" />
        </DialogClose>
        <span className="eyebrow">SIDE BY SIDE</span>
        <DialogTitle>睇清分別，再揀啱用嘅。</DialogTitle>
        <DialogDescription>
          並排比較功能、收費同限制。最多 3
          款；冇一款工具適合所有人，亦冇通用贏家。
        </DialogDescription>
        <p className="comparison-note">
          {crossCategory
            ? "你揀咗不同分類嘅工具，用途未必相同。想比較替代選擇，建議先揀同一分類。"
            : "同一分類，亦可以各有所長。由你嘅使用場景同預算出發，唔好單憑月費決定。"}
        </p>
        {tools.length ? (
          <div
            className="comparison-scroll"
            tabIndex={0}
            role="region"
            aria-label="工具比較表，可左右捲動"
          >
            <table className="comparison-table">
              <caption className="sr-only">
                已選工具的功能、費用、免費額度、適用場景與限制
              </caption>
              <thead>
                <tr>
                  <th scope="col">比較項目</th>
                  {tools.map(tool => (
                    <th scope="col" key={tool.id}>
                      <div className="comparison-tool-heading">
                        <ToolMark tool={tool} small />
                        <strong>{tool.name}</strong>
                        <button
                          className="icon-button"
                          onClick={() => onRemove(tool.id)}
                          aria-label={`移除 ${tool.name} 比較`}
                        >
                          <X size={15} aria-hidden="true" />
                        </button>
                      </div>
                      <OfficialLink url={tool.officialUrl}>
                        官方網站
                      </OfficialLink>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    {tools.map(tool => (
                      <td key={tool.id}>{row.render(tool)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-comparison">
            已清空比較。關閉視窗，重新揀選工具。
          </p>
        )}
        <div className="comparison-footer">
          <PriceCaveat date={date} />
          <button
            className="button-outline"
            onClick={onReset}
            disabled={!tools.length}
          >
            清空比較
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
