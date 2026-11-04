#!/usr/bin/env bash
# 重建首頁（自動抓 GitHub 所有 repo + 站內頁面）並發佈到 GitHub Pages
# 首頁會以密碼鎖加密：密碼由 .lockpass（不入 repo）或 PAGE_PASSWORD 提供，
# 缺少密碼時建置會中止，不會產生無鎖的明文首頁。
set -euo pipefail
cd "$(dirname "$0")"
python3 build_index.py
git add -A
git commit -m "更新首頁索引：$(date '+%Y-%m-%d %H:%M')" || echo "（沒有變更）"
git push origin HEAD
echo "已發佈：https://tyhcch1234.github.io/"
