"""
現在の bakusai.js パーサーの問題点特定と修正案の検証

調査項目:
  A. 日時フォーマット: res_rotundate vs itemprop="commentTime"
  B. 投稿者名: class="name" の正確な範囲
  C. スレッド一覧: thr_status_icon / ttUdTime の構造
  D. 検索結果: /sch_all/ の li 構造
  E. 掲示板一覧: /bbstop/ の board リンク構造

出力: scripts/out/analyze_parsers.txt
"""

import urllib.request
import re
import os
import sys

sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf-8', buffering=1, closefd=False)

OUT_DIR = os.path.join(os.path.dirname(__file__), 'out')
os.makedirs(OUT_DIR, exist_ok=True)

BASE_URL = 'https://bakusai.com'
UA = (
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) '
    'AppleWebKit/605.1.15 (KHTML, like Gecko) '
    'Version/17.0 Mobile/15E148 Safari/604.1'
)

lines = []
def log(s=''):
    print(s)
    lines.append(str(s))

def fetch(path):
    url = BASE_URL + path
    req = urllib.request.Request(url, headers={
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja-JP,ja;q=0.9',
    })
    resp = urllib.request.urlopen(req, timeout=20)
    return resp.read().decode('utf-8', errors='replace')

def strip(s):
    s = re.sub(r'<[^>]+>', '', s)
    s = re.sub(r'&amp;', '&', s)
    s = re.sub(r'&lt;', '<', s)
    s = re.sub(r'&gt;', '>', s)
    s = re.sub(r'&nbsp;', ' ', s)
    s = re.sub(r'&ensp;', ' ', s)
    s = re.sub(r'&quot;', '"', s)
    return re.sub(r'\s+', ' ', s).strip()

def sec(t):
    log()
    log('=' * 70)
    log(t)
    log('=' * 70)

# ============================================================
# A. 日時・名前の正確なパース
# ============================================================

sec('A. 日時・名前の正確なパース')

html_rw1 = fetch('/thr_res/acode=4/ctgid=157/bid=5813/tid=13030722/tp=1/rw=1/')
parts = re.split(r'<li\s+id="res', html_rw1)

log('--- rrid=1 〜 rrid=7 の日時・名前フィールド ---')
for chunk in parts[1:]:
    m = re.match(r'^(\d+)_block', chunk)
    if not m:
        continue
    rrid = int(m.group(1))
    if rrid == 0 or rrid > 10:
        continue

    # A1. 現在の方法: res_rotundate
    rotundate_m = re.search(r'class="res_rotundate"[^>]*>([\s\S]*?)</span>', chunk)
    rotundate_val = strip(rotundate_m.group(1)) if rotundate_m else 'NONE'

    # A2. 新しい方法: itemprop="commentTime"
    commenttime_m = re.search(r'itemprop="commentTime"[^>]*>([\s\S]*?)</span>', chunk)
    commenttime_val = strip(commenttime_m.group(1)) if commenttime_m else 'NONE'

    # A3. title 属性から (#N へ返信)
    title_attr_m = re.search(r'title="#(\d+)へ返信"', chunk)
    rrid_from_title = title_attr_m.group(1) if title_attr_m else 'NONE'

    log(f'rrid={rrid}:')
    log(f'  rotundate (現行): {repr(rotundate_val[:50])}')
    log(f'  commentTime (新): {repr(commenttime_val[:50])}')
    log(f'  rrid (title属性): {rrid_from_title}')

log()
log('--- 日時フィールドの raw HTML ---')
for chunk in parts[1:]:
    m = re.match(r'^(\d+)_block', chunk)
    if not m or int(m.group(1)) not in [1, 3]:
        continue
    rrid = int(m.group(1))

    # commentTime の周辺
    ct_m = re.search(r'(itemprop="commentTime"[^>]*>[\s\S]{0,60})', chunk)
    log(f'rrid={rrid} commentTime raw: {ct_m.group(1) if ct_m else "NONE"}')

    # res_rotundate の周辺
    rot_m = re.search(r'(class="res_rotundate"[\s\S]{0,200})', chunk)
    log(f'rrid={rrid} rotundate raw (200文字): {rot_m.group(1)[:200] if rot_m else "NONE"}')
    log()

log()
log('--- 投稿者名の正確なパース ---')
for chunk in parts[1:]:
    m = re.match(r'^(\d+)_block', chunk)
    if not m or int(m.group(1)) not in [1, 8]:  # 匿名と名前ありの両方
        continue
    rrid = int(m.group(1))

    # 現行方法: class="name" → 最初の </div>
    name_start = chunk.find('class="name"')
    if name_start != -1:
        after = chunk.index('>', name_start) + 1
        name_content = chunk[after:]
        name_end = name_content.find('</div>')
        if name_end != -1:
            raw_name = name_content[:name_end]
            stripped_name = strip(raw_name)
            log(f'rrid={rrid} 現行 name raw (100文字): {repr(raw_name[:100])}')
            log(f'rrid={rrid} 現行 name stripped: {repr(stripped_name[:80])}')

    # 新しい方法: class="name" 内の <span>
    name_area_m = re.search(r'class="name"[^>]*>([\s\S]{0,300})', chunk)
    if name_area_m:
        area = name_area_m.group(1)
        # [ NAME ] パターン
        bracket_m = re.search(r'\[\s*([\s\S]*?)\s*\]', area)
        span_m = re.search(r'<span[^>]*>([\s\S]*?)</span>', area)
        log(f'rrid={rrid} bracket 方法: {repr(bracket_m.group(1)[:50]) if bracket_m else "NONE"}')
        log(f'rrid={rrid} span 方法: {repr(strip(span_m.group(1))[:50]) if span_m else "NONE"}')

    # class="name" 周辺の生 HTML (400文字)
    if name_start != -1:
        log(f'rrid={rrid} name 周辺 HTML (400文字):')
        log(chunk[name_start:name_start+400])
    log()

# ============================================================
# B. スレッド一覧の構造詳細
# ============================================================

sec('B. スレッド一覧の構造詳細')

html_tl = fetch('/thr_tl/acode=4/ctgid=157/bid=5813/')
parts_tl = re.split(r'<li\s+data-tid=', html_tl)

log(f'<li data-tid=> 件数: {len(parts_tl)-1}')
log()

log('--- 先頭5件の全フィールド ---')
for chunk in parts_tl[1:6]:
    tid_m = re.match(r'^["\']?(\d+)["\']?', chunk)
    tid = tid_m.group(1) if tid_m else '?'

    # タイトル: thr_status_icon の title 属性
    title_attr_m = re.search(r'class="thr_status_icon"\s+title="([^"]+)"', chunk)
    title_attr = title_attr_m.group(1) if title_attr_m else 'NONE'

    # タイトル: thr_status_icon 内テキスト
    title_text_m = re.search(r'class="thr_status_icon"[^>]*>([\s\S]*?)</div>', chunk)
    title_text = strip(title_text_m.group(1))[:60] if title_text_m else 'NONE'

    # ttUdTime の全スパン
    udtm_m = re.search(r'class="ttUdTime"[^>]*>([\s\S]*?)</span>', chunk)
    if udtm_m:
        udtm_raw = udtm_m.group(1)
        # 更新日時 (最初のテキストノード)
        update_text = re.sub(r'<[^>]+>', ' ', udtm_raw.split('<span')[0]).strip()
        # spans
        spans = re.findall(r'<span[^>]*>([\s\S]*?)</span>', udtm_raw)
        span_texts = [strip(s)[:30] for s in spans if strip(s)]
    else:
        update_text = 'NONE'
        span_texts = []

    # resCount は span の最後の数値
    all_nums = re.findall(r'<span[^>]*>(\d+)</span>', chunk)

    log(f'tid={tid}')
    log(f'  title (attr): {title_attr}')
    log(f'  title (text): {title_text}')
    log(f'  updatedAt   : {repr(update_text[:40])}')
    log(f'  span texts  : {span_texts}')
    log(f'  all nums    : {all_nums}')
    log()

log('--- 先頭 li の生 HTML (全体) ---')
full_chunk = parts_tl[1]
log('<li data-tid=' + full_chunk)

# ページネーション
log()
log('--- スレッド一覧 ページネーション ---')
# paging_nex_res_and_button
has_paging = 'paging_nex_res_and_button' in html_tl
log(f'paging_nex_res_and_button: {has_paging}')
paging_m = re.search(r'class="paging_nex_res_and_button"[\s\S]{0,400}?href="([^"]+)"', html_tl)
if paging_m:
    log(f'次ページ URL: {paging_m.group(1)}')

# page 2 を取得して件数確認
html_tl2 = fetch('/thr_tl/acode=4/ctgid=157/bid=5813/p=2/')
parts_tl2 = re.split(r'<li\s+data-tid=', html_tl2)
log(f'page=1: {len(parts_tl)-1}件, page=2: {len(parts_tl2)-1}件')
paging2_m = re.search(r'class="paging_nex_res_and_button"[\s\S]{0,400}?href="([^"]+)"', html_tl2)
log(f'page=2 次ページ: {paging2_m.group(1) if paging2_m else "なし (最終ページ)"}')

# ============================================================
# C. 検索結果の HTML 構造
# ============================================================

sec('C. 検索結果 /sch_all/ の HTML 構造')

html_sch = fetch('/sch_all/acode=4/word=%E5%90%8C%E7%AA%93%E4%BC%9A/')
log(f'HTML size: {len(html_sch):,}')

# li の全種類
li_ids = re.findall(r'<li[^>]*id="([^"]*)"', html_sch)
li_classes = re.findall(r'<li[^>]*class="([^"]*)"', html_sch)
from collections import Counter
log(f'li id: {dict(Counter(li_ids).most_common(10))}')
log(f'li class: {dict(Counter(li_classes).most_common(10))}')

# thr_res リンクと周辺構造
log()
log('--- /thr_res/ リンクと周辺構造 ---')
thr_links = list(re.finditer(r'href="(/thr_res/[^"]+)"', html_sch))
log(f'/thr_res/ リンク数: {len(thr_links)}')
for link_m in thr_links[:5]:
    idx = link_m.start()
    context = html_sch[max(0, idx-300):idx+200]
    log(f'\nリンク: {link_m.group(1)}')
    log(f'周辺 (前300/後200): {context}')

# 検索結果独自の li (data-tid なし)
log()
log('--- 検索結果の li 構造 ---')
# li の全 raw HTML (class付き)
sch_li_items = re.findall(r'<li[^>]*class="[^"]*(?:list|result|thread|item)[^"]*"[^>]*>([\s\S]*?)</li>', html_sch)
log(f'result系 li 数: {len(sch_li_items)}')
for item in sch_li_items[:3]:
    log(f'  {item[:300]}')
    log()

# 先頭 500 件の li 付近の HTML
log()
log('--- HTML 全体の先頭 3000文字 ---')
log(html_sch[:3000])

log()
log('--- HTML の検索結果部分 (res_block を除く 一覧リスト) ---')
# main content エリアを探す
main_m = re.search(r'(<main|<div[^>]*id="main"|<div[^>]*class="[^"]*main[^"]*")([\s\S]{0,5000})', html_sch)
if main_m:
    log(main_m.group(0)[:3000])

# ============================================================
# D. 掲示板一覧 (/bbstop/) の構造
# ============================================================

sec('D. 掲示板一覧 /bbstop/ の構造詳細')

html_bbs = fetch('/bbstop/acode=4/ctgid=157/')
log(f'HTML size: {len(html_bbs):,}')

# メインコンテンツ内の board リンク
# acode/ctgid/bid を持つリンク
board_links = re.findall(
    r'href="(/thr_tl/acode=(\d+)/ctgid=(\d+)/bid=(\d+)/[^"]*)"[^>]*>([\s\S]*?)</a>',
    html_bbs
)
log(f'acode/ctgid/bid 付きリンク数: {len(board_links)}')
for href, acode, ctgid, bid, text in board_links[:10]:
    clean = strip(text)[:50]
    log(f'  acode={acode} ctgid={ctgid} bid={bid} name={clean}')
    log(f'    href={href}')

# li の board アイテム構造
log()
log('--- board list エリアの HTML (2000文字) ---')
# 最初の thr_tl リンク周辺を探す
first_board_m = re.search(r'/thr_tl/acode=\d+/ctgid=\d+/bid=\d+/', html_bbs)
if first_board_m:
    idx = first_board_m.start()
    log(html_bbs[max(0, idx-200):idx+1000])

# countyWrap クラスの li
county_items = re.findall(r'<li[^>]*class="[^"]*countyWrap[^"]*"[^>]*>([\s\S]*?)</li>', html_bbs)
log(f'\ncountyWrap li 数: {len(county_items)}')
for item in county_items[:3]:
    log(f'  {item[:300]}')

# ============================================================
# 出力
# ============================================================
OUT_FILE = os.path.join(OUT_DIR, 'analyze_parsers.txt')
with open(OUT_FILE, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))

log()
log(f'出力完了: {OUT_FILE}')
