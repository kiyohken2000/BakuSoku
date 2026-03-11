"""
「風景画像」ボード調査スクリプト

1. /areatop/ から雑談カテゴリの ctgid を特定
2. /bbstop/ で bid を特定
3. スレッド一覧 HTML 構造を解析
"""

import requests
import re
import sys

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


# ---------------------------------------------------------------------------
# Step 1: 全 acode の /areatop/ から「雑談」を含むカテゴリを探す
# ---------------------------------------------------------------------------
print("=" * 60)
print("Step 1: areatop から「風景」を含むカテゴリ・ボードを探す")
print("=" * 60)

found_entries = []

for acode in range(1, 19):
    url = f"{BASE}/areatop/acode={acode}/"
    try:
        html = fetch(url)
        if "風景" not in html:
            continue
        # /thr_tl/ リンクで風景を含むもの
        matches = re.findall(
            r'href="(/thr_tl/acode=(\d+)/ctgid=(\d+)/bid=(\d+)/?)"\s*[^>]*>(.*?)</a>',
            html,
            re.DOTALL,
        )
        for href, a, ctgid, bid, raw in matches:
            name = re.sub(r'<[^>]+>', '', raw).strip()
            if '風景' in name:
                entry = dict(acode=int(a), ctgid=int(ctgid), bid=int(bid), name=name)
                found_entries.append(entry)
                print(f"  発見 (areatop): acode={a} ctgid={ctgid} bid={bid}  name={name!r}")
    except Exception as e:
        print(f"  acode={acode}: {e}")

# areatop で見つからなければ bbstop を重点的に探す
if not found_entries:
    print("\nareatop では見つからず。雑談系の ctgid を areatop から列挙...")
    # まず雑談カテゴリの ctgid 候補を収集
    zatsutan_ctgids = {}  # (acode, ctgid) -> name
    for acode in range(1, 19):
        url = f"{BASE}/areatop/acode={acode}/"
        try:
            html = fetch(url)
            # カテゴリへのリンク /bbstop/acode=.../ctgid=...
            cats = re.findall(
                r'href="/bbstop/acode=(\d+)/ctgid=(\d+)/"[^>]*>(.*?)</a>',
                html, re.DOTALL,
            )
            for a, ctgid, raw in cats:
                name = re.sub(r'<[^>]+>', '', raw).strip()
                if '雑談' in name or '画像' in name or '写真' in name:
                    zatsutan_ctgids[(int(a), int(ctgid))] = name
                    print(f"  候補: acode={a} ctgid={ctgid} name={name!r}")
        except Exception as e:
            pass

    print(f"\n候補: {len(zatsutan_ctgids)} 件 → bbstop で風景ボードを探す")
    for (acode, ctgid), cat_name in list(zatsutan_ctgids.items())[:20]:
        url = f"{BASE}/bbstop/acode={acode}/ctgid={ctgid}/"
        try:
            html = fetch(url)
            if '風景' not in html:
                continue
            matches = re.findall(
                r'href="(/thr_tl/acode=(\d+)/ctgid=(\d+)/bid=(\d+)/?)"\s*[^>]*>(.*?)</a>',
                html, re.DOTALL,
            )
            for href, a, cid, bid, raw in matches:
                name = re.sub(r'<[^>]+>', '', raw).strip()
                if '風景' in name:
                    entry = dict(acode=int(a), ctgid=int(cid), bid=int(bid), name=name)
                    found_entries.append(entry)
                    print(f"  発見: acode={a} ctgid={cid} bid={bid}  name={name!r}")
        except Exception as e:
            pass

if not found_entries:
    print("[!] 見つかりませんでした。終了します。")
    sys.exit(1)

entry = found_entries[0]
tl_url = f"{BASE}/thr_tl/acode={entry['acode']}/ctgid={entry['ctgid']}/bid={entry['bid']}/"
print(f"\n→ 使用: {tl_url}")

# ---------------------------------------------------------------------------
# Step 2: スレッド一覧ページ HTML 構造解析
# ---------------------------------------------------------------------------
print()
print("=" * 60)
print("Step 2: スレッド一覧 HTML 構造解析")
print("=" * 60)

html = fetch(tl_url)
print(f"HTML 長さ: {len(html)} 文字")

# 現在のパーサー確認
parts = re.split(r'<li\s+data-tid=', html)
print(f"\n通常パーサー (<li\\s+data-tid=): {len(parts)-1} スレ")

w_count = html.count('weather_thr_list_box')
print(f"天気パーサー (weather_thr_list_box): {w_count} 件")

# data-tid の出現
dt = re.findall(r'(<[^>]{0,200}data-tid="(\d+)"[^>]*>)', html)
print(f"data-tid タグ: {len(dt)} 件")

# /thr_res/ tid 付きリンク
thr_links = re.findall(r'href="(/thr_res/[^"]*tid=(\d+)[^"]*)"', html)
print(f"/thr_res/ (tid付き): {len(thr_links)} 件")
for href, tid in thr_links[:5]:
    print(f"  tid={tid}  {href!r}")

# <li> タグのパターン
li_tags = re.findall(r'<li[^>]{0,200}>', html)
unique_li = {}
for tag in li_tags:
    key = re.sub(r'"[^"]*"', '"..."', tag)[:80]
    unique_li[key] = unique_li.get(key, 0) + 1
print(f"\n<li> タグ総数: {len(li_tags)}")
print("パターン:")
for k, v in sorted(unique_li.items(), key=lambda x: -x[1])[:10]:
    print(f"  [{v}回] {k!r}")

# ---------------------------------------------------------------------------
# Step 3: /thr_res/ 周辺の HTML（最初の 3 件）
# ---------------------------------------------------------------------------
if thr_links:
    print()
    print("=" * 60)
    print("Step 3: /thr_res/ 周辺の HTML（最初の 3 件）")
    print("=" * 60)
    count = 0
    for m in re.finditer(r'href="(/thr_res/[^"]*tid=(\d+)[^"]*)"', html):
        if count >= 3:
            break
        tid = m.group(2)
        pos = m.start()
        print(f"\n--- tid={tid} ---")
        print(html[max(0, pos-200):pos+500])
        count += 1

# ---------------------------------------------------------------------------
# Step 4: /thr_res/ を含む <ul> ブロック
# ---------------------------------------------------------------------------
print()
print("=" * 60)
print("Step 4: /thr_res/ を含む <ul> ブロック")
print("=" * 60)

for m in re.finditer(r'<ul([^>]*)>(.*?)</ul>', html, re.DOTALL):
    inner = m.group(2)
    if '/thr_res/' in inner and re.search(r'tid=\d+', inner):
        print(f"<ul{m.group(1)}>")
        print(inner[:2500])
        print("</ul>")
        break

# ---------------------------------------------------------------------------
# Step 5: キーワード確認
# ---------------------------------------------------------------------------
print()
print("=" * 60)
print("Step 5: キーワード確認")
print("=" * 60)

keywords = [
    "data-tid", "thr_status_icon", "weather_thr_list_box",
    "imgbbs_thr_list", "img_thr", "class=\"thr", "imgbbs",
    "スレッドがありません",
]
for kw in keywords:
    cnt = html.count(kw)
    if cnt > 0:
        idx = html.index(kw)
        ctx = html[max(0, idx-20):idx+80].replace('\n', ' ')
        print(f"  {kw!r}: {cnt}回  例: ...{ctx}...")
    else:
        print(f"  {kw!r}: 0回")

print("\n調査完了")
