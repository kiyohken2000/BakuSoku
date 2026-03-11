"""
bakusai モバイル HTML の全体構造調査（実装用）

調査項目:
  A. レスブロック完全構造 (rrid/日時/名前/本文/アンカー/Good-Bad の DOM 位置)
  B. 重複 rrid の原因 (preview 要素)
  C. スレッド一覧のページサイズ・li構造・更新日時フォーマット
  D. エリアトップ・掲示板一覧の構造
  E. 検索結果の構造
  F. 投稿フォームの hidden フィールド

出力: scripts/out/analyze_structures.txt
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
    try:
        resp = urllib.request.urlopen(req, timeout=20)
        return resp.read().decode('utf-8', errors='replace'), resp.url
    except Exception as e:
        return None, str(e)

def strip(s):
    s = re.sub(r'<[^>]+>', '', s)
    s = re.sub(r'&amp;', '&', s)
    s = re.sub(r'&lt;', '<', s)
    s = re.sub(r'&gt;', '>', s)
    s = re.sub(r'&nbsp;', ' ', s)
    s = re.sub(r'&quot;', '"', s)
    return re.sub(r'\s+', ' ', s).strip()

def section(title):
    log()
    log('=' * 72)
    log(title)
    log('=' * 72)

# ============================================================
# A. レスブロック完全構造
# ============================================================

section('A. レスブロック完全 HTML 構造')
log('  スレッド: 加茂農林高等学校③ rw=1 page=1 (res #1-#7)')

THREAD = '/thr_res/acode=4/ctgid=157/bid=5813/tid=13030722/tp=1/rw=1/'
html_thread, _ = fetch(THREAD)

if html_thread:
    parts = re.split(r'<li\s+id="res', html_thread)
    log(f'  <li id="res"> 分割数: {len(parts)-1}')

    # 各チャンクの rrid を表示
    rrid_map = {}
    for chunk in parts[1:]:
        m = re.match(r'^(\d+)_block', chunk)
        if m:
            rrid_map[int(m.group(1))] = chunk

    log()
    log('  --- rrid=1 の生 HTML (先頭700文字) ---')
    if 1 in rrid_map:
        log('<li id="res' + rrid_map[1][:700] + '...')

    log()
    log('  --- rrid=3 の生 HTML (>>NNN アンカーリンク付き) ---')
    if 3 in rrid_map:
        log('<li id="res' + rrid_map[3][:700] + '...')

    log()
    log('  --- rrid 重複原因: page の先頭に現れる最大 rrid の構造 ---')
    # 最初のチャンク (preview の rrid)
    first_chunk = parts[1]
    first_m = re.match(r'^(\d+)_block', first_chunk)
    if first_m:
        log(f'  先頭チャンク rrid = {first_m.group(1)}')
        log(f'  先頭チャンク 先頭500文字:')
        log('<li id="res' + first_chunk[:500])

    # 全 rrid 一覧
    all_rrids = []
    for chunk in parts[1:]:
        m = re.match(r'^(\d+)_block', chunk)
        all_rrids.append(int(m.group(1)) if m else None)
    log(f'  全 rrid (重複含む): {all_rrids}')

    # res_rotundate (日時) のパターン調査
    log()
    log('  --- 日時フォーマット調査 ---')
    dates = re.findall(r'class="res_rotundate"[^>]*>([\s\S]*?)</span>', html_thread)
    for d in dates[:5]:
        log(f'  raw: {repr(d[:100])}')
        log(f'  stripped: {strip(d)[:80]}')

    # name (投稿者名) のパターン
    log()
    log('  --- 投稿者名フォーマット調査 ---')
    names = re.findall(r'class="name"[^>]*>([\s\S]*?)</div>', html_thread)
    for n in names[:5]:
        log(f'  raw: {repr(n[:100])}')
        log(f'  stripped: {strip(n)[:60]}')

    # res_body の完全な HTML
    log()
    log('  --- res_body クラスの完全 HTML (rrid=3 の >>NNN リンク含む) ---')
    bodies = re.findall(r'class="res_body"[^>]*>([\s\S]*?)</div>', html_thread)
    for i, b in enumerate(bodies[:5]):
        log(f'  body[{i+1}] raw: {repr(b[:200])}')

    # >>NNN アンカーリンクのフォーマット
    log()
    log('  --- >>NNN アンカーリンクのパターン ---')
    anchors = re.findall(r'<a[^>]*href="[^"]*thr_res_show[^"]*"[^>]*>([\s\S]*?)</a>', html_thread)
    anchor_hrefs = re.findall(r'href="([^"]*thr_res_show[^"]*)"', html_thread)
    log(f'  thr_res_show リンク数: {len(anchor_hrefs)}')
    for h in anchor_hrefs[:5]:
        log(f'  href: {h}')
    log(f'  リンクテキスト: {anchors[:5]}')

    # Good/Bad の DOM 構造
    log()
    log('  --- Good/Bad 構造 ---')
    # Good/Bad のパターン
    good_patterns = re.findall(r'(Good.{0,300})', html_thread, re.DOTALL)
    if good_patterns:
        log(f'  Good パターン例: {repr(good_patterns[0][:200])}')
    # data-rrid や data-bid 等の data 属性
    data_attrs = re.findall(r'<[^>]*\bdata-(?:rrid|tid|bid|good|bad)[^>]*>', html_thread)
    log(f'  data-rrid/tid/bid/good/bad 属性付き要素: {len(data_attrs)}')
    for a in data_attrs[:5]:
        log(f'  {a[:200]}')

    # スレッドID・板ID の JS 変数
    log()
    log('  --- JS 変数 (thr_thread_tid, thr_bbs_bid) ---')
    js_vars = re.findall(r'var\s+(thr_\w+)\s*=\s*[\'"]([^\'"]+)[\'"]', html_thread)
    for name, val in js_vars:
        log(f'  {name} = {val}')

# ============================================================
# B. 通常ページ (非rw=1) での preview と全体構造比較
# ============================================================

section('B. 通常ページ (最新) の preview 構造')
THREAD_NORMAL = '/thr_res/acode=4/ctgid=157/bid=5813/tid=13030722/tp=1/'
html_normal, _ = fetch(THREAD_NORMAL)

if html_normal:
    parts_n = re.split(r'<li\s+id="res', html_normal)
    all_rrids_n = []
    for chunk in parts_n[1:]:
        m = re.match(r'^(\d+)_block', chunk)
        all_rrids_n.append(int(m.group(1)) if m else None)
    log(f'  <li id="res"> 数: {len(parts_n)-1}')
    log(f'  全 rrid: {all_rrids_n}')

    # preview の class 確認
    log()
    log('  --- 先頭チャンクの class 確認 ---')
    first_n = parts_n[1]
    class_m = re.match(r'^\d+_block"\s*\n?\s*class="([^"]*)"', first_n)
    log(f'  先頭 rrid class: {class_m.group(1) if class_m else "不明"}')
    log(f'  先頭チャンク 先頭200文字: {first_n[:200]}')

    # 重複 rrid の出現位置 (最初の出現と2番目の出現の class 比較)
    seen = {}
    for i, chunk in enumerate(parts_n[1:]):
        m = re.match(r'^(\d+)_block', chunk)
        if m:
            rrid = int(m.group(1))
            if rrid not in seen:
                seen[rrid] = []
            seen[rrid].append(i)

    dups = {k: v for k, v in seen.items() if len(v) > 1}
    log()
    log(f'  重複 rrid: {list(dups.keys())}')
    for rrid, positions in list(dups.items())[:3]:
        for pos in positions:
            chunk = parts_n[pos + 1]
            class_m = re.match(r'^\d+_block"\s*\n?\s*class="([^"]*)"', chunk)
            cls = class_m.group(1) if class_m else '不明'
            log(f'  rrid={rrid} pos={pos} class="{cls}"')
            log(f'    先頭100文字: {chunk[:100]}')

# ============================================================
# C. スレッド一覧の構造
# ============================================================

section('C. スレッド一覧 HTML 構造')

# 複数の掲示板でテスト
THREAD_LISTS = [
    ('/thr_tl/acode=4/ctgid=157/bid=5813/', '新潟同窓会'),
    ('/thr_tl/acode=3/ctgid=116/bid=247/', '東京 お笑い芸人'),
    ('/thr_tl/acode=1/ctgid=104/bid=330/', '北海道 雑談'),
]

for path, label in THREAD_LISTS:
    log()
    log(f'  ---- {label} {BASE_URL}{path} ----')
    html_tl, final_url = fetch(path)
    if not html_tl:
        log('  ERROR')
        continue

    log(f'  HTML size: {len(html_tl):,}')

    # <li data-tid=> の分割
    parts_tl = re.split(r'<li\s+data-tid=', html_tl)
    log(f'  <li data-tid=> 数: {len(parts_tl)-1}')

    # 先頭3件の構造
    tids = []
    for chunk in parts_tl[1:4]:
        tid_m = re.match(r'^["\']?(\d+)["\']?', chunk)
        tid = tid_m.group(1) if tid_m else '?'
        tids.append(tid)

        # title
        title_m = re.search(r'class="thr_title"[^>]*>([\s\S]*?)</[^>]+>', chunk)
        title = strip(title_m.group(1))[:60] if title_m else '?'

        # resCount
        res_m = re.search(r'class="res_cnt"[^>]*>([\s\S]*?)</[^>]+>', chunk)
        res_cnt = strip(res_m.group(1))[:30] if res_m else '?'

        # 更新日時
        date_m = re.search(r'class="[^"]*(?:date|time|updated)[^"]*"[^>]*>([\s\S]*?)</[^>]+>', chunk)
        date = strip(date_m.group(1))[:40] if date_m else '?'

        # href
        href_m = re.search(r'href="(/thr_res/[^"]+)"', chunk)
        href = href_m.group(1)[:80] if href_m else '?'

        log(f'  tid={tid} title={title} resCount={res_cnt} date={date}')
        log(f'    href={href}')

    # 先頭 <li data-tid=> の生 HTML (全フィールド確認)
    if len(parts_tl) > 1:
        log()
        log(f'  --- 先頭 li data-tid の生 HTML (500文字) ---')
        log('<li data-tid=' + parts_tl[1][:500])

    # ページネーション
    tl_pages_normal = re.findall(r'href="(/thr_tl/[^"]*p=(\d+)[^"]*)"', html_tl)
    tl_page_nums = sorted(set(int(n) for _, n in tl_pages_normal))
    log(f'  thr_tl ページリンク番号: {tl_page_nums}')

    # paging_nex_res_and_button の有無
    has_paging = 'paging_nex_res_and_button' in html_tl
    log(f'  paging_nex_res_and_button: {"あり" if has_paging else "なし"}')

    # 次ページリンクパターン
    next_tl = re.search(r'href="(/thr_tl/[^"]*p=\d+[^"]*)"', html_tl)
    if next_tl:
        log(f'  次ページ候補: {next_tl.group(1)}')

    # 全 class の統計
    li_classes = re.findall(r'<li\s+data-tid[^>]*class="([^"]*)"', html_tl)
    from collections import Counter
    log(f'  li クラス分布: {dict(Counter(li_classes).most_common(5))}')

# スレッド一覧の updatedAt フォーマット詳細
section('C2. スレッド一覧 updatedAt フォーマット詳細')
html_tl2, _ = fetch('/thr_tl/acode=4/ctgid=157/bid=5813/')
if html_tl2:
    parts_tl2 = re.split(r'<li\s+data-tid=', html_tl2)
    log(f'  先頭5件の日時関連フィールド:')
    for chunk in parts_tl2[1:6]:
        tid_m = re.match(r'^["\']?(\d+)["\']?', chunk)
        tid = tid_m.group(1) if tid_m else '?'
        # 全 span/div のテキスト
        all_spans = re.findall(r'<(?:span|div|time)[^>]*>([\s\S]*?)</(?:span|div|time)>', chunk[:600])
        texts = [strip(s)[:40] for s in all_spans if strip(s)]
        log(f'  tid={tid}: {texts}')

    log()
    log(f'  --- 先頭 li の生 HTML (800文字) ---')
    log('<li data-tid=' + parts_tl2[1][:800])

# ============================================================
# D. エリアトップ・掲示板一覧
# ============================================================

section('D. エリアトップ・掲示板一覧')

AREA_PATHS = [
    ('/areatop/acode=4/', 'エリアトップ 甲信越'),
    ('/bbstop/acode=4/ctgid=157/', '板一覧 新潟同窓会'),
    ('/bbstop/acode=3/ctgid=116/', '板一覧 東京芸能'),
]

for path, label in AREA_PATHS:
    log()
    log(f'  ---- {label} ----')
    html_a, _ = fetch(path)
    if not html_a:
        log('  ERROR')
        continue

    log(f'  HTML size: {len(html_a):,}')

    # 板リンク (<a href="/thr_tl/...">)
    board_links = re.findall(r'<a[^>]*href="(/thr_tl/[^"]+)"[^>]*>([\s\S]*?)</a>', html_a)
    log(f'  /thr_tl/ リンク数: {len(board_links)}')
    for href, text in board_links[:8]:
        clean = strip(text)[:50]
        log(f'  {href} → {clean}')

    # カテゴリ構造
    log()
    log(f'  --- カテゴリヘッダー ---')
    cat_headers = re.findall(r'<(?:h[1-6]|div)[^>]*class="[^"]*(?:cat|category|ctg)[^"]*"[^>]*>([\s\S]*?)</(?:h[1-6]|div)>', html_a)
    for h in cat_headers[:5]:
        log(f'  {strip(h)[:60]}')

    # li の class パターン
    li_all = re.findall(r'<li[^>]*class="([^"]*)"', html_a)
    from collections import Counter
    log(f'  li クラス分布: {dict(Counter(li_all).most_common(8))}')

    # 先頭の板リンク周辺 HTML
    log()
    log(f'  --- 先頭 /thr_tl/ リンク周辺 HTML ---')
    first_tl_idx = html_a.find('/thr_tl/')
    if first_tl_idx > 0:
        log(html_a[max(0, first_tl_idx - 200):first_tl_idx + 300])

# ============================================================
# E. 検索結果
# ============================================================

section('E. 検索結果 HTML 構造')

SEARCH_PATHS = [
    ('/sch_all/acode=4/word=%E5%90%8C%E7%AA%93%E4%BC%9A/', '同窓会'),
    ('/sch_all/acode=3/word=%E6%9D%BE%E6%9C%AC/', '松本 (東京)'),
]

for path, label in SEARCH_PATHS:
    log()
    log(f'  ---- 検索: {label} ----')
    html_s, final_url = fetch(path)
    if not html_s:
        log('  ERROR')
        continue

    log(f'  HTML size: {len(html_s):,}')
    log(f'  Final URL: {final_url}')

    # スレッドリンク
    thread_links = re.findall(r'href="(/thr_res/[^"]+)"', html_s)
    log(f'  /thr_res/ リンク数: {len(thread_links)}')

    # <li data-tid=> があるか
    tl_parts = re.split(r'<li\s+data-tid=', html_s)
    log(f'  <li data-tid=> 数: {len(tl_parts)-1}')
    for chunk in tl_parts[1:4]:
        tid_m = re.match(r'^["\']?(\d+)["\']?', chunk)
        title_m = re.search(r'class="thr_title"[^>]*>([\s\S]*?)</[^>]+>', chunk)
        tid = tid_m.group(1) if tid_m else '?'
        title = strip(title_m.group(1))[:60] if title_m else '?'
        log(f'  tid={tid}: {title}')

    # 先頭 li 生 HTML
    if len(tl_parts) > 1:
        log()
        log('  --- 先頭 li の生 HTML ---')
        log('<li data-tid=' + tl_parts[1][:500])

    # ページネーション
    sch_pages = re.findall(r'href="(/sch_all/[^"]*p=(\d+)[^"]*)"', html_s)
    log(f'  ページリンク: {sorted(set(int(n) for _, n in sch_pages))}')

# ============================================================
# F. 投稿フォーム hidden フィールド詳細
# ============================================================

section('F. 投稿フォーム (directForm) の詳細')

# rw=1 ページとの比較
FORM_PAGES = [
    ('/thr_res/acode=4/ctgid=157/bid=5813/tid=13030722/tp=1/', '通常ページ'),
    ('/thr_res/acode=4/ctgid=157/bid=5813/tid=13030722/tp=1/rw=1/', 'rw=1 ページ'),
    ('/thr_res/acode=4/ctgid=157/bid=5813/tid=13030722/p=2/tp=1/rw=1/', 'rw=1 page=2'),
]

for path, label in FORM_PAGES:
    log()
    log(f'  ---- {label} ----')
    html_f, _ = fetch(path)
    if not html_f:
        log('  ERROR')
        continue

    form_start = html_f.find('name="directForm"')
    if form_start == -1:
        log('  directForm: NOT FOUND')
        continue

    form_tag = html_f.rfind('<form', 0, form_start)
    form_end = html_f.find('</form>', form_start)
    form_html = html_f[form_tag:form_end + 7] if form_tag != -1 else ''

    # action
    action_m = re.search(r'action="([^"]+)"', form_html)
    log(f'  action: {action_m.group(1) if action_m else "?"}')

    # hidden inputs
    inputs = re.findall(r'<input[^>]+>', form_html)
    for inp in inputs:
        name_m = re.search(r'name="([^"]+)"', inp)
        val_m = re.search(r'value="([^"]*)"', inp)
        type_m = re.search(r'type="([^"]*)"', inp)
        if name_m:
            log(f'  name={name_m.group(1):<20} type={type_m.group(1) if type_m else "?":<10} value={val_m.group(1)[:40] if val_m else "?"}')

    # textarea
    ta_m = re.search(r'<textarea[^>]*name="([^"]*)"', form_html)
    log(f'  textarea name: {ta_m.group(1) if ta_m else "none"}')

# ============================================================
# G. スレッド詳細 - 複数スレッドのレスブロック構造バリエーション
# ============================================================

section('G. 複数スレッドでのレスブロック構造バリエーション')

TEST_THREADS = [
    ('/thr_res/acode=3/ctgid=116/bid=247/tid=12412150/tp=1/', '東京 芸能 通常'),
    ('/thr_res/acode=1/ctgid=104/bid=330/tp=1/', '北海道 雑談 最新'),
]

for path, label in TEST_THREADS:
    log()
    log(f'  ---- {label} ----')
    html_g, _ = fetch(path)
    if not html_g:
        log('  ERROR')
        continue

    log(f'  HTML size: {len(html_g):,}')

    parts_g = re.split(r'<li\s+id="res', html_g)
    rrids_g = []
    for chunk in parts_g[1:]:
        m = re.match(r'^(\d+)_block', chunk)
        rrids_g.append(int(m.group(1)) if m else None)
    log(f'  <li id="res"> 数: {len(parts_g)-1}, rrids: {rrids_g}')

    # 先頭有効レスのフィールド確認
    for chunk in parts_g[1:]:
        m = re.match(r'^(\d+)_block', chunk)
        if not m:
            continue
        rrid = int(m.group(1))
        if rrid == 0:
            continue

        # date
        dm = re.search(r'class="res_rotundate"[^>]*>([\s\S]*?)</span>', chunk)
        date = strip(dm.group(1))[:30] if dm else 'NO DATE'
        # name
        nm = re.search(r'class="name"[^>]*>([\s\S]*?)</div>', chunk)
        name = strip(nm.group(1))[:30] if nm else 'NO NAME'
        # body presence
        has_body = 'class="res_body"' in chunk
        log(f'  rrid={rrid} date={date} name={name} body={has_body}')
        break

# ============================================================
# 出力
# ============================================================
OUT_FILE = os.path.join(OUT_DIR, 'analyze_structures.txt')
with open(OUT_FILE, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))

log()
log(f'出力完了: {OUT_FILE}')
