#!/usr/bin/env bash
# 重建首頁（自動抓 GitHub 所有 repo + 站內頁面）並發佈到 GitHub Pages
set -euo pipefail
cd "$(dirname "$0")"
python3 build_index.py
git add -A
git commit -m "更新首頁索引：$(date '+%Y-%m-%d %H:%M')" || echo "（沒有變更）"
git push origin HEAD
echo "已發佈：https://tyhcch1234.github.io/"
