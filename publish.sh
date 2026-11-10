#!/usr/bin/env bash
# 重建首頁（自動抓 GitHub 所有 repo + 站內頁面）並發佈到 GitHub Pages
# 首頁以密碼閘門輸出：build_index.py 產生明文，lock.js 加密成 assets/payload.js。
set -euo pipefail
cd "$(dirname "$0")"
python3 build_index.py
node lock.js
git add -A
git commit -m "更新首頁索引：$(date '+%Y-%m-%d %H:%M')" || echo "（沒有變更）"
git push origin HEAD
echo "已發佈：https://tyhcch1234.github.io/"
