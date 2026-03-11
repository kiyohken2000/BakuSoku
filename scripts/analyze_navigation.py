"""
スレッド詳細ページからナビゲーションリンクを抽出して正しい URL パターンを特定する。
- パンくずリスト
- サイドバー/ヘッダーのリンク
- フッターのリンク
- 全 <a> タグの href パターン

出力: scripts/out/analyze_navigation.txt
"""

import urllib.request
import re
import os
from collections import Counter

OUT_DIR = os.path.join(os.path.dirname(__file__), 'out')
os.makedirs(OUT_DIR, exist_ok=True)
OUT_FILE = os.path.join(OUT_DIR, 'analyze_navigation.txt')

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
    url = BASE_URL + path
    req = urllib.request.Request(url, headers=HEADERS)
    resp = urllib.request.urlopen(req, timeout=15)
    return resp.read().decode('utf-8', errors='replace')

# スレッド詳細ページ
test_url = '/thr_res/acode=3/ctgid=116/bid=63/tid=12412150/tp=1/'
log(f'Fetching: {BASE_URL}{test_url}')
html = fetch(test_url)
log(f'HTML length: {len(html)} chars')

# 全 <a> タグを抽出
log(f'\n{"=" * 80}')
log('All <a> hrefs')
log(f'{"=" * 80}')

all_links = re.findall(r'<a[^>]*href="([^"]*)"[^>]*>', html)
log(f'Total links: {len(all_links)}')

# bakusai.com 内リンクのパス部分を分類
internal_paths = []
for link in all_links:
    if link.startswith('/'):
        internal_paths.append(link)
    elif link.startswith('https://bakusai.com/'):
        internal_paths.append(link.replace('https://bakusai.com', ''))

# パスのプレフィックスでグルーピング
prefix_counter = Counter()
prefix_examples = {}
for path in internal_paths:
    parts = path.strip('/').split('/')
    if parts:
        prefix = '/' + parts[0] + '/'
        prefix_counter[prefix] += 1
        if prefix not in prefix_examples or len(prefix_examples[prefix]) < 3:
            prefix_examples.setdefault(prefix, []).append(path)

log('\n--- Internal link prefixes ---')
for prefix, count in prefix_counter.most_common():
    log(f'  {prefix} : {count}')
    for ex in prefix_examples.get(prefix, [])[:3]:
        log(f'    {ex}')

# パンくず（breadcrumb）
log(f'\n--- Breadcrumbs ---')
# いくつかのパターンで探す
bc_patterns = [
    r'class="[^"]*breadcrumb[^"]*"[^>]*>([\s\S]*?)</(?:ol|ul|nav|div)>',
    r'class="[^"]*topicpath[^"]*"[^>]*>([\s\S]*?)</(?:ol|ul|nav|div)>',
    r'class="[^"]*pankuzu[^"]*"[^>]*>([\s\S]*?)</(?:ol|ul|nav|div)>',
    r'class="[^"]*path[^"]*"[^>]*>([\s\S]*?)</(?:ol|ul|nav|div)>',
]
for pat in bc_patterns:
    match = re.search(pat, html)
    if match:
        log(f'  Pattern: {pat[:40]}...')
        content = match.group(1)
        links = re.findall(r'<a[^>]*href="([^"]*)"[^>]*>(.*?)</a>', content)
        for href, text in links:
            clean = re.sub(r'<[^>]+>', '', text).strip()
            log(f'    {clean} -> {href}')
        break
else:
    log('  Standard breadcrumb not found')
    # schema.org BreadcrumbList を探す
    schema_bc = re.search(r'"@type"\s*:\s*"BreadcrumbList"[\s\S]*?\]', html)
    if schema_bc:
        log(f'  Schema.org BreadcrumbList found:')
        log(f'  {schema_bc.group(0)[:500]}')

# ヘッダーナビ
log(f'\n--- Header Navigation ---')
header = re.search(r'<header[^>]*>([\s\S]*?)</header>', html)
if header:
    links = re.findall(r'<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)</a>', header.group(1))
    log(f'  Links in header: {len(links)}')
    for href, text in links[:10]:
        clean = re.sub(r'<[^>]+>', '', text).strip()[:60]
        log(f'    {clean} -> {href}')
else:
    log('  <header> not found')

# thr_list リンク
log(f'\n--- thr_list links ---')
thr_list_links = [l for l in internal_paths if 'thr_list' in l]
log(f'  Count: {len(thr_list_links)}')
for l in thr_list_links[:10]:
    log(f'    {l}')

# カテゴリリンク
log(f'\n--- Category links ---')
cat_links = [l for l in internal_paths if 'catelist' in l or 'ctg' in l.split('/')[1] if len(l.split('/')) > 1]
log(f'  Count: {len(cat_links)}')
for l in cat_links[:10]:
    log(f'    {l}')

# 検索フォーム
log(f'\n--- Search form ---')
search_action = re.findall(r'<form[^>]*action="([^"]*)"[^>]*>', html)
log(f'  Form actions: {search_action}')

search_inputs = re.findall(r'id="idWord"[^>]*', html)
log(f'  #idWord: {search_inputs}')

# 2つ目のページをフェッチ — 板トップページ
# スレから「板に戻る」リンクを探す
log(f'\n{"=" * 80}')
log('Looking for "back to board" link')
log(f'{"=" * 80}')
back_links = re.findall(r'<a[^>]*href="([^"]*)"[^>]*>[^<]*(?:板|一覧|戻る|Board)[^<]*</a>', html)
log(f'Back links: {len(back_links)}')
for l in back_links[:5]:
    log(f'  {l}')

# thr_list を含むリンクを全て表示
log(f'\n--- All links containing "thr_list" in full page ---')
thr_list_all = re.findall(r'href="([^"]*thr_list[^"]*)"', html)
log(f'Count: {len(thr_list_all)}')
for l in thr_list_all[:10]:
    log(f'  {l}')

# 板名リンクを探す
log(f'\n--- Board name links ---')
bid_links = re.findall(r'href="([^"]*bid=\d+[^"]*)"[^>]*>([\s\S]*?)</a>', html)
log(f'Links with bid=: {len(bid_links)}')
for href, text in bid_links[:10]:
    clean = re.sub(r'<[^>]+>', '', text).strip()[:80]
    log(f'  {clean} -> {href}')

# 実際の板一覧ページを試す（acode 付き）
board_urls_to_try = [
    '/thr_list/acode=3/ctgid=116/bid=63/',
    '/thr_list/acode=3/ctgid=116/bid=247/',
]

for board_url in board_urls_to_try:
    log(f'\n{"=" * 80}')
    log(f'Trying board URL: {BASE_URL}{board_url}')
    log(f'{"=" * 80}')
    try:
        board_html = fetch(board_url)
        log(f'Status: OK, length: {len(board_html)} chars')

        # h1
        h1 = re.search(r'<h1[^>]*>(.*?)</h1>', board_html)
        if h1:
            log(f'<h1>: {re.sub(r"<[^>]+>", "", h1.group(1)).strip()[:100]}')

        # スレ一覧の構造を探す
        thr_items = re.findall(r'<a[^>]*href="(/thr_res/[^"]*)"[^>]*>([\s\S]*?)</a>', board_html)
        log(f'Thread links: {len(thr_items)}')
        for i, (href, text) in enumerate(thr_items[:3]):
            clean = re.sub(r'<[^>]+>', ' ', text).strip()[:100]
            log(f'  {href} -> {clean}')

        # li 要素の構造
        li_items = re.findall(r'<li[^>]*class="[^"]*"[^>]*>([\s\S]*?)</li>', board_html)
        log(f'\n<li> items with class: {len(li_items)}')
        for i, item in enumerate(li_items[:3]):
            clean = re.sub(r'<[^>]+>', ' ', item).strip()
            clean = re.sub(r'\s+', ' ', clean)[:200]
            log(f'  Item {i+1}: {clean}')

    except Exception as e:
        log(f'Error: {e}')

with open(OUT_FILE, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))

pass
