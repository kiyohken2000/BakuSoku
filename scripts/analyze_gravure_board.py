"""
グラビアニュースボード HTML 構造調査スクリプト

比較:
  正常: スポーツ実況中継 https://bakusai.com/thr_tl/acode=4/ctgid=104/bid=5906/
  問題: グラビアニュース   https://bakusai.com/thr_tl/acode=4/ctgid=137/bid=5868/
"""

import io
import re
import sys
import requests

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

UA = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) "
    "Version/17.0 Mobile/15E148 Safari/604.1"
)
HEADERS = {
    "User-Agent": UA,
    "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
}

URLS = {
    "sports (OK)": "https://bakusai.com/thr_tl/acode=4/ctgid=104/bid=5906/",
    "gravure (NG)": "https://bakusai.com/thr_tl/acode=4/ctgid=137/bid=5868/",
}


def fetch(url):
    r = requests.get(url, headers=HEADERS, timeout=15)
    r.encoding = "utf-8"
    return r.text


def analyze(label, html):
    print()
    print("=" * 70)
    print(f"[{label}]")
    print("=" * 70)
    print(f"HTML 長さ: {len(html)} 文字")

    # 現在アプリで使っているパーサー
    parts_li = re.split(r'<li\s+data-tid=', html)
    print(f"\n[通常パーサー] <li data-tid=: {len(parts_li)-1} 件")

    # data-tid の全タグ
    dt_tags = re.findall(r'(<[^>]{0,300}data-tid="(\d+)"[^>]*>)', html)
    print(f"[data-tid タグ全体]: {len(dt_tags)} 件")
    for tag, tid in dt_tags[:3]:
        print(f"  tid={tid}  tag={tag[:120]!r}")

    # /thr_res/ リンク
    thr_links = re.findall(r'href="(/thr_res/[^"]*tid=(\d+)[^"]*)"', html)
    print(f"\n[/thr_res/ リンク]: {len(thr_links)} 件")
    for href, tid in thr_links[:3]:
        print(f"  tid={tid}  {href!r}")

    # <ul> <ol> タグのクラス一覧
    ul_tags = re.findall(r'<(?:ul|ol)([^>]{0,200})>', html)
    print(f"\n[<ul>/<ol> タグ]: {len(ul_tags)} 件")
    for t in ul_tags[:10]:
        print(f"  <ul{t[:100]}>")

    # <li> タグパターン集計
    li_tags = re.findall(r'<li([^>]{0,200})>', html)
    print(f"\n[<li> タグ]: {len(li_tags)} 件")
    patterns = {}
    for t in li_tags:
        key = re.sub(r'"[^"]{0,50}"', '"..."', t)[:80]
        patterns[key] = patterns.get(key, 0) + 1
    for k, v in sorted(patterns.items(), key=lambda x: -x[1])[:10]:
        print(f"  [{v}回] <li{k!r}>")

    # キーワード存在確認
    keywords = [
        "data-tid", "imgbbs_thr_list", "imgbbs", "img_thr",
        "thr_status_icon", "weather_thr_list_box",
        "class=\"thr", "thr_list", "gravure", "news_thr",
        "スレッドがありません",
    ]
    print("\n[キーワード確認]")
    for kw in keywords:
        cnt = html.count(kw)
        if cnt > 0:
            idx = html.index(kw)
            ctx = html[max(0, idx - 30):idx + 100].replace('\n', ' ')
            print(f"  {kw!r}: {cnt}回  ...{ctx}...")
        else:
            print(f"  {kw!r}: 0回")


def show_thread_block(label, html):
    """スレアイテムを含む最初のブロックを表示"""
    print()
    print("=" * 70)
    print(f"[{label}] スレアイテム周辺 HTML")
    print("=" * 70)

    # /thr_res/ を含む最初の <li> を探す
    m = re.search(r'(<li[^>]*>(?:(?!</li>).){0,2000}?/thr_res/(?:(?!</li>).){0,2000}?</li>)',
                  html, re.DOTALL)
    if m:
        print("[最初の <li>...</li> ブロック (最大1500文字)]")
        print(m.group(1)[:1500])
    else:
        print("[<li>...</li> で /thr_res/ 含むブロックが見つからない]")

    # data-tid を含む最初の親ブロック
    m2 = re.search(r'data-tid="(\d+)"', html)
    if m2:
        pos = m2.start()
        print(f"\n[data-tid 出現周辺 (前後400文字)] tid={m2.group(1)}")
        print(html[max(0, pos - 200):pos + 600])
    else:
        print("\n[data-tid なし]")

    # imgbbs 系ブロック
    m3 = re.search(r'(imgbbs[A-Za-z_]*)', html)
    if m3:
        pos = m3.start()
        print(f"\n[imgbbs 周辺 (前後600文字)]")
        print(html[max(0, pos - 100):pos + 600])


# ---------------------------------------------------------------------------
# メイン
# ---------------------------------------------------------------------------
htmls = {}
for label, url in URLS.items():
    print(f"\nFetching {url} ...")
    htmls[label] = fetch(url)

for label, html in htmls.items():
    analyze(label, html)

for label, html in htmls.items():
    show_thread_block(label, html)

# ---------------------------------------------------------------------------
# 差分比較: gravure にしか存在しないパターンを探す
# ---------------------------------------------------------------------------
print()
print("=" * 70)
print("[差分] gravure にのみ存在する <li> パターン")
print("=" * 70)

sports_html = htmls["sports (OK)"]
gravure_html = htmls["gravure (NG)"]

# gravure の最初の実スレ周辺 500 文字
# ul > li の構造を探す
for m in re.finditer(r'<ul([^>]*)>(.*?)</ul>', gravure_html, re.DOTALL):
    inner = m.group(2)
    if '/thr_res/' in inner or 'tid=' in inner:
        print(f"\n[gravure] /thr_res/ または tid= を含む <ul> ブロック (最大3000文字)")
        print(f"<ul{m.group(1)}>")
        print(inner[:3000])
        print("</ul>")
        break

print("\n調査完了")
