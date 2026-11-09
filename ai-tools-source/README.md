# AI 精選指南

網站已部署於 [GitHub Pages AI 工具指南](https://tyhcch1234.github.io/ai-tools/)，完整原始碼保存於本資料夾。原有首頁、其他子網站及 Git 歷史均保留。

首批 18 款工具按八類用途整理，研究核實日期為 2026-11-09。程式發布版本為 `0c70a5fcc9c5a870612b7c0c0bd68defb284be6a`，交付紀錄更新版本為 `2d6bedb`；價格研究本身不會自動重新查核。

## 資料與部署

GitHub Pages 託管前端。完整 Node.js／MySQL 後端另行部署於 [正式動態網站](https://aipicks-tywtycjx.manus.space)，公開目錄 API 為 `https://aipicks-tywtycjx.manus.space/api/tools`，已確認 HTTP 200、18 款工具及指定 Pages origin 的 CORS 讀取權限。

本次 GitHub Pages 前端直接讀取正式 API 中的已保存 MySQL 資料。初始 HTML 保留真正資料庫匯出快照；若 API 暫時不可用，頁面繼續顯示已載入資料，並提供警告與重試，而非展示空白或假資料。搜尋、分類、收藏、詳情及最多三款比較在瀏覽器內運行。

## 更新方式

先執行 `pnpm install --frozen-lockfile`，再於安全伺服器環境提供 DATABASE_URL。正式匯出指令為：

```sh
pnpm exec tsx scripts/export-pages.ts --api-url https://aipicks-tywtycjx.manus.space/api/tools
```

將 `pages-dist/` 內容更新到倉庫 `ai-tools/`。不要覆寫根目錄 `index.html`、其他子網站或原站發布設定。省略 `--api-url` 會產生只有本地 `catalog.json` 的静態資料庫快照版本，該模式需要重新匯出才更新資料。

Node.js 後端建置及資料種子維護詳見 MAINTENANCE.md。原始碼及網站不含 GitHub Token、資料庫 DSN 或私人環境設定。更新後端不會自動推送本倉庫；正式 API 可讀取最新已保存資料，但不會自動替研究內容核實新價格。
