"""
画像スレ res0_whole / res_whole ブロックの詳細調査
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

# ---------------------------------------------------------------------------
# res_whole ul の全体を取得
# ---------------------------------------------------------------------------
print("=" * 70)
print("res_whole <ul> の全内容")
print("=" * 70)

m = re.search(r'<ul[^>]*id="res_whole"[^>]*>([\s\S]*?)</ul>', html)
if m:
    inner = m.group(1)
    print(f"ul 内側の長さ: {len(inner)}")
    print(inner[:5000])
else:
    print("res_whole ul が見つかりません")

# ---------------------------------------------------------------------------
# res0_whole の中身
# ---------------------------------------------------------------------------
print()
print("=" * 70)
print("res0_whole <li> の全内容")
print("=" * 70)

m0 = re.search(r'<li[^>]*id="res0_whole"[^>]*>([\s\S]*?)</li>', html)
if m0:
    block = m0.group(1)
    print(f"長さ: {len(block)}")
    print(block[:4000])
else:
    # </li> で終わらない可能性 → 次の <li> まで
    idx = html.find('id="res0_whole"')
    if idx != -1:
        end = html.find('<li ', idx + 1)
        block = html[idx: end if end != -1 else idx + 4000]
        print("(</li>で閉じず, 次の<li>まで)")
        print(f"長さ: {len(block)}")
        print(block[:4000])
    else:
        print("res0_whole が見つかりません")

# ---------------------------------------------------------------------------
# rrid=1〜4 はどこにあるか
# ---------------------------------------------------------------------------
print()
print("=" * 70)
print("rrid=1〜4 の所在確認")
print("=" * 70)

for rrid in range(0, 6):
    patterns = [
        f'id="res{rrid}_block"',
        f'id="res{rrid:02d}_block"',
        f'id="res{rrid}_whole"',
        f'#res_pos.*>>0{rrid}',
        f'rrid={rrid}[^0-9]',
    ]
    found = []
    for p in patterns:
        cnt = len(re.findall(p, html))
        if cnt:
            found.append(f"{p!r}:{cnt}")
    print(f"  rrid={rrid}: {found if found else 'なし'}")

# ---------------------------------------------------------------------------
# res_whole 内の全 <li> を一覧
# ---------------------------------------------------------------------------
print()
print("=" * 70)
print("res_whole 内の全 <li> id 一覧")
print("=" * 70)

if m:
    inner = m.group(1)
    li_ids = re.findall(r'<li[^>]*id="([^"]*)"', inner)
    print(f"  li id 一覧 ({len(li_ids)} 件): {li_ids}")
    # 各 li の先頭 200 文字
    for li_m in re.finditer(r'<li([^>]*)>', inner):
        tag_attr = li_m.group(1)
        start = li_m.start()
        snippet = inner[start:start + 300].replace('\n', ' ')
        print(f"\n  <li{tag_attr[:80]}>")
        print(f"  {snippet[:250]}")

print()
print("調査完了")
