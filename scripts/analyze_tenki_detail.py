"""
「過去の天気予報一覧」(bid=5877) の詳細構造調査
/thr_res/ リンク周辺の HTML を詳しく見る
"""

import requests
import re

UA = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) "
    "Version/17.0 Mobile/15E148 Safari/604.1"
)
HEADERS = {
    "User-Agent": UA,
    "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
}
BASE = "https://bakusai.com"

def fetch(url):
    r = requests.get(url, headers=HEADERS, timeout=15)
    r.encoding = "utf-8"
    return r.text

url = f"{BASE}/thr_tl/acode=3/ctgid=148/bid=5877/"
html = fetch(url)

# ---------------------------------------------------------------------------
# /thr_res/ 各リンクの前後 300 字を表示
# ---------------------------------------------------------------------------
print("=" * 60)
print("/thr_res/ リンク周辺の HTML")
print("=" * 60)

for m in re.finditer(r'href="(/thr_res/[^"]+)"', html):
    pos = m.start()
    ctx_start = max(0, pos - 200)
    ctx_end = min(len(html), pos + 400)
    ctx = html[ctx_start:ctx_end]
    tid_m = re.search(r'tid=(\d+)', m.group(1))
    if not tid_m:
        continue  # TID_LATEST など数字でないもの
    print(f"\n--- tid={tid_m.group(1)} ---")
    print(ctx)
    print()

# ---------------------------------------------------------------------------
# <ul> / <ol> の内側を全部出力
# ---------------------------------------------------------------------------
print("=" * 60)
print("<ul> の内側を列挙")
print("=" * 60)
for m in re.finditer(r'<ul([^>]*)>(.*?)</ul>', html, re.DOTALL):
    inner = m.group(2)
    if '/thr_res/' in inner:
        print(f"\n<ul{m.group(1)}>")
        print(inner[:3000])
        print("</ul>")

# ---------------------------------------------------------------------------
# 全 /thr_res/ のスレ候補を tid 付きで抽出
# ---------------------------------------------------------------------------
print("=" * 60)
print("tid 付き /thr_res/ リンク一覧")
print("=" * 60)

entries = re.finditer(
    r'href="(/thr_res/acode=\d+/ctgid=\d+/bid=\d+/tid=(\d+)[^"]*)"',
    html
)
for e in entries:
    href = e.group(1)
    tid = e.group(2)
    pos = e.start()
    # リンクテキスト（直後の >...< を取得）
    snippet = html[pos:pos+300]
    text_m = re.search(r'>([^<]{3,80})<', snippet)
    text = text_m.group(1).strip() if text_m else ''
    print(f"tid={tid}  href={href!r}  text={text!r}")
