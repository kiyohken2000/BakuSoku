"""
板ページのスレ一覧アイテムの HTML 構造を詳しく解析する。
+ レス詳細ページの各レス（res_block）構造

出力: scripts/out/analyze_threaditem.txt
"""

import urllib.request
import re
import os

OUT_DIR = os.path.join(os.path.dirname(__file__), 'out')
os.makedirs(OUT_DIR, exist_ok=True)
OUT_FILE = os.path.join(OUT_DIR, 'analyze_threaditem.txt')

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

# 1. 板ページのスレ一覧構造
log('=' * 80)
log('Board page thread list structure')
log('=' * 80)

board_html = fetch('/thr_tl/acode=3/ctgid=116/bid=247/')

# スレ一覧の <a> タグを含むブロックを抽出
# 各スレは番号 + タイトル + 更新時間 + Good + レス数で構成
# テキストパターン: "1 たんぽぽ川村   9時間前 1852 100"
# → 番号, タイトル, 更新時間, Good数?, レス数?

# thr_res リンクの親要素を探す
log('\n--- Thread link parent elements ---')
# 各スレリンクの前後200文字
thr_link_contexts = re.finditer(r'<a[^>]*href="(/thr_res/acode=3/ctgid=116/bid=247/[^"]*)"[^>]*>([\s\S]*?)</a>', board_html)
for i, match in enumerate(thr_link_contexts):
    if i >= 3:
        break
    start = max(0, match.start() - 300)
    end = min(len(board_html), match.end() + 300)
    context = board_html[start:end]
    log(f'\n  Thread link {i+1}: {match.group(1)}')
    log(f'  Context ({len(context)} chars):')
    log(context)

# ol/ul リスト構造
log(f'\n--- Ordered/Unordered lists ---')
ol_lists = re.findall(r'<ol[^>]*class="([^"]*)"[^>]*>', board_html)
log(f'<ol> with class: {ol_lists}')
ul_lists = re.findall(r'<ul[^>]*class="([^"]*)"[^>]*>', board_html)
log(f'<ul> with class (first 10): {ul_lists[:10]}')

# 2. レス詳細ページの各レス構造
log(f'\n\n{"=" * 80}')
log('Thread detail page - res block structure')
log('=' * 80)

thr_html = fetch('/thr_res/acode=3/ctgid=116/bid=63/tid=12412150/tp=1/')

# 最初のレスブロックを詳しく
log('\n--- First res block ---')
first_res = re.search(r'id="res\d+_block"[^>]*>([\s\S]*?)(?=id="res\d+_block"|<footer|$)', thr_html)
if first_res:
    res_html = first_res.group(0)[:3000]
    log(res_html)

# OP ブロック
log(f'\n--- OP block (res0) ---')
op_block = re.search(r'id="res0_whole"[^>]*>([\s\S]*?)(?=id="res_list"|id="res\d+_block"|$)', thr_html)
if op_block:
    log(op_block.group(0)[:2000])

# レスの good/bad 部分
log(f'\n--- Res good/bad HTML (first non-OP res) ---')
res_blocks = re.findall(r'(id="res\d+_block"[^>]*>[\s\S]*?)(?=id="res\d+_block"|<footer|$)', thr_html)
log(f'Total res blocks: {len(res_blocks)}')
if len(res_blocks) >= 1:
    # good/bad 部分を抽出
    gb = re.search(r'rating_good_bad[\s\S]*?</span>\s*</span>\s*</span>', res_blocks[0])
    if gb:
        log(gb.group(0))
    else:
        log('No rating_good_bad found in first res block')
        # 代わりに good/bad っぽい部分を探す
        gb2 = re.search(r'good[\s\S]{0,500}bad', res_blocks[0], re.IGNORECASE)
        if gb2:
            log(f'Partial match: {gb2.group(0)[:500]}')

# レス body 構造
log(f'\n--- Res body structure ---')
res_bodies = re.findall(r'class="(?:res_body|resbody|div_box)"[^>]*>([\s\S]*?)</div>', thr_html)
log(f'res bodies: {len(res_bodies)}')
for i, body in enumerate(res_bodies[:2]):
    log(f'\n  Body {i+1}:')
    log(body[:500])

# レスメタ（番号、日時）
log(f'\n--- Res meta structure ---')
res_metas = re.findall(r'class="res_meta_wrap"[^>]*>([\s\S]*?)</div>', thr_html)
log(f'res_meta_wrap: {len(res_metas)}')
if res_metas:
    log(f'\n  First meta:')
    log(res_metas[0])

# レス投稿者名
log(f'\n--- Res author name ---')
res_names = re.findall(r'class="[^"]*name[^"]*"[^>]*>([\s\S]*?)</(?:span|div)>', thr_html)
log(f'Name elements: {len(res_names)}')
for i, name in enumerate(res_names[:3]):
    clean = re.sub(r'<[^>]+>', '', name).strip()[:100]
    log(f'  {clean}')

with open(OUT_FILE, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))

pass
