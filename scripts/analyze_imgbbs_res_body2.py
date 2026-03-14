"""
imagebbs 系スレの画像付きレス HTML 構造調査 (rw=1 mode)
"""
import io, re, sys, requests
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
HEADERS = {"User-Agent": UA, "Accept-Language": "ja,en-US;q=0.9,en;q=0.8"}

# rw=1 page=1 (最初から読む、1ページ目)
url = "https://bakusai.com/thr_res/acode=4/ctgid=137/bid=1177/tid=13179663/tp=1/rw=1/"
r = requests.get(url, headers=HEADERS, timeout=15)
r.encoding = "utf-8"
html = r.text

# 全 res_block の rrid を確認
rrids = re.findall(r'<li[^>]*id="res(\d+)_block"', html)
print(f"このページの rrid: {rrids}")

# res_body に画像を含むものを探す
print()
print("=" * 60)
print("画像含む res_body の構造")
print("=" * 60)

# <li id="resN_block"> から次の <li> まで取得
parts = re.split(r'(?=<li[^>]*id="res\d+_block")', html)
for part in parts:
    rrid_m = re.match(r'<li[^>]*id="res(\d+)_block"', part)
    if not rrid_m:
        continue
    rrid = rrid_m.group(1)
    if 'res_img' in part or ('img' in part.lower() and 'imagebbs' in part):
        print(f"\n--- rrid={rrid} (画像あり) ---")
        print(part[:2000])

print()
print("=" * 60)
print("res_body の bodyEnd (</div>) 検出パターン確認")
print("=" * 60)

# 現行パーサーが body をどこで切るか確認
for part in parts:
    rrid_m = re.match(r'<li[^>]*id="res(\d+)_block"', part)
    if not rrid_m:
        continue
    rrid = rrid_m.group(1)
    body_marker = 'class="res_body"'
    body_start = part.find(body_marker)
    if body_start == -1:
        continue
    after_marker = part.find('>', body_start) + 1
    body_content = part[after_marker:]
    body_end = body_content.find('</div>')
    if body_end != -1:
        extracted = body_content[:body_end]
        if 'img' in extracted.lower() or '画像' in extracted:
            print(f"\nrrid={rrid}: bodyEnd={body_end}")
            print(f"抽出body (raw):\n{extracted[:500]}")
            print(f"\n(</div>以降 200文字):\n{body_content[body_end:body_end+200]}")
