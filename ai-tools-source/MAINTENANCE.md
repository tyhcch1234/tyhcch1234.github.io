# AI 精選指南維護說明

網站是一個獨立 Manus 網站，並未修改 `tyhcch1234.github.io` 原站。初始研究以 2026-11-09 為查核日期，18 款具代表性工具按八類用途整理；「精選」是編輯選集，並非全球客觀排名。資料不會自動更新，後續應重新查閱官方定價及條款。

## 資料與前後端

`shared/catalog.ts` 定義共用格式、分類與搜尋邏輯。`research/*.json` 保存初始官方研究來源。`server/catalog.ts` 從託管 MySQL `ai_tools` 表讀取資料；`GET /api/tools` 回傳公開工具內容，初始首頁 HTML 亦由同一資料庫產生，供無 JavaScript 瀏覽及搜尋引擎讀取。用戶不需要登入。

`drizzle/0001_ai_catalog.sql` 是可重複執行的新增資料表遷移。`pnpm exec tsx scripts/seed-catalog.ts` 一次性把 18 款研究資料寫入資料庫，並於 `ai_catalog_seed_runs` 記錄版本；重跑不會覆寫已有工具。啟動或部署不會重跑種子。維護資料應另設新版本資料更新遷移，不可假設修改研究 JSON 就會更新已寫入的資料。

資料庫 DSN 只存在伺服器環境變數 `DATABASE_URL`，不會放入瀏覽器。公開 API 沒有寫入功能；本版沒有新增管理介面或使用者帳號。若收藏功能存在，只儲存在当前瀏覽器，不是雲端收藏。開發與正式環境共用託管資料庫，應避免用破壞性測試修改正式資料。

## 本機與版本

執行 `pnpm dev` 使用 3000 埠。執行 `pnpm check` 檢查型別，`pnpm test` 執行測試，`pnpm build` 建置前端和伺服器。發佈使用根目錄 Dockerfile，內容來自已保存 checkpoint，而非未提交的工作檔。公開網址未確認前不填寫猜測 canonical 或 sitemap。

價格只比較已核實的美元付費月價；未知月費排序在最後，年繳月均價不充當真正月繳價。Notion 平台免費不等於 Notion AI 永久免費；Runway 和 Gamma 的免費點數屬一次性配額。ChatGPT 及 Claude 地區限制須讓讀者看見，不能保證香港可用。

## GitHub Pages 子目錄版本

指定 GitHub 倉庫是 `tyhcch1234/tyhcch1234.github.io`；發布目標為 `/ai-tools/`，完整原始碼副本在 `/ai-tools-source/`。這不是切換 Manus 專案的主倉庫；原站首頁、其他子網站與 Git 歷史需要保留。

執行 `pnpm exec tsx scripts/export-pages.ts` 會以 `/ai-tools/` 為資產及路由基底，把真實 MySQL 資料匯出到 `pages-dist/`：包含完整初始 HTML、`catalog.json` 與所需圖片。此預設為資料庫快照，不會自動同步後續数据库修改。更新需要重新匯出並發布。GitHub Pages 不會運行 Node.js 或 MySQL。

若另行部署的資料庫後端已公開，執行 `pnpm exec tsx scripts/export-pages.ts --api-url https://正式後端網址/api/tools`，前端會從該公開 API 讀取最新已保存資料；API 暫時不可用時保留初始資料庫快照並顯示讀取警告。正式後端的 `/api/tools` 只為 `https://tyhcch1234.github.io` 設置跨來源允許讀取，無跨來源身份 cookies；不公開任何資料庫 DSN 或 GitHub Token。首次 Manus 發佈預設可能為私人，公開選項由擁有者確認。

GitHub 更新只應包含 `ai-tools/` 和 `ai-tools-source/`。推送前取得最新 main 並整合，不可 force-push，不修改原站發布來源或根目錄首頁。源碼不包含 `.env`、依賴資料夾、建置暫存或憑證。第一次發布應記錄原首頁 blob SHA，以核對未改动。

## 已確認正式網址

GitHub Pages：https://tyhcch1234.github.io/ai-tools/ 。完整原始碼：https://github.com/tyhcch1234/tyhcch1234.github.io/tree/main/ai-tools-source 。正式動態後端：https://aipicks-tywtycjx.manus.space ，公開目錄 API：https://aipicks-tywtycjx.manus.space/api/tools 。此 API 已以指定 Pages origin 實際驗證 HTTP 200 及 18 款工具。

正式 Pages 匯出指令為 `pnpm exec tsx scripts/export-pages.ts --api-url https://aipicks-tywtycjx.manus.space/api/tools`。前端直接讀取已保存資料庫內容，讀取失敗時保留匯出當刻的初始資料並顯示警告；研究價格資料本身不會自動重新查核。首頁原 blob 保留核對值為 `48f858ddd3e46c6991c9b4ed6a6e4597a95060c6`。
