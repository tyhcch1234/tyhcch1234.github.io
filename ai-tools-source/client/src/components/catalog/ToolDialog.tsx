import { Check, Minus, X } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AITool } from "@shared/catalog";
import {
  CategoryLabel,
  OfficialLink,
  PriceCaveat,
  ToolMark,
} from "./CatalogElements";

function DetailList({
  title,
  items,
  caution = false,
}: {
  title: string;
  items: string[];
  caution?: boolean;
}) {
  return (
    <section className="detail-list">
      <h3>{title}</h3>
      <ul>
        {items.map((item, index) => (
          <li key={`${item}-${index}`}>
            {caution ? (
              <Minus size={15} aria-hidden="true" />
            ) : (
              <Check size={15} aria-hidden="true" />
            )}
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ToolDialog({
  tool,
  onClose,
  returnFocus,
}: {
  tool: AITool | null;
  onClose: () => void;
  returnFocus: () => void;
}) {
  return (
    <Dialog
      open={Boolean(tool)}
      onOpenChange={open => {
        if (!open) onClose();
      }}
    >
      {tool && (
        <DialogContent
          className="catalog-dialog detail-dialog"
          showCloseButton={false}
          onCloseAutoFocus={event => {
            event.preventDefault();
            returnFocus();
          }}
        >
          <DialogClose
            className="dialog-close icon-button"
            aria-label="關閉工具詳情"
          >
            <X size={20} aria-hidden="true" />
          </DialogClose>
          <div className="detail-header">
            <ToolMark tool={tool} />
            <div>
              <CategoryLabel id={tool.category} />
              <DialogTitle>{tool.name}</DialogTitle>
            </div>
          </div>
          <DialogDescription className="detail-intro">
            {tool.description}
          </DialogDescription>
          <div className="detail-quick-actions">
            <OfficialLink url={tool.officialUrl} className="button-primary">
              前往官方網站
            </OfficialLink>
            <OfficialLink url={tool.pricingUrl} className="text-link">
              核對官方價格
            </OfficialLink>
          </div>
          <div className="detail-grid">
            <DetailList title="可以幫你做啲咩" items={tool.features} />
            <DetailList title="適合邊啲人／情境" items={tool.bestFor} />
            <DetailList title="值得留意嘅優點" items={tool.pros} />
            <DetailList title="使用限制" items={tool.limitations} caution />
          </div>
          <section className="detail-facts">
            <h3>使用前，先睇清楚</h3>
            <dl>
              <div>
                <dt>支援平台</dt>
                <dd>{tool.platforms.join("、")}</dd>
              </div>
              <div>
                <dt>語言</dt>
                <dd>{tool.languages}</dd>
              </div>
              <div>
                <dt>地區供應</dt>
                <dd>{tool.regionNote}</dd>
              </div>
            </dl>
          </section>
          <section className="detail-plans">
            <div className="detail-section-heading">
              <h3>方案與收費</h3>
              <span
                className={`free-label ${tool.hasFree ? "has-free" : "is-paid"}`}
              >
                {tool.hasFree ? "有免費方案" : "付費 / 試用"}
              </span>
            </div>
            <p className="detail-free-summary">{tool.freeSummary}</p>
            <p className="billing-note">{tool.billingNote}</p>
            <div className="plans-list">
              {tool.plans.map((plan, index) => (
                <div className="plan-row" key={`${plan.name}-${index}`}>
                  <div>
                    <h4>{plan.name}</h4>
                    <p>{plan.summary}</p>
                  </div>
                  <div className="plan-price">
                    <strong>{plan.price}</strong>
                    <span>{plan.billing}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="detail-sources">
            <h3>官方來源與核對紀錄</h3>
            <ul>
              {tool.sources.map((source, index) => (
                <li key={`${source.url}-${index}`}>
                  <OfficialLink url={source.url}>{source.title}</OfficialLink>
                </li>
              ))}
            </ul>
            <p>{tool.verificationNote}</p>
            <PriceCaveat date={tool.verifiedDate} />
          </section>
        </DialogContent>
      )}
    </Dialog>
  );
}
