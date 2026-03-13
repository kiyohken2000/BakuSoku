"""
res0_body の中身調査
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

# res0_body
print("=" * 70)
print("res0_body の内容（最大4000文字）")
print("=" * 70)

m = re.search(r'<div[^>]*id="res0_body"[^>]*>([\s\S]*?)(?=<li\s+id="res00_block")', html)
if m:
    body = m.group(1)
    print(f"長さ: {len(body)}")
    print(body[:4000])
else:
    idx = html.find('id="res0_body"')
    if idx != -1:
        print(html[idx:idx + 3000])
    else:
        print("見つからず")

# ---------------------------------------------------------------------------
# showmore_list / div_box の中の画像 & テキスト
# ---------------------------------------------------------------------------
print()
print("=" * 70)
print("showmore_list 内のコンテンツ")
print("=" * 70)

m2 = re.search(r'<div[^>]*id="div_box"[^>]*>([\s\S]*?)(?=</section>)', html)
if m2:
    content = m2.group(1)
    print(f"長さ: {len(content)}")
    print(content[:3000])

# ---------------------------------------------------------------------------
# 画像 URL
# ---------------------------------------------------------------------------
print()
print("=" * 70)
print("res0_body 内の画像 <img>")
print("=" * 70)

m3 = re.search(r'id="res0_body"([\s\S]*?)(?=<li\s+id="res00_block")', html)
if m3:
    res0_region = m3.group(1)
    imgs = re.findall(r'<img[^>]*src="([^"]+)"[^>]*>', res0_region)
    for img in imgs[:10]:
        print(f"  {img}")
    # テキスト抽出
    text = re.sub(r'<[^>]+>', ' ', res0_region)
    text = re.sub(r'\s+', ' ', text).strip()
    print(f"\nテキスト抽出 (500文字):\n{text[:500]}")
