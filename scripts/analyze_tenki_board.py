"""
「過去の天気予報一覧」ボード調査スクリプト

1. /bbstop/ から bid を特定
2. スレッド一覧ページの HTML 構造を解析して
   parseThreadList が何故スレを拾えないか調べる
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
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
}
BASE = "https://bakusai.com"


def fetch(url):
    r = requests.get(url, headers=HEADERS, timeout=15, allow_redirects=True)
    r.encoding = "utf-8"
    return r.text


# ---------------------------------------------------------------------------
# Step 1: /bbstop/ を巡回して「天気」ボードの bid を見つける
# ---------------------------------------------------------------------------
print("=" * 60)
print("Step 1: 「天気」ボードの bid を /bbstop/ から探す")
print("=" * 60)

found_entries = []

# 主要 acode + 代表的な ctgid を網羅的に検索
for acode in range(1, 19):
    url = f"{BASE}/bbstop/acode={acode}/"
    try:
        html = fetch(url)
        # /thr_tl/acode=.../ctgid=.../bid=... パターン
        matches = re.findall(
            r'href="(/thr_tl/acode=(\d+)/ctgid=(\d+)/bid=(\d+)/?)"\s*[^>]*>(.*?)</a>',
            html,
            re.DOTALL,
        )
        for href, a, ctgid, bid, raw_name in matches:
            name = re.sub(r'<[^>]+>', '', raw_name).strip()
            if '天気' in name:
                entry = dict(acode=int(a), ctgid=int(ctgid), bid=int(bid),
                             name=name, href=href)
                found_entries.append(entry)
                print(f"  発見: acode={a} ctgid={ctgid} bid={bid}  name={name!r}")
    except Exception as e:
        print(f"  acode={acode}: エラー {e}")

if not found_entries:
    print("bbstop/ では見つからず。ctgid 別に検索します...")
    # ctgid 指定で試す
    for acode in [3]:
        for ctgid in range(1, 200):
            url = f"{BASE}/bbstop/acode={acode}/ctgid={ctgid}/"
            try:
                html = fetch(url)
                if '天気' in html:
                    matches = re.findall(
                        r'href="(/thr_tl/[^"]+)"[^>]*>(.*?)</a>',
                        html,
                        re.DOTALL,
                    )
                    for href, raw_name in matches:
                        name = re.sub(r'<[^>]+>', '', raw_name).strip()
                        if '天気' in name:
                            bid_m = re.search(r'bid=(\d+)', href)
                            ctgid_m = re.search(r'ctgid=(\d+)', href)
                            bid = bid_m.group(1) if bid_m else '?'
                            cid = ctgid_m.group(1) if ctgid_m else '?'
                            print(f"  発見: acode={acode} ctgid={cid} bid={bid}  name={name!r}")
                            found_entries.append(dict(
                                acode=acode, ctgid=int(cid), bid=int(bid),
                                name=name, href=href
                            ))
            except Exception:
                pass

if not found_entries:
    print("[!] 見つかりませんでした。終了します。")
    sys.exit(1)

# 最初の一件を使用
entry = found_entries[0]
tl_url = f"{BASE}/thr_tl/acode={entry['acode']}/ctgid={entry['ctgid']}/bid={entry['bid']}/"
print(f"\n→ 使用: {tl_url}")

# ---------------------------------------------------------------------------
# Step 2: スレッド一覧ページを取得して構造を分析
# ---------------------------------------------------------------------------
print()
print("=" * 60)
print("Step 2: スレッド一覧 HTML の構造を解析")
print("=" * 60)

html = fetch(tl_url)

print(f"HTML 長さ: {len(html)} 文字")

# 現在の parseThreadList ロジック: <li\s+data-tid= で split
parts = re.split(r'<li\s+data-tid=', html)
print(f"\n現在のパーサー: <li\\s+data-tid= で split → {len(parts)} パーツ")
if len(parts) > 1:
    print(f"→ {len(parts)-1} スレ検出（正常）")
    chunk = parts[1]
    m = re.match(r'^"(\d+)"', chunk)
    print(f"  最初の tid={m.group(1) if m else 'なし'}")
else:
    print("→ スレが検出されない（parseThreadList が機能しない）")

# ---------------------------------------------------------------------------
# Step 3: 代替パターンの調査
# ---------------------------------------------------------------------------
print()
print("=" * 60)
print("Step 3: 代替 HTML 構造の調査")
print("=" * 60)

# data-tid の出現パターン
dt_tags = re.findall(r'<[^>]{0,200}data-tid="(\d+)"[^>]*>', html)
print(f"data-tid を持つタグ: {len(dt_tags)} 件")
if dt_tags:
    # 実際のタグを出力
    all_dt = re.findall(r'(<[^>]{0,200}data-tid="\d+"[^>]*>)', html)
    for tag in all_dt[:5]:
        print(f"  {tag!r}")

# /thr_res/ リンク
thr_links = re.findall(r'href="(/thr_res/[^"]+)"', html)
print(f"\n/thr_res/ リンク数: {len(thr_links)}")
for lnk in thr_links[:5]:
    print(f"  {lnk!r}")

# thr_status_icon
icon_count = html.count('thr_status_icon')
print(f"\nthr_status_icon の出現数: {icon_count}")

# <li> タグの種類
li_open_tags = re.findall(r'<li[^>]{0,200}>', html)
print(f"\n<li> タグ総数: {len(li_open_tags)}")
unique_starts = {}
for tag in li_open_tags:
    key = re.sub(r'"[^"]*"', '"..."', tag)[:80]
    unique_starts[key] = unique_starts.get(key, 0) + 1
print("  ユニークパターン:")
for k, v in sorted(unique_starts.items(), key=lambda x: -x[1])[:10]:
    print(f"    [{v}回] {k!r}")

# ---------------------------------------------------------------------------
# Step 4: HTML 全文を詳しく確認（スレ候補が含まれる箇所）
# ---------------------------------------------------------------------------
print()
print("=" * 60)
print("Step 4: HTML 主要セクションの確認")
print("=" * 60)

# <main> や <div id="contents"> などのメインコンテンツ部分を探す
main_match = re.search(r'<main[^>]*>(.*?)</main>', html, re.DOTALL)
if main_match:
    main_html = main_match.group(1)
    print(f"<main> タグ: {len(main_html)} 文字")
    print("--- <main> 先頭 2000 字 ---")
    print(main_html[:2000])
else:
    contents_match = re.search(r'<div[^>]+id="contents"[^>]*>(.*?)</div>', html, re.DOTALL)
    if contents_match:
        print(f"<div id=contents>: {len(contents_match.group(1))} 文字")
        print(contents_match.group(1)[:2000])
    else:
        print("メインコンテンツタグ未発見。HTML 先頭 3000 字:")
        print(html[:3000])

# ---------------------------------------------------------------------------
# Step 5: 「過去の天気」固有の構造確認
# ---------------------------------------------------------------------------
print()
print("=" * 60)
print("Step 5: キーワード出現確認")
print("=" * 60)

for kw in ["data-tid", "thr_status_icon", "thr_tl_item", "thread", "過去",
           "href=\"/thr_res", "class=\"thr", "tid="]:
    cnt = html.count(kw)
    if cnt > 0:
        idx = html.index(kw)
        ctx = html[max(0, idx-20):idx+80].replace('\n', ' ')
        print(f"  {kw!r}: {cnt}回  例: ...{ctx}...")
    else:
        print(f"  {kw!r}: 0回")

print("\n調査完了")
