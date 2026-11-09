# AI 精選指南

GitHub Pages 網站路徑為 https://tyhcch1234.github.io/ai-tools/ ，完整原始碼保存於本資料夾。原有網站首頁及其他子網站未被取代。

本次原始碼版本：`0c70a5fcc9c5a870612b7c0c0bd68defb284be6a`。工具研究核實日期：2026-11-09，首批 18 款工具及八種用途分類。

## 資料與部署

GitHub Pages 只託管靜態內容。本次 Pages 版本使用已保存 MySQL 資料庫匯出的初始 HTML 與 catalog.json 快照，所有搜尋、分類、收藏、詳情與最多三款比較在瀏覽器內運行。快照不會自動同步資料庫修改，更新需重新發布。完整 Node.js／MySQL 動態後端仍保留於原 Manus 專案，另行發佈；公開後可在匯出時指定真實 API 網址。

執行 `pnpm install --frozen-lockfile`，然後以安全伺服器環境提供 DATABASE_URL；執行 `pnpm exec tsx scripts/export-pages.ts` 匯出 pages-dist/。若已有公開後端，可用 `pnpm exec tsx scripts/export-pages.ts --api-url https://正式後端/api/tools`，不把 DSN 或 API 憑證放入瀏覽器。讀取 API 暫時失敗時保留快照並顯示警告。

將 pages-dist/ 內容更新到倉庫 ai-tools/；不要覆寫根目錄 index.html、其他子網站或原站發布設定。Node.js 後端建置方式及資料種子維護詳見 MAINTENANCE.md。

原始碼與網站不含 GitHub Token、資料庫 DSN 或私人環境設定。GitHub Pages 與 Node.js 後端是不同部署，更新後端本身不會自動更新本倉庫。
