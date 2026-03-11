"""
スレッド一覧・板一覧・検索の HTML 構造を解析する。
- 板トップ（スレ一覧）
- カテゴリ一覧
- 検索結果
- パンくずリスト

出力: scripts/out/analyze_threadlist.txt
"""

import urllib.request
import re
import os

OUT_DIR = os.path.join(os.path.dirname(__file__), 'out')
os.makedirs(OUT_DIR, exist_ok=True)
OUT_FILE = os.path.join(OUT_DIR, 'analyze_threadlist.txt')

BASE_URL = 'https://bakusai.com'
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Mobile/15E148 Safari/604.1',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'ja-JP,ja;q=0.9',
}

lines = []

def log(s=''):
    lines.append(str(s))

def fetch(path):
    url = BASE_URL + path if path.startswith('/') else path
    req = urllib.request.Request(url, headers=HEADERS)
    resp = urllib.request.urlopen(req, timeout=15)
    html = resp.read().decode('utf-8', errors='replace')
    return html, resp.getheaders(), resp.url, resp.status

TEST_PAGES = [
    # 板トップ（スレ一覧）- 東京 > 芸能 > 男性芸能人
    ('/thr_list/ctgid=116/bid=63/', 'Board thread list'),
    # カテゴリトップ - 東京 > 芸能
    ('/thr_catelist/ctgid=116/', 'Category board list'),
    # 検索
    ('/search/?kw=%E6%9D%BE%E6%9C%AC&cs=1', 'Search results'),
    # エリアトップ（JS 必須かも）
    ('/areatop/', 'Area top'),
]

for path, label in TEST_PAGES:
    log(f'\n{"=" * 80}')
    log(f'{label}: {BASE_URL}{path}')
    log(f'{"=" * 80}')

    try:
        html, headers, final_url, status = fetch(path)
    except Exception as e:
        log(f'Error: {e}')
        continue

    log(f'Status: {status}')
    log(f'Final URL: {final_url}')
    log(f'HTML length: {len(html)} chars')

    if len(html) < 100:
        log(f'Too short, content: {html}')
        continue

    # パンくず
    log(f'\n--- Breadcrumbs ---')
    breadcrumb = re.search(r'class="[^"]*breadcrumb[^"]*"[^>]*>([\s\S]*?)</(?:ol|ul|nav|div)>', html)
    if breadcrumb:
        crumbs = re.findall(r'<a[^>]*href="([^"]*)"[^>]*>(.*?)</a>', breadcrumb.group(1))
        log(f'  Crumb links: {len(crumbs)}')
        for href, text in crumbs:
            clean_text = re.sub(r'<[^>]+>', '', text).strip()
            log(f'    {clean_text} -> {href}')
    else:
        log('  Not found')

    # h1
    h1 = re.search(r'<h1[^>]*>(.*?)</h1>', html)
    if h1:
        log(f'\n  <h1>: {re.sub(r"<[^>]+>", "", h1.group(1)).strip()[:100]}')

    # スレッド一覧項目
    log(f'\n--- Thread List Items ---')
    # パターン1: thr_list_wrap
    thr_items = re.findall(r'class="thr_list_wrap"[^>]*>([\s\S]*?)</(?:li|div|article)>', html)
    log(f'  .thr_list_wrap items: {len(thr_items)}')
    if thr_items:
        for i, item in enumerate(thr_items[:2]):
            log(f'\n  Item {i+1} (raw HTML):')
            log(item[:600])

    # パターン2: <a> リンクでスレッドURL
    thr_links = re.findall(r'<a[^>]*href="(/thr_res/[^"]*)"[^>]*>([\s\S]*?)</a>', html)
    log(f'\n  Thread links: {len(thr_links)}')
    for i, (href, text) in enumerate(thr_links[:5]):
        clean = re.sub(r'<[^>]+>', ' ', text).strip()[:100]
        log(f'    {href} -> {clean}')

    # パターン3: スレタイトル
    thr_titles = re.findall(r'class="[^"]*thr_title[^"]*"[^>]*>([\s\S]*?)</(?:a|span|div|p)>', html)
    log(f'\n  .thr_title items: {len(thr_titles)}')
    for i, title in enumerate(thr_titles[:5]):
        clean = re.sub(r'<[^>]+>', '', title).strip()[:100]
        log(f'    {clean}')

    # 板一覧項目
    log(f'\n--- Board List Items ---')
    board_links = re.findall(r'<a[^>]*href="(/thr_list/[^"]*)"[^>]*>([\s\S]*?)</a>', html)
    log(f'  Board links: {len(board_links)}')
    for i, (href, text) in enumerate(board_links[:10]):
        clean = re.sub(r'<[^>]+>', '', text).strip()[:100]
        log(f'    {href} -> {clean}')

    # カテゴリ一覧項目
    log(f'\n--- Category List Items ---')
    cat_links = re.findall(r'<a[^>]*href="(/thr_catelist/[^"]*)"[^>]*>([\s\S]*?)</a>', html)
    log(f'  Category links: {len(cat_links)}')
    for i, (href, text) in enumerate(cat_links[:10]):
        clean = re.sub(r'<[^>]+>', '', text).strip()[:100]
        log(f'    {href} -> {clean}')

    # 検索フォーム
    log(f'\n--- Search Form ---')
    search_forms = re.findall(r'<form[^>]*action="[^"]*search[^"]*"[^>]*>([\s\S]*?)</form>', html, re.IGNORECASE)
    log(f'  Search forms: {len(search_forms)}')
    for i, form in enumerate(search_forms[:2]):
        inputs = re.findall(r'<input([^>]*)/?>', form)
        log(f'  Form {i+1} inputs:')
        for inp in inputs:
            name = re.search(r'name="([^"]*)"', inp)
            type_ = re.search(r'type="([^"]*)"', inp)
            value = re.search(r'value="([^"]*)"', inp)
            log(f'    name={name.group(1) if name else "?"} type={type_.group(1) if type_ else "?"} value={value.group(1)[:50] if value else "?"}')

    # ページネーション
    log(f'\n--- Pagination ---')
    page_links = re.findall(r'href="([^"]*[?&]p=\d+[^"]*)"', html)
    log(f'  ?p= links: {len(page_links)}')
    for pl in page_links[:5]:
        log(f'    {pl}')

    # スレ数/レス数表示
    log(f'\n--- Thread/Res counts ---')
    counts = re.findall(r'(\d+)\s*(?:レス|件|スレ)', html)
    log(f'  Count patterns: {counts[:10]}')

with open(OUT_FILE, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))

pass
