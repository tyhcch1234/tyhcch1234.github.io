#!/usr/bin/env bash
# 重建首頁（自動抓 GitHub 所有 repo + 站內頁面）並發佈到 GitHub Pages
# 首頁與 sites.json 直接以明文輸出（已取消密碼鎖）。
set -euo pipefail
cd "$(dirname "$0")"
python3 build_index.py
git add -A
git commit -m "更新首頁索引：$(date '+%Y-%m-%d %H:%M')" || echo "（沒有變更）"
git push origin HEAD
echo "已發佈：https://tyhcch1234.github.io/"
