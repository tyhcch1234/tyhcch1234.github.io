import { ArrowUpRight, BookOpen, ShieldCheck } from "lucide-react";
import type { AITool } from "@shared/catalog";
import { Brand, PriceCaveat } from "./CatalogElements";
import { isCatalogSnapshot } from "@/lib/catalogClient";

export function GuideSections({
  tools,
  onDetails,
  date,
}: {
  tools: AITool[];
  onDetails: (tool: AITool, trigger: HTMLButtonElement) => void;
  date: string;
}) {
  const steps = [
    {
      number: "01",
      title: "先由一件小事開始",
      text: "揀一段要改寫嘅文字，或者一個要整理嘅想法。講清楚背景、目標同格式；個別功能及地區供應請先睇詳情。",
      tool:
        tools.find(tool => tool.id === "gemini") ||
        tools.find(
          tool =>
            tool.category === "chat" && !["chatgpt", "claude"].includes(tool.id)
        ),
    },
    {
      number: "02",
      title: "畀資料，亦要核對資料",
      text: "用你有權使用嘅文件試做摘要，再跟返來源核對。唔好上載密碼、客戶私隱或機密資料。",
      tool:
        tools.find(tool => tool.id === "notebooklm") ||
        tools.find(tool => tool.category === "research"),
    },
    {
      number: "03",
      title: "將想法變成第一稿",
      text: "試做一份簡報或視覺草稿。AI 幫你起步，最後嘅內容、版權同細節由你把關。",
      tool:
        tools.find(tool => tool.id === "canva") ||
        tools.find(tool => tool.category === "slides"),
    },
  ];
  return (
    <>
      <section
        className="beginner-section"
        id="start"
        aria-labelledby="start-title"
      >
        <div className="page-shell">
          <div className="section-heading">
            <div>
              <span className="eyebrow">START SMALL, GO FURTHER</span>
              <h2 id="start-title">第一次用 AI？咁樣開始。</h2>
            </div>
            <BookOpen size={26} strokeWidth={1.4} aria-hidden="true" />
          </div>
          <div className="beginner-grid">
            {steps.map(step => (
              <article className="beginner-step" key={step.number}>
                <span className="step-number">{step.number}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
                {step.tool && (
                  <button
                    className="text-link"
                    onClick={event =>
                      onDetails(step.tool!, event.currentTarget)
                    }
                  >
                    試吓 {step.tool.name}
                    <ArrowUpRight size={15} aria-hidden="true" />
                  </button>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>
      <section
        className="about-section page-shell"
        id="about"
        aria-labelledby="about-title"
      >
        <div className="about-title">
          <span className="eyebrow">A GUIDE, NOT A RANKING</span>
          <h2 id="about-title">
            實用推薦。
            <br />
            清楚交代。
          </h2>
          <ShieldCheck size={28} strokeWidth={1.3} aria-hidden="true" />
        </div>
        <div className="about-copy">
          <p>
            AI
            精選指南係一份持續可擴充嘅工具目錄，從全球工具中按代表性使用場景、清晰功能同官方價格資料作編輯挑選。推薦只係探索起點，唔係測試評分，亦唔係包羅全球嘅客觀排行榜。
          </p>
          <p>
            有免費方案唔等於無限制，免費試用亦唔等於長期免費。AI
            輸出可能出錯；重要資料要核對，敏感內容要先考慮私隱。各工具嘅語言、付款同地區政策不同，本指南不保證香港可用。
          </p>
          <PriceCaveat date={date} />
          {isCatalogSnapshot() && (
            <p>GitHub Pages 版本使用資料庫匯出快照，更新需要重新發佈。</p>
          )}
          <a className="text-link" href="#catalogue">
            喺工具詳情查看官方來源
            <ArrowUpRight size={15} aria-hidden="true" />
          </a>
        </div>
      </section>
      <footer className="site-footer">
        <div className="page-shell footer-inner">
          <Brand compact />
          <p>揀得明白，用得順手。</p>
          <nav aria-label="頁尾導覽">
            <a href="#catalogue">工具與來源</a>
            <a href="#start">新手入門</a>
            <a href="#about">編輯準則</a>
          </nav>
          <span className="footer-date">資料核對 {date}</span>
        </div>
      </footer>
    </>
  );
}
