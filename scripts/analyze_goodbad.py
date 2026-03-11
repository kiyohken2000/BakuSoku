"""
Good/Bad 投票の AJAX エンドポイントを特定する。
- スレッド詳細ページのインラインスクリプトを全て抽出
- good/bad 関連のイベントハンドラを検索
- 追加の外部JSファイルを確認

出力: scripts/out/analyze_goodbad.txt
"""

import urllib.request
import re
import os

OUT_DIR = os.path.join(os.path.dirname(__file__), 'out')
os.makedirs(OUT_DIR, exist_ok=True)
OUT_FILE = os.path.join(OUT_DIR, 'analyze_goodbad.txt')

BASE_URL = 'https://bakusai.com'
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Mobile/15E148 Safari/604.1',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'ja-JP,ja;q=0.9',
}

TEST_URL = '/thr_res/acode=3/ctgid=116/bid=63/tid=12412150/tp=1/'

lines = []

def log(s=''):
    lines.append(str(s))

def fetch(path):
    url = BASE_URL + path
    req = urllib.request.Request(url, headers=HEADERS)
    resp = urllib.request.urlopen(req, timeout=15)
    html = resp.read().decode('utf-8', errors='replace')
    return html

log('=' * 80)
log(f'Fetching: {BASE_URL}{TEST_URL}')
log('=' * 80)

html = fetch(TEST_URL)
log(f'HTML length: {len(html)} chars')

# 1. 全インラインスクリプトを抽出
log('\n--- All Inline Scripts ---')
inline_scripts = re.findall(r'<script(?:\s[^>]*)?>(?!\s*$)([\s\S]*?)</script>', html)
log(f'Total inline <script> blocks: {len(inline_scripts)}')

for i, script in enumerate(inline_scripts):
    script_clean = script.strip()
    if not script_clean:
        continue
    # good/bad 関連を含むかチェック
    has_good_bad = bool(re.search(r'good|bad|Good|Bad|評価', script_clean, re.IGNORECASE))
    log(f'\n  Script {i+1} (len={len(script_clean)}, good/bad={has_good_bad}):')
    if has_good_bad:
        log('  *** CONTAINS GOOD/BAD REFERENCES ***')
        log(script_clean)
    else:
        # 先頭200文字だけ表示
        log(f'  Preview: {script_clean[:200]}')

# 2. good/bad ボタンの HTML 構造を詳しく抽出
log('\n--- Good/Bad Button HTML ---')
# .good_Button, .bad_Button 周辺
good_btns = re.findall(r'class="[^"]*good[^"]*"[^>]*>[\s\S]{0,300}', html, re.IGNORECASE)
log(f'Elements with "good" in class: {len(good_btns)}')
for j, btn in enumerate(good_btns[:5]):
    log(f'  Good element {j+1}: {btn[:300]}')

bad_btns = re.findall(r'class="[^"]*bad[^"]*"[^>]*>[\s\S]{0,300}', html, re.IGNORECASE)
log(f'Elements with "bad" in class: {len(bad_btns)}')
for j, btn in enumerate(bad_btns[:5]):
    log(f'  Bad element {j+1}: {btn[:300]}')

# 3. data-* 属性で good/bad 関連
log('\n--- data-* attributes near good/bad ---')
data_attrs = re.findall(r'<[^>]*(data-[a-z_-]+="[^"]*")[^>]*(good|bad)[^>]*>', html, re.IGNORECASE)
log(f'data-* near good/bad: {len(data_attrs)}')
for d in data_attrs[:10]:
    log(f'  {d}')

# 4. onclick/onsubmit ハンドラで good/bad 関連
log('\n--- onclick/onsubmit with good/bad ---')
onclick_gb = re.findall(r'on(?:click|submit)="[^"]*(?:good|bad)[^"]*"', html, re.IGNORECASE)
log(f'onclick/onsubmit with good/bad: {len(onclick_gb)}')
for o in onclick_gb[:5]:
    log(f'  {o}')

# 5. 全外部スクリプト URL（フィルタなし）
log('\n--- ALL External Script URLs ---')
all_scripts = re.findall(r'<script[^>]*src="([^"]+)"[^>]*>', html)
log(f'Total external scripts: {len(all_scripts)}')
for s in all_scripts:
    log(f'  {s}')

# 6. fetch/XMLHttpRequest/$.ajax/$.post/$.get を含むインラインスクリプト
log('\n--- AJAX calls in inline scripts ---')
for i, script in enumerate(inline_scripts):
    script_clean = script.strip()
    if not script_clean:
        continue
    has_ajax = bool(re.search(r'fetch\(|XMLHttpRequest|\.ajax\(|\.post\(|\.get\(', script_clean))
    if has_ajax:
        log(f'\n  Script {i+1} has AJAX calls:')
        log(script_clean[:2000])

# 7. good_Button / bad_Button の完全なHTML要素
log('\n--- Full good_Button / bad_Button elements ---')
# もう少し広い範囲で探す
good_full = re.findall(r'<[^>]*class="[^"]*good_Button[^"]*"[^>]*>[\s\S]*?(?:</[a-z]+>)', html)
log(f'good_Button full elements: {len(good_full)}')
for g in good_full[:3]:
    log(f'  {g[:500]}')

bad_full = re.findall(r'<[^>]*class="[^"]*bad_Button[^"]*"[^>]*>[\s\S]*?(?:</[a-z]+>)', html)
log(f'bad_Button full elements: {len(bad_full)}')
for b in bad_full[:3]:
    log(f'  {b[:500]}')

# 8. rrid（レス番号）の取得方法 — data-rrid or similar
log('\n--- rrid / res ID attributes ---')
rrid_attrs = re.findall(r'(?:data-rrid|data-id|data-res|id="res)[^"]*"[^"]*"', html)
log(f'rrid-related attributes: {len(rrid_attrs)}')
for r in rrid_attrs[:10]:
    log(f'  {r}')

# broader search
rrid_in_html = re.findall(r'rrid[^<]{0,200}', html)
log(f'\n"rrid" occurrences in HTML: {len(rrid_in_html)}')
for r in rrid_in_html[:10]:
    log(f'  {r[:200]}')

with open(OUT_FILE, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))

pass  # output written to file only
