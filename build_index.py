#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
建立 tyhcch1234.github.io 首頁（自動 repo 索引 + 站內頁面清單）

用法：
    python3 build_index.py            # 重新抓 GitHub，重建 index.html
    python3 build_index.py --offline  # 用 cache/repos.json，不連網

輸出：
    index.html          ← 由 index.template.html + 抓到的資料生成
    cache/repos.json    ← 原始資料快取（下次 --offline 可用）
"""
import json
import os
import re
import subprocess
import sys
import datetime

OWNER = "tyhcch1234"
ROOT_REPO = "tyhcch1234.github.io"
HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "cache", "repos.json")

# ---------------------------------------------------------------- 人手撰寫的文案
# key = repo 名（或虛擬站台名）
OVERRIDES = {
    "fermat-last-theorem": dict(
        title="費馬最後定理", cat="math",
        desc="一句頁邊註記，數學家追了 358 年 · 命題・歷史・證明思路・互動反例搜尋器",
        tags=["數學", "費馬", "最後定理", "fermat", "證明", "科普"],
    ),
    "HKDSE-Maths-Solutions": dict(
        title="HKDSE Maths Solutions", cat="math",
        desc="文憑試數學題解（英文版）· 可按年份或課題瀏覽",
        tags=["dse", "數學", "maths", "題解", "solution"],
    ),
    "HKDSE-Maths-Chi-Solutions": dict(
        title="HKDSE 數學題解", cat="math",
        desc="香港中學文憑試數學（必修部分）中文題解",
        tags=["dse", "數學", "中文", "題解"],
    ),
    "F4_Maths_UT1": dict(
        title="F4 數學 UT1 溫習", cat="math",
        desc="中四統一測驗一 · 重點整理與互動練習",
        tags=["中四", "數學", "ut1", "溫習"],
    ),
    "F3_Maths_UT1": dict(
        title="F3 數學 UT1 溫習", cat="math",
        desc="中三統一測驗一 · 闖關式溫習",
        tags=["中三", "數學", "ut1", "溫習"],
    ),
    "hanzi": dict(
        title="中文字工作紙生成器", cat="lang",
        desc="輸入默書字詞，一鍵產生六步寫字工作紙（Word／A4）",
        tags=["中文", "工作紙", "寫字", "worksheet"], url="hanzi/",
    ),
    "chinese-tracing-app": dict(
        title="中文描紅練習 · 口訣版", cat="lang",
        desc="筆順示範、口訣讀音、練寫與默書，累積分數抽卡",
        tags=["中文", "描紅", "筆順", "默書"],
    ),
    "chinese_writing": dict(
        title="部件拆字練習冊", cat="lang",
        desc="小三 200 基本字 · 繁體部件拆字，讀音可點聽粵音",
        tags=["中文", "部件", "拆字", "小三"],
    ),
    "Chinese_Character": dict(
        title="漢字部件拆解", cat="lang",
        desc="以源流明體示範字形結構，按部首與部件分色",
        tags=["中文", "漢字", "部首", "部件"],
    ),
    "p3-dictation-unit2": dict(
        title="默書探險隊", cat="lang",
        desc="小三第二單元默書 · 遊戲化溫習",
        tags=["中文", "默書", "小三", "dictation"],
    ),
    "p3-common-sense": dict(
        title="小三常識溫習樂園", cat="junior",
        desc="我的好朋友、香港的植物、植物與生活 · 課文重點與多款題型",
        tags=["常識", "小三", "溫習"],
    ),
    "chem-adventure": dict(
        title="化學物質大冒險", cat="junior",
        desc="小三科學探險隊 · 生活中的化學物質與安全保護",
        tags=["科學", "化學", "小三"],
    ),
    "water-to-urine": dict(
        title="一杯水點樣變咗做尿？", cat="junior",
        desc="小腸吸收 → 血液運送 → 腎臟過濾 → 排尿，互動教學",
        tags=["科學", "人體", "腎臟", "教學"],
    ),
    "mindful-kids": dict(
        title="心晴小星球", cat="mind",
        desc="小三正向思維與靜心練習：彩虹呼吸、身體掃描、感恩日記",
        tags=["靜心", "正向", "情緒", "小三"],
    ),
    "brain-training-seniors": dict(
        title="腦友記 · 每日動腦筋", cat="mind",
        desc="長者健腦練習：大字、慢節奏、不計時、不計分",
        tags=["長者", "記憶", "健腦"],
    ),
    "bible-verses-memory": dict(
        title="聖經金句 200 句", cat="mind",
        desc="金句背誦與記憶練習",
        tags=["聖經", "金句", "記憶"],
    ),
    "interior-design-vr-tour": dict(
        title="嘉雲臺室內設計 VR", cat="design",
        desc="4 房 1 套 1811 呎 · 360° 全景導覽",
        tags=["室內設計", "vr", "360", "導覽"],
    ),
    "Fire_Truck_Book": dict(
        title="《香港消防車》閱讀挑戰", cat="design",
        desc="按章節分類 82 題，每題附書本頁碼提示",
        tags=["閱讀", "消防車", "quiz"],
    ),
    "shopping": dict(
        title="全港購物優惠日誌", cat="daily",
        desc="每晚 20 項最抵：超市・網購・商場・餐飲・家電，逐日累積",
        tags=["優惠", "購物", "超市", "著數"],
    ),
    "investment-daily": dict(
        title="每日投資晚報", cat="daily",
        desc="港股・香港樓市・外圍，一晚一份逐日累積",
        tags=["投資", "港股", "樓市", "晚報"],
    ),
    "hot-internet-movie": dict(
        title="每日最興影片 / 熱話", cat="daily",
        desc="Netflix Top 10・YouTube 熱片・香港熱搜，逐日累積",
        tags=["影片", "熱話", "netflix", "youtube", "熱搜"],
    ),
    "image": dict(
        title="圖片作品庫", cat="media",
        desc="海報、圖解、教學插圖，持續累積",
        tags=["圖片", "海報", "插圖", "image"],
    ),
    "movie": dict(
        title="AI 影片作品庫", cat="media",
        desc="生成的短片與動畫，持續累積",
        tags=["影片", "video", "動畫"],
    ),
    "song": dict(
        title="廣東話原創歌詞集", cat="media",
        desc="Cantonese original songs · 原創歌詞與試聽",
        tags=["廣東話", "歌詞", "音樂", "song"],
    ),
    "game": dict(
        title="消防英雄 3D", cat="play",
        desc="Three.js 第一人稱滅火救援遊戲：6 處火頭、3 位居民、180 秒",
        tags=["遊戲", "3d", "消防", "three.js"],
    ),
    "firefighter-3d": dict(
        title="消防英雄 3D", cat="play",
        desc="Three.js 第一人稱滅火救援遊戲：6 處火頭、3 位居民、180 秒",
        tags=["遊戲", "3d", "消防", "three.js"],
    ),
    "pdf-studio": dict(
        title="PDF Studio", cat="tools",
        desc="PDF 轉 Word、合併、A3 分割",
        tags=["pdf", "word", "工具", "合併"],
    ),
    "scanpro": dict(
        title="ScanPro", cat="tools",
        desc="相片轉 PDF 掃描，自動校正與整理",
        tags=["掃描", "pdf", "scan", "工具"],
    ),
    "hk-elderly-benefits": dict(
        title="香港長者福利・優惠一站通", cat="mind",
        desc="可搜尋的長者福利及優惠目錄（2026）",
        tags=["長者", "福利", "優惠", "津貼"],
    ),
    "3d-model-library": dict(
        title="立體模型庫", cat="design",
        desc="可累積的 3D 模型收藏：STL 即時預覽、下載與打印資料",
        tags=["3d", "stl", "模型", "打印"],
    ),
    "shiba-inu-guide": dict(
        title="柴犬手帖", cat="design",
        desc="品種、性格、飲食與照顧指南",
        tags=["柴犬", "寵物", "guide"],
    ),
    "smart-home": dict(
        title="Smart Home DIY", cat="tools",
        desc="ESP32 智能家居網頁控制教學（粵語）",
        tags=["esp32", "smart home", "教學", "iot"],
    ),
    "AI_Company": dict(
        title="AI Company", cat="daily",
        desc="AI 旗艦模型競賽 · 每日追蹤十大 AI 實驗室的旗艦模型",
        tags=["ai", "模型", "比較", "每日"],
    ),
    "ai": dict(
        title="每日 AI 應用", cat="daily",
        desc="最新 AI 應用例子：自製工具、可試玩 demo、新上架產品",
        tags=["ai", "應用", "每日", "demo"],
    ),
}

# 個別頁面的好讀標題（key = repo + "/" + 檔案路徑）
PAGE_TITLES = {
    "HKDSE-Maths-Solutions/DSE_Maths_By_Topic.html": "按課題瀏覽（17 課題 · 全 15 年）",
    "HKDSE-Maths-Solutions/DSE_Maths_Exercise.html": "練習模式（逐題練習）",
    "HKDSE-Maths-Chi-Solutions/DSE_Maths_By_Topic.html": "按課題瀏覽（17 課題 · 全 15 年）",
    "HKDSE-Maths-Chi-Solutions/DSE_Maths_Exercise.html": "練習模式（逐題練習）",
    "p3-common-sense/lesson.html": "課堂版 · 逐頁教學",
    "scanpro/single.html": "單檔離線版",
    "bible-verses-memory/Bible_Verse.html": "金句練習頁",
    "F4_Maths_UT1/F4_UT1_Revision.html": "溫習練習（36 題）",
    "F3_Maths_UT1/中三數學_UT1_溫習測驗.html": "溫習測驗（互動）",
    "chinese-tracing-app/index.html": "主程式",
}

# DSE 課題頁 DSE_<slug>_50_Questions.html 的中文名
TOPIC_NAMES = {
    "percentages": "百分數",
    "coordinate-geometry": "坐標幾何",
    "equations": "方程",
    "estimation-approximation-error": "估算與誤差",
    "formulas-sequences": "公式與數列",
    "functions-graphs": "函數與圖像",
    "geometry": "幾何",
    "indices-exponential-logarithmic": "指數與對數",
    "inequalities-linear-programming": "不等式與線性規劃",
    "mensuration": "度量",
    "polynomials": "多項式",
    "probability": "概率",
    "rate-ratio-variations": "率、比與變分",
    "statistics": "統計",
    "trigonometry": "三角學",
}

SKIP_DIRS = ("node_modules/", "vendor/", "_site/", "assets/", "images/", "img/", "cn/", "docs/")
DATE_DIRS = ("archive/", "deals/", "reports/", "posts/", "daily/")


def gh_api(path, paginate=False):
    """用 gh CLI（已登入，5000 req/hr）呼叫 GitHub API。"""
    cmd = ["gh", "api", path]
    if paginate:
        cmd.append("--paginate")
    out = subprocess.run(cmd, capture_output=True, text=True, check=True).stdout.strip()
    dec = json.JSONDecoder()
    if not paginate:
        return dec.raw_decode(out)[0]
    idx, items = 0, []
    while idx < len(out):
        obj, end = dec.raw_decode(out, idx)
        items.extend(obj if isinstance(obj, list) else [obj])
        idx = end
        while idx < len(out) and out[idx] in " \n\r\t":
            idx += 1
    return items


def is_mass_generated(base):
    return bool(
        re.match(r"^\d{4}_P\d_Q\d+\.html$", base, re.I)
        or re.match(r"^\d{4}_MC_\d+\.html$", base, re.I)
        or re.match(r"^ex_t\d+_q\d+\.html$", base, re.I)
        or re.match(r"^demo.*\.html$", base, re.I)
        or re.match(r"^.*_Q\d+\.html$", base, re.I)
    )


def page_title(repo, path):
    key = repo + "/" + path
    if key in PAGE_TITLES:
        return PAGE_TITLES[key]
    base = os.path.basename(path)
    slug = re.sub(r"\.(html|md)$", "", base, flags=re.I)
    m = re.match(r"^DSE_(.+)_50_Questions$", slug)
    if m:
        key = m.group(1).lower()
        name = TOPIC_NAMES.get(key, m.group(1))
        return "{} · 50 題精練".format(name)
    if re.match(r"^\d{4}-\d{2}-\d{2}", slug):
        return slug.replace("-", "/", 2)[:10]
    slug = re.sub(r"^DSE_", "", slug)
    slug = slug.replace("_", " ").replace("-", " ")
    return slug.strip().capitalize() if slug.isascii() else slug.strip()


def extract_pages(repo, paths):
    """由 repo 的檔案清單抽出『值得放上首頁』的頁面。"""
    named, dated = [], []
    for p in paths:
        low = p.lower()
        if any(low.startswith(d) for d in SKIP_DIRS):
            continue
        base = os.path.basename(p)
        if low.endswith(".html"):
            if base.lower() in ("index.html", "404.html"):
                continue
            if is_mass_generated(base) or ".body." in base.lower():
                continue
            named.append({"t": page_title(repo, p), "u": p})
        elif low.endswith(".md"):
            if not any(low.startswith(d) for d in DATE_DIRS):
                continue
            url = re.sub(r"\.md$", ".html", p)
            dated.append({"t": page_title(repo, p), "u": url, "d": 1})
    named.sort(key=lambda x: x["u"])
    dated.sort(key=lambda x: x["u"], reverse=True)
    return named + dated


def derive(repo):
    """沒有手寫文案的新 repo：由 repo 名／描述自動生成。"""
    name = repo["name"]
    desc = repo.get("description") or "GitHub Pages 網站"
    low = (name + " " + desc).lower()
    tags = [w for w in re.split(r"[\s,，、/・|（）()]+", desc) if len(w) > 1][:6]
    if any(k in low for k in ("math", "數學", "dse")):
        cat = "math"
    elif any(k in low for k in ("中文", "hanzi", "chinese", "dictation", "默書", "寫字")):
        cat = "lang"
    elif any(k in low for k in ("小學", "常識", "科學")) or re.search(r"\bp[1-6]\b", low):
        cat = "junior"
    elif any(k in low for k in ("長者", "記憶", "靜心", "mindful", "bible", "聖經", "brain")):
        cat = "mind"
    elif any(k in low for k in ("設計", "design", "vr", "導覽", "繪本", "tour")):
        cat = "design"
    elif any(k in low for k in ("優惠", "投資", "日誌", "deals", "daily", "熱話", "movie", "news", "brief")):
        cat = "daily"
    elif any(k in low for k in ("圖片", "image", "影片", "video", "作品")):
        cat = "media"
    elif any(k in low for k in ("遊戲", "game", "3d", "互動")):
        cat = "play"
    else:
        cat = "tools"
    return dict(title=name.replace("_", " "), desc=desc, cat=cat, tags=tags)


def build(offline=False):
    if offline:
        data = json.load(open(CACHE, encoding="utf-8"))
    else:
        repos = gh_api("/users/{}/repos?per_page=100&sort=updated".format(OWNER), paginate=True)
        data = []
        for r in repos:
            if r["name"] == ROOT_REPO or r.get("fork") or r.get("archived"):
                continue
            try:
                tree = gh_api(
                    "/repos/{}/{}/git/trees/{}?recursive=1".format(OWNER, r["name"], r["default_branch"])
                )
                paths = [x["path"] for x in tree.get("tree", []) if x.get("type") == "blob"]
            except subprocess.CalledProcessError:
                paths = []
            # 有啟用 Pages，或根目錄有 index.html，就當作網站（has_pages 偶爾會滯後）
            has_root_index = any(p.lower() == "index.html" for p in paths)
            if not (r.get("has_pages") or has_root_index):
                continue
            data.append(dict(
                name=r["name"], desc=r.get("description"),
                updated=r["updated_at"], paths=paths,
                branch=r.get("default_branch") or "main",
            ))
        os.makedirs(os.path.dirname(CACHE), exist_ok=True)
        json.dump(data, open(CACHE, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    sites = []
    for repo in data:
        name = repo["name"]
        ov = OVERRIDES.get(name, {})
        info = dict(name=name)
        auto = derive(dict(name=name, description=repo.get("desc") or repo.get("description") or ""))
        info.update(dict(
            title=ov.get("title") or auto["title"],
            desc=ov.get("desc") or auto["desc"],
            cat=ov.get("cat") or auto["cat"],
            tags=ov.get("tags") or auto["tags"],
            updated=(repo.get("updated") or "")[:10],
            url=ov.get("url") or (name + "/"),
            pages=extract_pages(name, repo.get("paths") or []),
            branch=repo.get("branch") or "main",
        ))
        info["dyn"] = any(p.get("d") for p in info["pages"])
        sites.append(info)

    # 虛擬站台（放在本 repo 內，不是獨立 repo）
    if not any(s["name"] == "hanzi" for s in sites):
        ov = OVERRIDES["hanzi"]
        sites.append(dict(
            name="hanzi", title=ov["title"], desc=ov["desc"], cat=ov["cat"],
            tags=ov["tags"], updated="", url="hanzi/", pages=[], virtual=True,
        ))

    cat_rank = {c: i for i, c in enumerate(
        ["math", "lang", "junior", "mind", "design", "daily", "media", "play", "tools"])}
    sites.sort(key=lambda s: (cat_rank.get(s["cat"], 99), s["title"]))

    now = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8)))
    seed = {
        "owner": OWNER,
        "generated": now.strftime("%Y-%m-%dT%H:%M:%S+08:00"),
        "generated_human": now.strftime("%Y年%-m月%-d日 %H:%M") if os.name != "nt" else now.strftime("%Y-%m-%d %H:%M"),
        "sites": sites,
    }

    tpl_path = os.path.join(HERE, "index.template.html")
    tpl = open(tpl_path, encoding="utf-8").read()
    app_js = open(os.path.join(HERE, "app.js"), encoding="utf-8").read()
    out = (tpl
           .replace("__SEED_JSON__", json.dumps(seed, ensure_ascii=False, separators=(",", ":")))
           .replace("__BUILT_HUMAN__", seed["generated_human"])
           .replace("__APP_JS__", app_js))
    with open(os.path.join(HERE, "index.html"), "w", encoding="utf-8") as f:
        f.write(out)

    # 獨立清單檔：網頁每次開啟先讀這份（不用等 GitHub API），
    # 之後再向 GitHub 核對有沒有新 repo，所以數字同畫面永遠一致。
    with open(os.path.join(HERE, "sites.json"), "w", encoding="utf-8") as f:
        json.dump(seed, f, ensure_ascii=False, separators=(",", ":"))

    pages = sum(len(s["pages"]) for s in sites)
    print("sites={} pages={} -> index.html, sites.json".format(len(sites), pages))


if __name__ == "__main__":
    build(offline="--offline" in sys.argv)
