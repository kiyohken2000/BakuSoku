"""
rw=1 (最初から読む) ページの HTML 構造を詳細調査する。

問題: アプリで最初から読むモードにすると、ブラウザで50件表示されるのに
      アプリでは7件しか表示されない。

調査内容:
  - <li id="res{N}_block"> の出現数と rrid 一覧
  - res_body の有無・中身
  - ページネーション構造
  - 通常ページとの HTML 差分比較

出力: scripts/out/analyze_rw1.txt
"""

import urllib.request
import urllib.parse
import re
import os
import sys

# Windows コンソールの文字コード問題を回避
sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf-8', buffering=1, closefd=False)

OUT_DIR = os.path.join(os.path.dirname(__file__), 'out')
os.makedirs(OUT_DIR, exist_ok=True)
OUT_FILE = os.path.join(OUT_DIR, 'analyze_rw1.txt')

BASE_URL = 'https://bakusai.com'

# アプリと同じ UA
UA_MOBILE = (
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) '
    'AppleWebKit/605.1.15 (KHTML, like Gecko) '
    'Version/17.0 Mobile/15E148 Safari/604.1'
)
# PC UA (比較用)
UA_PC = (
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
    'AppleWebKit/537.36 (KHTML, like Gecko) '
    'Chrome/124.0.0.0 Safari/537.36'
)

# テスト対象スレッド (ユーザーが問題を確認したスレッド)
ACODE  = 4
CTGID  = 157
BID    = 5813
TID    = 13030722

lines = []

def log(s=''):
    print(s)
    lines.append(str(s))

def fetch(path, ua=UA_MOBILE):
    url = BASE_URL + path
    req = urllib.request.Request(url, headers={
        'User-Agent': ua,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja-JP,ja;q=0.9',
        'Accept-Encoding': 'identity',
    })
    try:
        resp = urllib.request.urlopen(req, timeout=20)
        html = resp.read().decode('utf-8', errors='replace')
        return html, resp.url, resp.status
    except urllib.error.HTTPError as e:
        return None, str(e.url), e.code
    except Exception as e:
        return None, str(e), 0

# ---- ヘルパー ----

def strip_tags(s):
    return re.sub(r'<[^>]+>', '', s).strip()

def find_res_blocks(html):
    """<li id="res{N}_block"> を全て抽出して返す"""
    parts = re.split(r'<li\s+id="res', html)
    results = []
    for chunk in parts[1:]:
        m = re.match(r'^(\d+)_block', chunk)
        if not m:
            results.append({'rrid': None, 'chunk_head': chunk[:80]})
            continue
        rrid = int(m.group(1))

        # res_body
        body = ''
        bm = chunk.find('class="res_body"')
        if bm != -1:
            after = chunk.index('>', bm) + 1
            content = chunk[after:]
            end = content.find('</div>')
            if end != -1:
                raw = content[:end]
                body = re.sub(r'<[^>]+>', '', raw).strip()
                body = re.sub(r'\s+', ' ', body)[:100]
            else:
                body = '[</div> not found]'
        else:
            body = '[no res_body]'

        # date
        dm = re.search(r'class="res_rotundate"[^>]*>([\s\S]*?)</span>', chunk)
        date = strip_tags(dm.group(1)) if dm else ''

        results.append({'rrid': rrid, 'body': body, 'date': date})
    return results

def analyze_page(label, path, ua):
    log()
    log('=' * 80)
    log(f'{label}')
    log(f'  URL : {BASE_URL}{path}')
    log(f'  UA  : {"Mobile" if ua == UA_MOBILE else "PC"}')
    log('=' * 80)

    html, final_url, status = fetch(path, ua)
    if html is None:
        log(f'  ERROR: status={status} url={final_url}')
        return

    log(f'  Status     : {status}')
    log(f'  Final URL  : {final_url}')
    log(f'  HTML size  : {len(html):,} bytes')

    # ---- タイトル ----
    title_m = re.search(r'<title>([^<]+)</title>', html)
    log(f'  <title>    : {title_m.group(1).strip() if title_m else "N/A"}')

    # ---- レス数パターン ----
    res_num1 = re.search(r'レス数(\d+)', html)
    res_num2 = re.search(r'[｜|](\d+)レス[｜|]', html)
    log(f'  レス数N   : {res_num1.group(1) if res_num1 else "none"}')
    log(f'  ｜Nレス｜ : {res_num2.group(1) if res_num2 else "none"}')

    # ---- ページネーション ----
    page_links = re.findall(r'href="([^"]*p=(\d+)[^"]*)"', html)
    page_nums = sorted(set(int(n) for _, n in page_links))
    rw1_links = [u for u, _ in page_links if 'rw=1' in u]
    log(f'  ページリンク数 : {len(page_links)}  ページ番号: {page_nums[:20]}')
    log(f'  rw=1 links : {len(rw1_links)}  例: {rw1_links[:3]}')

    # ---- <li id="res"> ブロック解析 ----
    blocks = find_res_blocks(html)
    valid = [b for b in blocks if b.get('rrid') is not None and b['rrid'] != 0]
    invalid = [b for b in blocks if b.get('rrid') is None]
    no_body = [b for b in valid if '[' in b.get('body', '')]
    real = [b for b in valid if '[' not in b.get('body', '') and b.get('body', '')]

    log()
    log(f'  <li id="res"> 総数  : {len(blocks)}')
    log(f'    rrid=0 (placeholder): {sum(1 for b in blocks if b.get("rrid") == 0)}')
    log(f'    rrid=None (non-numeric): {len(invalid)}')
    log(f'    valid rrid          : {len(valid)}')
    log(f'    body あり           : {len(real)}')
    log(f'    body なし/エラー    : {len(no_body)}')

    if valid:
        rrids = [b['rrid'] for b in valid]
        log(f'  rrid 一覧 (先頭20): {rrids[:20]}')
        log(f'  rrid 最小/最大    : {min(rrids)} / {max(rrids)}')

    log()
    log('  --- 各ブロック詳細 (先頭15件) ---')
    for b in valid[:15]:
        body_preview = b.get('body', '')
        log(f'  rrid={b["rrid"]:>8}  date={b.get("date",""):<25}  body={body_preview[:60]}')

    if no_body:
        log()
        log(f'  --- body なし/エラー ({len(no_body)}件) ---')
        for b in no_body[:5]:
            log(f'  rrid={b["rrid"]:>8}  body_status={b.get("body","?")[:60]}')

    # ---- res_body クラスが本当に存在するか確認 ----
    res_body_count = html.count('class="res_body"')
    log()
    log(f'  class="res_body" の出現数: {res_body_count}')

    # ---- 非 numeric rrid ブロックの中身 ----
    if invalid:
        log()
        log(f'  --- non-numeric rrid ブロック ({len(invalid)}件) ---')
        for b in invalid[:3]:
            log(f'  chunk head: {b["chunk_head"]}')

    return html

# ========== メイン調査 ==========

log('bakusai rw=1 ページ HTML 構造調査')
log(f'対象スレッド: acode={ACODE} ctgid={CTGID} bid={BID} tid={TID}')

# 1. 通常ページ (最新) Mobile UA
path_normal = f'/thr_res/acode={ACODE}/ctgid={CTGID}/bid={BID}/tid={TID}/tp=1/'
html_normal = analyze_page('【A】通常ページ (最新) - Mobile UA', path_normal, UA_MOBILE)

# 2. rw=1 ページ (最初から) Mobile UA
path_rw1 = f'/thr_res/acode={ACODE}/ctgid={CTGID}/bid={BID}/tid={TID}/tp=1/rw=1/'
html_rw1 = analyze_page('【B】rw=1 ページ (最初から) - Mobile UA', path_rw1, UA_MOBILE)

# 3. rw=1 ページ PC UA (比較)
html_rw1_pc = analyze_page('【C】rw=1 ページ (最初から) - PC UA', path_rw1, UA_PC)

# 4. rw=1 page=2 (次のページ) Mobile UA
path_rw1_p2 = f'/thr_res/acode={ACODE}/ctgid={CTGID}/bid={BID}/tid={TID}/p=2/tp=1/rw=1/'
html_rw1_p2 = analyze_page('【D】rw=1 p=2 - Mobile UA', path_rw1_p2, UA_MOBILE)

# 5. rw=1 tp なし (tp パラメータの影響確認)
path_rw1_notp = f'/thr_res/acode={ACODE}/ctgid={CTGID}/bid={BID}/tid={TID}/rw=1/'
html_rw1_notp = analyze_page('【E】rw=1 tp なし - Mobile UA', path_rw1_notp, UA_MOBILE)

# ========== rw=1 HTML の先頭・末尾を raw dump (デバッグ用) ==========
if html_rw1:
    log()
    log('=' * 80)
    log('【F】rw=1 HTML raw dump (先頭3000文字)')
    log('=' * 80)
    log(html_rw1[:3000])

    log()
    log('=' * 80)
    log('【G】rw=1 HTML raw dump (末尾2000文字)')
    log('=' * 80)
    log(html_rw1[-2000:])

    # <li id="res7"> と <li id="res8"> 周辺の HTML
    log()
    log('=' * 80)
    log('【H】rw=1 の res7 / res8 周辺 HTML')
    log('=' * 80)
    for target in [7, 8, 9]:
        pattern = f'id="res{target}_block"'
        idx = html_rw1.find(pattern)
        if idx != -1:
            log(f'\n--- res{target} (idx={idx}) ---')
            log(html_rw1[max(0, idx-50):idx+500])
        else:
            log(f'\n--- res{target}: NOT FOUND in HTML ---')

# ========== 出力 ==========
with open(OUT_FILE, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))

log()
log(f'出力完了: {OUT_FILE}')
