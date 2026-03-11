"""
bakusai モバイル HTML のページネーション構造を詳しく調査する。

- rw=1 モード: 1ページ何件? ページリンクは?
- 通常モード: 1ページ何件? ページリンクは?
- 「次のページ」「前のページ」リンクのパターン

出力: scripts/out/analyze_pagination.txt
"""

import urllib.request
import re
import os
import sys

sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf-8', buffering=1, closefd=False)

OUT_DIR = os.path.join(os.path.dirname(__file__), 'out')
os.makedirs(OUT_DIR, exist_ok=True)

BASE_URL = 'https://bakusai.com'
UA_MOBILE = (
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) '
    'AppleWebKit/605.1.15 (KHTML, like Gecko) '
    'Version/17.0 Mobile/15E148 Safari/604.1'
)

ACODE = 4; CTGID = 157; BID = 5813; TID = 13030722

lines = []
def log(s=''):
    print(s)
    lines.append(str(s))

def fetch(path):
    url = BASE_URL + path
    req = urllib.request.Request(url, headers={
        'User-Agent': UA_MOBILE,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja-JP,ja;q=0.9',
    })
    resp = urllib.request.urlopen(req, timeout=20)
    return resp.read().decode('utf-8', errors='replace')

def get_rrids(html):
    parts = re.split(r'<li\s+id="res', html)
    rrids = []
    for chunk in parts[1:]:
        m = re.match(r'^(\d+)_block', chunk)
        if m:
            rrid = int(m.group(1))
            if rrid > 0:
                rrids.append(rrid)
    return rrids

def get_page_links(html):
    """thr_res リンクからページ番号を抽出"""
    # /p=N/tp=1/ パターン (rw=1 あり・なし両方)
    rw1_pages = re.findall(
        r'href="[^"]*acode=\d+[^"]*tid=\d+[^"]*/p=(\d+)/tp=1/rw=1/"', html)
    normal_pages = re.findall(
        r'href="[^"]*acode=\d+[^"]*tid=\d+[^"]*/p=(\d+)/tp=1/"', html)
    return sorted(set(int(p) for p in rw1_pages)), sorted(set(int(p) for p in normal_pages))

def analyze(label, path):
    log()
    log('=' * 70)
    log(f'{label}')
    log(f'URL: {BASE_URL}{path}')
    log('=' * 70)
    html = fetch(path)

    rrids = get_rrids(html)
    unique_rrids = sorted(set(rrids))
    log(f'HTML size        : {len(html):,}')
    log(f'li#res 総数      : {len(rrids)}  (重複含む)')
    log(f'ユニーク rrid    : {len(unique_rrids)}  → {unique_rrids}')

    rw1_pages, normal_pages = get_page_links(html)
    log(f'rw=1 ページリンク: {rw1_pages}')
    log(f'通常 ページリンク: {normal_pages}')

    # 「次のページ」テキスト周辺
    next_m = re.search(r'次のページ(.{0,300})', html, re.DOTALL)
    if next_m:
        chunk = next_m.group(1)[:200].replace('\n', ' ')
        log(f'次のページ周辺  : {chunk}')

    # 「前のページ」テキスト周辺
    prev_m = re.search(r'前のページ(.{0,300})', html, re.DOTALL)
    if prev_m:
        chunk = prev_m.group(1)[:200].replace('\n', ' ')
        log(f'前のページ周辺  : {chunk}')

    # thr_res リンクをすべて表示
    all_thr = re.findall(r'href="(/thr_res/[^"]+)"', html)
    thr_set = sorted(set(all_thr))
    log(f'thr_res リンク ({len(thr_set)} 種):')
    for u in thr_set:
        log(f'  {u}')

    return unique_rrids

log('=== bakusai モバイル ページネーション調査 ===')

# rw=1 各ページ
for page in [None, 2, 3, 4, 130, 135, 136, 137]:
    if page is None:
        path = f'/thr_res/acode={ACODE}/ctgid={CTGID}/bid={BID}/tid={TID}/tp=1/rw=1/'
        label = f'rw=1 page=1(デフォルト)'
    else:
        path = f'/thr_res/acode={ACODE}/ctgid={CTGID}/bid={BID}/tid={TID}/p={page}/tp=1/rw=1/'
        label = f'rw=1 page={page}'
    try:
        analyze(label, path)
    except Exception as e:
        log(f'ERROR: {e}')

log()
log('=== 通常モード (最新) ページ ===')
for page in [None, 2, 3]:
    if page is None:
        path = f'/thr_res/acode={ACODE}/ctgid={CTGID}/bid={BID}/tid={TID}/tp=1/'
        label = '通常 page=1(デフォルト)'
    else:
        path = f'/thr_res/acode={ACODE}/ctgid={CTGID}/bid={BID}/tid={TID}/p={page}/tp=1/'
        label = f'通常 page={page}'
    try:
        analyze(label, path)
    except Exception as e:
        log(f'ERROR: {e}')

OUT_FILE = os.path.join(OUT_DIR, 'analyze_pagination.txt')
with open(OUT_FILE, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))
log(f'\n出力完了: {OUT_FILE}')
