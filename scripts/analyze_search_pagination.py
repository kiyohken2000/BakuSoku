"""
bakusai.com の検索結果ページのHTML構造を調査するスクリプト。
- 1ページ目の構造
- 「もっと見る」ボタンの有無・URL
- 2ページ目以降のURL形式
- 各スレッドエントリのHTML構造
"""
import requests
import re
import sys

HEADERS = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    "Accept-Language": "ja,en;q=0.9",
}

import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

def safe_print(s):
    print(s)

def fetch(url):
    r = requests.get(url, headers=HEADERS, timeout=15)
    r.encoding = "utf-8"
    return r.text

def analyze_page(html, label):
    safe_print(f"\n{'='*60}")
    safe_print(f"=== {label} ===")
    safe_print(f"{'='*60}")
    safe_print(f"HTML length: {len(html)}")

    # もっと見る / ページネーション系リンクを探す
    safe_print("\n--- pagination / more links ---")
    patterns = [
        r'<a[^>]+href="([^"]*)"[^>]*>[^<]*もっと見る[^<]*</a>',
        r'<a[^>]+href="([^"]*)"[^>]*>[^<]*次[^<]*</a>',
        r'<a[^>]+href="([^"]*search[^"]*)"',
        r'href="(/search[^"]*)"',
        r'href="(/srch[^"]*)"',
        r'data-page="(\d+)"',
        r'page=(\d+)',
        r'p=(\d+)',
    ]
    for pat in patterns:
        matches = re.findall(pat, html, re.IGNORECASE)
        if matches:
            safe_print(f"  pattern={pat!r}")
            for m in matches[:5]:
                safe_print(f"    -> {m}")

    # スレッドエントリの構造を調べる
    safe_print("\n--- thread entry patterns ---")
    # data-tid 属性
    tids = re.findall(r'data-tid="?(\d+)"?', html)
    safe_print(f"  data-tid count: {len(tids)}, values: {tids[:10]}")

    # href に /thr_res/ が含まれるリンク
    thr_links = re.findall(r'href="(/thr_res/[^"]{10,80})"', html)
    safe_print(f"  /thr_res/ links count: {len(thr_links)}")
    for l in thr_links[:5]:
        safe_print(f"    {l}")

    # スレタイっぽい要素
    safe_print("\n--- potential title elements ---")
    title_pats = [
        r'<div[^>]+class="[^"]*title[^"]*"[^>]*>(.*?)</div>',
        r'<p[^>]+class="[^"]*title[^"]*"[^>]*>(.*?)</p>',
        r'<h\d[^>]*>(.*?)</h\d>',
        r'<a[^>]+class="[^"]*thr[^"]*"[^>]*>(.*?)</a>',
    ]
    for pat in title_pats:
        matches = re.findall(pat, html, re.IGNORECASE | re.DOTALL)
        if matches:
            safe_print(f"  pattern={pat!r}")
            for m in matches[:3]:
                text = re.sub(r'<[^>]+>', '', m).strip()[:80]
                if text:
                    safe_print(f"    -> {text!r}")

    # 検索結果コンテナの前後を切り出す
    safe_print("\n--- search result container snippet ---")
    for keyword in ["search_result", "srch_result", "result_list", "thr_list", "search-result"]:
        idx = html.find(keyword)
        if idx >= 0:
            safe_print(f"  found keyword={keyword!r} at pos={idx}")
            safe_print(f"  snippet: {html[max(0,idx-50):idx+200]!r}")
            break

    # ページ全体から <li> タグの数
    li_count = len(re.findall(r'<li[\s>]', html))
    safe_print(f"\n--- <li> count: {li_count} ---")

    # もっと見るボタン周辺のHTML
    safe_print("\n--- 'more' button area ---")
    for keyword in ["もっと見る", "more", "next_page", "load_more", "pager"]:
        idx = html.find(keyword)
        if idx >= 0:
            safe_print(f"  found {keyword!r} at pos={idx}")
            safe_print(f"  context: {html[max(0,idx-100):idx+200]!r}")

def main():
    query = "天気"
    acode = 4  # 関東
    encoded = requests.utils.quote(query, safe='')

    # sch_all は概要ページ。もっと見るリンクで飛ぶ先を調査
    base_all = f"https://bakusai.com/sch_all/acode={acode}/word={encoded}/"
    safe_print(f"Fetching sch_all: {base_all}")
    html_all = fetch(base_all)

    # もっと見るリンクを抽出
    more_links = re.findall(r'<a[^>]+href="(/sch[^"]+)"[^>]*>[^<]*もっと見る[^<]*</a>', html_all)
    safe_print(f"'もっと見る' links: {more_links}")

    # /sch_thr_thread/ (スレタイ検索) を詳細調査
    safe_print("\n" + "="*60)
    safe_print("=== /sch_thr_thread/ 詳細調査 ===")
    url_thr = f"https://bakusai.com/sch_thr_thread/acode={acode}/word={encoded}/"
    safe_print(f"Fetching: {url_thr}")
    html_thr = fetch(url_thr)

    with open("search_thr_thread_p1.html", "w", encoding="utf-8") as f:
        f.write(html_thr)

    safe_print(f"HTML length: {len(html_thr)}")

    # スレッドタイトル件数
    tids = re.findall(r'id="tid-(\d+)"', html_thr)
    safe_print(f"tid count on page1: {len(tids)}")
    titles = re.findall(r'id="tid-\d+"[^>]*>(.*?)</h2>', html_thr, re.DOTALL)
    for i, (tid, title) in enumerate(zip(tids[:12], titles[:12])):
        clean = re.sub(r'<[^>]+>', '', title).strip()[:70]
        safe_print(f"  [{i+1}] tid={tid} {clean!r}")

    # ページネーション関連を探す
    safe_print("\n--- pagination patterns in sch_thr_thread ---")
    page_pats = [
        r'<a[^>]+href="([^"]*)"[^>]*>[^<]*もっと見る[^<]*</a>',
        r'<a[^>]+href="([^"]*)"[^>]*>[^<]*次[^<]*</a>',
        r'href="(/sch_thr_thread/[^"]+)"',
        r'data-page="(\d+)"',
        r'[?&/]p=(\d+)',
        r'[?&/]pn=(\d+)',
        r'[?&/]pg=(\d+)',
        r'class="[^"]*pager[^"]*"',
        r'class="[^"]*pagination[^"]*"',
        r'class="[^"]*next[^"]*"',
    ]
    for pat in page_pats:
        found = re.findall(pat, html_thr, re.IGNORECASE)
        if found:
            safe_print(f"  {pat!r} -> {found[:5]}")

    # 最後の2000文字（フッター付近）
    safe_print("\n--- last 2000 chars of sch_thr_thread ---")
    safe_print(html_thr[-2000:])

    # ページ2のURL形式をいくつか試す
    safe_print("\n=== ページ2 URL試行 ===")
    p2_urls = [
        f"https://bakusai.com/sch_thr_thread/acode={acode}/word={encoded}/p=2/",
        f"https://bakusai.com/sch_thr_thread/acode={acode}/word={encoded}/pn=2/",
        f"https://bakusai.com/sch_thr_thread/acode={acode}/word={encoded}/pg=2/",
        f"https://bakusai.com/sch_thr_thread/acode={acode}/word={encoded}/page=2/",
        f"https://bakusai.com/sch_thr_thread/acode={acode}/word={encoded}/offset=10/",
    ]
    for url in p2_urls:
        try:
            h = fetch(url)
            tids2 = re.findall(r'id="tid-(\d+)"', h)
            different = set(tids2) - set(tids)
            safe_print(f"  {url}")
            safe_print(f"    len={len(h)} tid_count={len(tids2)} new_tids={len(different)}")
            if different:
                safe_print(f"    NEW tids: {list(different)[:5]}")
        except Exception as e:
            safe_print(f"  {url} -> Error: {e}")

if __name__ == "__main__":
    main()
