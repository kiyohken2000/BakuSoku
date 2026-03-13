"""
画像・ニュース系スレッドの >>0 HTML 構造調査

対象: https://bakusai.com/thr_res/acode=4/ctgid=137/bid=5868/tid=13178575/tp=1/
"""

import io, re, sys
import requests

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

UA = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) "
    "Version/17.0 Mobile/15E148 Safari/604.1"
)
HEADERS = {"User-Agent": UA, "Accept-Language": "ja,en-US;q=0.9,en;q=0.8"}
URL = "https://bakusai.com/thr_res/acode=4/ctgid=137/bid=5868/tid=13178575/tp=1/"


def fetch(url):
    r = requests.get(url, headers=HEADERS, timeout=15)
    r.encoding = "utf-8"
    return r.text


html = fetch(URL)
print(f"HTML 長さ: {len(html)}")

# ---------------------------------------------------------------------------
# Step 1: res0_block 周辺
# ---------------------------------------------------------------------------
print()
print("=" * 70)
print("Step 1: res0_block / res_0 周辺")
print("=" * 70)

for kw in ["res0_block", 'id="res0"', 'id="res_0"', "res0", "imgbbs_detail", "bbs_detail_top"]:
    cnt = html.count(kw)
    if cnt:
        idx = html.index(kw)
        ctx = html[max(0, idx - 50):idx + 300].replace('\n', ' ')
        print(f"\n  {kw!r}: {cnt}回")
        print(f"  ...{ctx}...")
    else:
        print(f"  {kw!r}: 0回")

# ---------------------------------------------------------------------------
# Step 2: <li id="res ..."> の先頭 5 件を表示
# ---------------------------------------------------------------------------
print()
print("=" * 70)
print("Step 2: <li id=\"res...\"> 最初の 5 件")
print("=" * 70)

matches = list(re.finditer(r'<li\s+id="res(\d+)_block"', html))
print(f"  res_block 件数: {len(matches)}")
for m in matches[:5]:
    rrid = m.group(1)
    start = m.start()
    end = html.find('</li>', start + 1)
    block = html[start: end + 5] if end != -1 else html[start: start + 1500]
    print(f"\n--- rrid={rrid} ---")
    print(block[:1200])

# ---------------------------------------------------------------------------
# Step 3: スレの一番最初の <li> (rrid が 0 や 1 より前にある特殊ブロック)
# ---------------------------------------------------------------------------
print()
print("=" * 70)
print("Step 3: 最初の <li> ブロック（res_block より前）")
print("=" * 70)

first_res_pos = html.find('<li id="res')
if first_res_pos > 0:
    before = html[max(0, first_res_pos - 3000):first_res_pos]
    # <li> で始まるブロックを探す
    li_positions = [m.start() for m in re.finditer(r'<li[^>]*>', before)]
    print(f"  res_block の前にある <li> 数: {len(li_positions)}")
    for pos in li_positions[-3:]:
        snippet = before[pos:pos + 600]
        print(f"\n  --- <li> at -{first_res_pos - pos} ---")
        print(snippet)

# ---------------------------------------------------------------------------
# Step 4: 画像・本文を含む特殊ブロック検索
# ---------------------------------------------------------------------------
print()
print("=" * 70)
print("Step 4: 画像・本文ブロックのキーワード検索")
print("=" * 70)

img_keywords = [
    "imgbbs", "img_detail", "news_detail", "article_body",
    "thr_detail_img", "detail_img", "main_image",
    "class=\"image\"", "class=\"article\"", "class=\"news\"",
    "bbs_res0", "res_top",
]
for kw in img_keywords:
    cnt = html.count(kw)
    if cnt:
        idx = html.index(kw)
        ctx = html[max(0, idx - 30):idx + 200].replace('\n', ' ')
        print(f"\n  {kw!r}: {cnt}回")
        print(f"  ...{ctx}...")
    else:
        print(f"  {kw!r}: 0回")

# ---------------------------------------------------------------------------
# Step 5: <ul> で res ブロックを囲んでいる親を確認
# ---------------------------------------------------------------------------
print()
print("=" * 70)
print("Step 5: res_block を囲む <ul> の手前 500 文字")
print("=" * 70)

first_res = html.find('<li id="res')
if first_res != -1:
    # <ul> を後ろから探す
    before_ul = html[:first_res]
    ul_m = list(re.finditer(r'<ul[^>]*>', before_ul))
    if ul_m:
        last_ul = ul_m[-1]
        print(f"  直前 <ul>: {html[last_ul.start():last_ul.end()]!r}")
        print(f"  その前後 (ul の前 200 〜 ul の後 400):")
        print(html[max(0, last_ul.start() - 200):last_ul.end() + 400])

print()
print("調査完了")
