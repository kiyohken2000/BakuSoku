"""
goodbadButton.js を取得して解析する。
また、スレ用とレス用の Good/Bad ボタン構造をより詳しく抽出する。

出力: scripts/out/analyze_goodbad2.txt
"""

import urllib.request
import re
import os

OUT_DIR = os.path.join(os.path.dirname(__file__), 'out')
os.makedirs(OUT_DIR, exist_ok=True)
OUT_FILE = os.path.join(OUT_DIR, 'analyze_goodbad2.txt')

BASE_URL = 'https://bakusai.com'
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Mobile/15E148 Safari/604.1',
    'Accept': '*/*',
    'Accept-Language': 'ja-JP,ja;q=0.9',
}

lines = []

def log(s=''):
    lines.append(str(s))

# 1. goodbadButton.js を取得
js_url = '/js/thr/goodbadButton.js?t=1754530172'
url = BASE_URL + js_url
log(f'{"=" * 80}')
log(f'Fetching: {url}')
log(f'{"=" * 80}')

req = urllib.request.Request(url, headers=HEADERS)
resp = urllib.request.urlopen(req, timeout=15)
content = resp.read().decode('utf-8', errors='replace')
log(f'Length: {len(content)} chars')
log('')
log('--- Full Content ---')
log(content)

# 2. スレッド詳細ページから Good/Bad ボタン周辺の HTML を詳しく抽出
log('\n' + '=' * 80)
log('Fetching thread page for detailed Good/Bad HTML')
log('=' * 80)

test_url = '/thr_res/acode=3/ctgid=116/bid=63/tid=12412150/tp=1/'
req2 = urllib.request.Request(BASE_URL + test_url, headers={
    **HEADERS,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
})
resp2 = urllib.request.urlopen(req2, timeout=15)
html = resp2.read().decode('utf-8', errors='replace')

# rating_good_bad 周辺を詳しく
log('\n--- rating_good_bad spans ---')
rgb_spans = re.findall(r'<span class="rating_good_bad[^"]*"[^>]*>[\s\S]*?</span>\s*</span>\s*</span>', html)
log(f'Found {len(rgb_spans)} rating_good_bad spans')
for i, span in enumerate(rgb_spans[:3]):
    log(f'\n  Span {i+1}:')
    log(span)

# Script 52 の完全内容（いいねボタン用変数）
log('\n--- Script with thr_class_name ---')
scripts = re.findall(r'<script(?:\s[^>]*)?>(?!\s*$)([\s\S]*?)</script>', html)
for i, script in enumerate(scripts):
    if 'thr_class_name' in script or 'goodbad' in script.lower() or 'good_bad' in script:
        log(f'\n  Script {i+1} (full):')
        log(script.strip())

# res ごとの Good/Bad ボタン構造
log('\n--- Per-res Good/Bad structure ---')
# res_block ごとに good/bad を見る
res_blocks = re.findall(r'id="res(\d+)_block"[\s\S]*?(?=id="res\d+_block"|$)', html)
log(f'res blocks found: {len(res_blocks)}')
if res_blocks:
    # 最初のレスブロックの good/bad 部分
    first_block = res_blocks[0]
    gb_section = re.search(r'rating_good_bad[\s\S]*?</span>\s*</span>\s*</span>', first_block)
    if gb_section:
        log('\n  First res good/bad section:')
        log(gb_section.group(0))

# good_bad_Thr vs good_bad_Res
log('\n--- good_bad_Thr vs good_bad_Res ---')
thr_gb = re.findall(r'good_bad_Thr', html)
res_gb = re.findall(r'good_bad_Res', html)
log(f'good_bad_Thr occurrences: {len(thr_gb)}')
log(f'good_bad_Res occurrences: {len(res_gb)}')

with open(OUT_FILE, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))

pass
