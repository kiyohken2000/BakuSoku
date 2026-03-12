# -*- coding: utf-8 -*-
"""
>>0 の構造調査 - 最終版
・通常スレ / 画像ボードスレで res0_block の実態を確認
・スレタイ格納場所を特定
・res1_block の前後関係を詳細確認
"""

import requests
import re
import sys

UA = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) "
    "Version/17.0 Mobile/15E148 Safari/604.1"
)
HEADERS = {"User-Agent": UA, "Accept-Language": "ja,en-US;q=0.9,en;q=0.8"}
BASE = "https://bakusai.com"


def fetch(url):
    r = requests.get(url, headers=HEADERS, timeout=15)
    r.encoding = "utf-8"
    return r.text


def strip_tags(s):
    s = re.sub(r"<br\s*/?>", "\\n", s, flags=re.IGNORECASE)
    s = re.sub(r"<[^>]+>", "", s)
    s = s.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
    s = s.replace("&nbsp;", " ").replace("&ensp;", " ").replace("\u00a0", " ")
    return re.sub(r"[ \t]+", " ", s).strip()


def safe_print(s):
    try:
        print(s)
    except UnicodeEncodeError:
        print(s.encode("ascii", "replace").decode("ascii"))


# 既知のスレ URL
THREAD_URLS = [
    # 通常スレ (芸能)
    ("normal", "https://bakusai.com/thr_res/acode=3/ctgid=137/bid=1177/tid=13176341/tp=1/"),
    # 通常スレ rw=1
    ("normal_rw1", "https://bakusai.com/thr_res/acode=3/ctgid=137/bid=1177/tid=13176341/tp=1/rw=1/"),
    # 画像ボードスレ (風景画像)
    ("photo", "https://bakusai.com/thr_res/acode=1/ctgid=104/bid=5830/tid=12975517/tp=1/"),
    # 天気スレ
    ("weather", "https://bakusai.com/thr_res/acode=3/ctgid=148/bid=5877/tid=13175695/tp=1/rw=1/"),
]

# ---------------------------------------------------------------------------
# Step 1: 各スレの res0 関連要素を比較
# ---------------------------------------------------------------------------
safe_print("=" * 60)
safe_print("Step 1: 各スレタイプで res0 関連要素を比較")
safe_print("=" * 60)

for label, url in THREAD_URLS:
    html = fetch(url)
    li_ids = re.findall(r'<li\s+id="(res[^"]+)"', html)
    safe_print(f"\n[{label}] {url}")
    safe_print(f"  li_ids: {li_ids[:8]}")

    for block_id in ["res0_block", "res00_block", "res0_whole"]:
        idx = html.find(f'id="{block_id}"')
        if idx < 0:
            continue
        chunk_start = max(0, html.rfind("<li", 0, idx))
        chunk = html[chunk_start: chunk_start + 1500]

        hidden = "display:none" in chunk[:200]
        date_m = re.search(r'itemprop="commentTime"[^>]*>([\s\S]{0,50})</span>', chunk)
        date = date_m.group(1).strip() if date_m else None

        # res_body の内容（深いネストも対応）
        body_start = chunk.find('class="res_body"')
        body_text = ""
        if body_start >= 0:
            after = chunk.find(">", body_start) + 1
            inner = chunk[after: after + 800]
            # <br> を改行に変換し、タグを除去
            body_text = strip_tags(inner.split("</div>")[0])

        name_m = re.search(r'class="name"[^>]*>([\s\S]{0,200})</div>', chunk)
        name_text = strip_tags(name_m.group(1)) if name_m else None

        safe_print(f"  [{block_id}] hidden={hidden} date={date!r}")
        safe_print(f"    body={body_text[:60]!r}")
        name_short = name_text[:40] if name_text else None
        safe_print(f"    name={name_short!r}")

# ---------------------------------------------------------------------------
# Step 2: 通常スレの res0_block HTML を完全出力（ASCII safe）
# ---------------------------------------------------------------------------
safe_print("")
safe_print("=" * 60)
safe_print("Step 2: 通常スレの res0_block 完全 HTML")
safe_print("=" * 60)

html = fetch("https://bakusai.com/thr_res/acode=3/ctgid=137/bid=1177/tid=13176341/tp=1/")
idx = html.find('id="res0_block"')
if idx >= 0:
    chunk_start = max(0, html.rfind("<li", 0, idx))
    chunk = html[chunk_start: chunk_start + 2000]
    safe_print(chunk[:2000])

# ---------------------------------------------------------------------------
# Step 3: スレタイトルの格納場所
# ---------------------------------------------------------------------------
safe_print("")
safe_print("=" * 60)
safe_print("Step 3: スレタイトルの格納場所")
safe_print("=" * 60)

html = fetch("https://bakusai.com/thr_res/acode=3/ctgid=137/bid=1177/tid=13176341/tp=1/")

# og:title
og_m = re.search(r'property="og:title"\s+content="([^"]+)"', html)
safe_print(f"og:title: {og_m.group(1)!r}" if og_m else "og:title: なし")

# itemprop="name"
name_m = re.search(r'itemprop="name"\s+content="([^"]+)"', html)
safe_print(f'itemprop="name": {name_m.group(1)!r}' if name_m else 'itemprop="name": なし')

# h1
for m in re.finditer(r'<h1([^>]*)>([\s\S]*?)</h1>', html):
    text = strip_tags(m.group(2))
    if text:
        safe_print(f"<h1>: {text[:80]!r}")

# <title>
title_m = re.search(r'<title>(.*?)</title>', html)
safe_print(f"<title>: {title_m.group(1)!r}" if title_m else "<title>: なし")

# threadName 系のクラス
for cls in ["thread_title", "thr_title", "board_title", "thread-title",
            "res_thread_name", "thr_name", "subject", "threadName"]:
    idx2 = html.find(f'class="{cls}"')
    if idx2 >= 0:
        safe_print(f'class="{cls}": {strip_tags(html[idx2:idx2+200])[:80]!r}')

# ---------------------------------------------------------------------------
# Step 4: parseThread split パターン確認 - res0_block の位置と内容
# ---------------------------------------------------------------------------
safe_print("")
safe_print("=" * 60)
safe_print("Step 4: parseThread の split で res0_block をどう認識するか")
safe_print("=" * 60)

html = fetch("https://bakusai.com/thr_res/acode=3/ctgid=137/bid=1177/tid=13176341/tp=1/")

parts = re.split(r'<li\s+id="res', html)
safe_print(f"split 結果: {len(parts)} パーツ")

for i, p in enumerate(parts[1:], 1):
    snippet = p[:80].replace('\n', ' ').replace('\r', '')
    rrid_m = re.match(r'^(\d+)_block', p)
    rrid = rrid_m.group(1) if rrid_m else "(no _block match)"
    has_ct = 'itemprop="commentTime"' in p[:1200]
    body_start = p.find('class="res_body"')
    body_text = ""
    if body_start >= 0:
        after = p.find(">", body_start) + 1
        inner = p[after: after + 400]
        body_text = strip_tags(inner.split("</div>")[0])
    has_display_none = "display:none" in p[:200]
    safe_print(f"  [{i}] rrid={rrid!r} commentTime={has_ct} displayNone={has_display_none}")
    safe_print(f"       body={body_text[:50]!r}")
    safe_print(f"       → {snippet!r}")

safe_print("")
safe_print("=== 結論 ===")
safe_print("res0_block の実態:")
safe_print("  - date: 0000/00/00 00:00 (ダミー)")
safe_print("  - body: 空 (実コンテンツなし)")
safe_print("  - display: none (非表示)")
safe_print("  - 位置: HTML の末尾近く (res1_block より後ろ)")
safe_print("")
safe_print("bakusai における >>0 の意味:")
safe_print("  - スレタイトル自体が >>0 に相当する")
safe_print("  - 実際の投稿コンテンツとしては存在しない")
safe_print("  - og:title や <title> タグにスレタイが格納されている")
safe_print("")
safe_print("対応案: スレタイを pseudo >>0 として先頭に表示する")
