"""
正しい URL パターンで板一覧・カテゴリ・エリア・検索ページを解析する。

出力: scripts/out/analyze_pages.txt
"""

import urllib.request
import re
import os

OUT_DIR = os.path.join(os.path.dirname(__file__), 'out')
os.makedirs(OUT_DIR, exist_ok=True)
OUT_FILE = os.path.join(OUT_DIR, 'analyze_pages.txt')

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
    return resp.read().decode('utf-8', errors='replace'), resp.url

PAGES = [
    ('/thr_tl/acode=3/ctgid=116/bid=247/', 'Board thread list (お笑い芸人)'),
    ('/thr_tl/acode=3/ctgid=116/bid=247/p=2/', 'Board thread list page 2'),
    ('/bbstop/acode=3/ctgid=116/', 'Category board list (芸能)'),
    ('/ctgtop/acode=3/', 'Area category list (関東)'),
    ('/areatop/acode=3/', 'Area top with acode'),
    ('/sch_result/', 'Search result page (GET, no params)'),
    ('/sch_all/acode=3/word=%E6%9D%BE%E6%9C%AC/', 'Search all (松本)'),
]

for path, label in PAGES:
    log(f'\n{"=" * 80}')
    log(f'{label}: {BASE_URL}{path}')
    log(f'{"=" * 80}')

    try:
        html, final_url = fetch(path)
    except Exception as e:
        log(f'Error: {e}')
        continue

    log(f'Final URL: {final_url}')
    log(f'HTML length: {len(html)} chars')

    # h1
    h1 = re.search(r'<h1[^>]*>([\s\S]*?)</h1>', html)
    if h1:
        clean_h1 = re.sub(r'<[^>]+>', '', h1.group(1)).strip()[:100]
        log(f'<h1>: {clean_h1}')

    # エラーチェック
    if 'エラー' in (h1.group(1) if h1 else ''):
        log('*** Page returned error ***')
        # エラー内容
        error_msg = re.search(r'class="[^"]*error[^"]*"[^>]*>([\s\S]*?)</div>', html)
        if error_msg:
            log(f'Error content: {re.sub(r"<[^>]+>", "", error_msg.group(1)).strip()[:300]}')
        continue

    # スレッド一覧リンク
    log(f'\n--- Thread links (/thr_res/) ---')
    thr_links = re.findall(r'<a[^>]*href="(/thr_res/[^"]*)"[^>]*>([\s\S]*?)</a>', html)
    log(f'Count: {len(thr_links)}')
    for i, (href, text) in enumerate(thr_links[:5]):
        clean = re.sub(r'<[^>]+>', ' ', text).strip()
        clean = re.sub(r'\s+', ' ', clean)[:100]
        log(f'  {href}')
        log(f'    {clean}')

    # 板リンク
    log(f'\n--- Board links (/thr_tl/) ---')
    board_links = re.findall(r'<a[^>]*href="(/thr_tl/[^"]*)"[^>]*>([\s\S]*?)</a>', html)
    log(f'Count: {len(board_links)}')
    for i, (href, text) in enumerate(board_links[:10]):
        clean = re.sub(r'<[^>]+>', '', text).strip()[:80]
        log(f'  {href} -> {clean}')

    # カテゴリリンク
    log(f'\n--- Category links (/bbstop/) ---')
    cat_links = re.findall(r'<a[^>]*href="(/bbstop/[^"]*)"[^>]*>([\s\S]*?)</a>', html)
    log(f'Count: {len(cat_links)}')
    for i, (href, text) in enumerate(cat_links[:10]):
        clean = re.sub(r'<[^>]+>', '', text).strip()[:80]
        log(f'  {href} -> {clean}')

    # エリアリンク
    log(f'\n--- Area links ---')
    area_links = re.findall(r'<a[^>]*href="(/(?:areatop|ctgtop)/[^"]*)"[^>]*>([\s\S]*?)</a>', html)
    log(f'Count: {len(area_links)}')
    for i, (href, text) in enumerate(area_links[:10]):
        clean = re.sub(r'<[^>]+>', '', text).strip()[:80]
        log(f'  {href} -> {clean}')

    # ページネーション
    log(f'\n--- Pagination ---')
    page_links = re.findall(r'href="([^"]*p=\d+[^"]*)"', html)
    log(f'Page links: {len(page_links)}')
    for pl in sorted(set(page_links))[:10]:
        log(f'  {pl}')

    # リスト構造（li + クラス）
    log(f'\n--- List item structure ---')
    list_items = re.findall(r'<li[^>]*class="([^"]*)"[^>]*>([\s\S]*?)</li>', html)
    # class ごとにグループ化
    from collections import Counter
    class_counter = Counter(cls for cls, _ in list_items)
    log(f'<li> classes: {dict(class_counter.most_common(10))}')

    # 最も多い class の例
    if class_counter:
        top_class = class_counter.most_common(1)[0][0]
        examples = [(cls, content) for cls, content in list_items if cls == top_class][:2]
        for cls, content in examples:
            clean = re.sub(r'<[^>]+>', ' ', content).strip()
            clean = re.sub(r'\s+', ' ', clean)[:200]
            log(f'  .{cls}: {clean}')

    # レス数表示
    log(f'\n--- Res count display ---')
    res_counts = re.findall(r'(\d+)\s*(?:レス|件|res)', html, re.IGNORECASE)
    log(f'Res count patterns: {res_counts[:10]}')

    # 検索フォーム
    log(f'\n--- Search form ---')
    forms = re.findall(r'<form[^>]*action="([^"]*)"[^>]*>([\s\S]*?)</form>', html)
    for action, form_html in forms:
        if 'sch' in action.lower() or 'search' in action.lower():
            log(f'  Action: {action}')
            inputs = re.findall(r'<input([^>]*)/?>', form_html)
            for inp in inputs:
                name = re.search(r'name="([^"]*)"', inp)
                type_ = re.search(r'type="([^"]*)"', inp)
                if name:
                    log(f'    name={name.group(1)} type={type_.group(1) if type_ else "?"}')

with open(OUT_FILE, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))

pass
