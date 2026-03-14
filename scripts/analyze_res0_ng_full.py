"""
NG スレ (bid=1177) の res0_body 全体調査
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
URL = "https://bakusai.com/thr_res/acode=4/ctgid=137/bid=1177/tid=13179663/tp=1/"

html = requests.get(URL, headers=HEADERS, timeout=15)
html.encoding = "utf-8"
html = html.text

# res0_whole ブロック抽出
block_m = re.search(r'<li[^>]*id="res0_whole"[^>]*>([\s\S]*?)(?=<li\s|<\/ul>)', html)
block = block_m.group(1) if block_m else ""

print("=" * 70)
print("res0_body 全体")
print("=" * 70)
body_m = re.search(r'id="res0_body"[^>]*>([\s\S]*?)(?=<div class="name"|<\/article>)', block)
if body_m:
    body = body_m.group(1)
    print(f"長さ: {len(body)}")
    print(body[:5000])
else:
    print("res0_body なし — res0_whole 全体を表示:")
    print(block[:5000])

print()
print("=" * 70)
print("res0_whole 内の全外部リンク")
print("=" * 70)
links = re.findall(r'href="(https?://[^"]+)"', block)
for l in links:
    print(f"  {l}")

print()
print("=" * 70)
print("thr_img ブロック")
print("=" * 70)
thr_img_m = re.search(r'<div[^>]*class="thr_img[^"]*"[^>]*>([\s\S]*?)</div>', block)
if thr_img_m:
    print(thr_img_m.group(0)[:800])

print()
print("=" * 70)
print("suretai_sticky ブロック（スレタイ・日時を含む）")
print("=" * 70)
sticky_m = re.search(r'<div[^>]*class="suretai_sticky"[^>]*>([\s\S]*?)</div>\s*<div[^>]*id="res0_body"', block)
if sticky_m:
    print(sticky_m.group(1)[:1000])

print()
print("調査完了")
