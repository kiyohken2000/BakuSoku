"""
未調査項目の全網羅調査

1. /thr_res_show/ アンカーポップアップのレスポンス HTML 構造
2. updatedAt の &ensp; エンコード問題と実際の表示フォーマット
3. 削除済みレスの HTML 構造
4. 画像付きレスの res_body 形式
5. 複数アンカー参照 (>>1 >>2 >>3) の body 形式
6. スレッド一覧の「固定スレ」アイコン (row_fixed_icon) の判定方法

出力: scripts/out/analyze_remaining.txt
"""

import urllib.request
import urllib.parse
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

def fetch(path, full_url=False):
    url = path if full_url else (BASE_URL + path)
    req = urllib.request.Request(url, headers={
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja-JP,ja;q=0.9',
    })
    try:
        resp = urllib.request.urlopen(req, timeout=20)
        return resp.read().decode('utf-8', errors='replace'), resp.geturl()
    except Exception as e:
        return None, str(e)

def strip(s):
    s = re.sub(r'<[^>]+>', '', s)
    for ent, rep in [('&amp;','&'),('&lt;','<'),('&gt;','>'),
                     ('&nbsp;',' '),('&ensp;',' '),('&quot;','"')]:
        s = s.replace(ent, rep)
    return re.sub(r'\s+', ' ', s).strip()

def sec(t):
    log()
    log('=' * 72)
    log(t)
    log('=' * 72)

# ============================================================
# 1. /thr_res_show/ アンカーポップアップ
# ============================================================

sec('1. /thr_res_show/ アンカーポップアップのレスポンス構造')

# テストスレの rw=1 ページから thr_res_show リンクを収集
THREAD_RW1 = '/thr_res/acode=4/ctgid=157/bid=5813/tid=13030722/tp=1/rw=1/'
html_thread, _ = fetch(THREAD_RW1)

show_urls = []
if html_thread:
    show_urls = re.findall(r'href="(/thr_res_show/[^"]+)"', html_thread)
    log(f'thr_res_show リンク数: {len(show_urls)}')
    for u in show_urls[:5]:
        log(f'  {u}')

# 各 thr_res_show URL を実際にフェッチ
log()
log('--- thr_res_show URL への実際のリクエスト ---')
for url in show_urls[:4]:
    log()
    log(f'URL: {url}')
    html_show, final_url = fetch(url)
    if not html_show:
        log(f'  ERROR: {final_url}')
        continue

    log(f'  HTML size: {len(html_show):,}  Final URL: {final_url}')

    # レスポンスタイプ: JSON? HTML? リダイレクト?
    if html_show.strip().startswith('{') or html_show.strip().startswith('['):
        log(f'  TYPE: JSON')
        log(f'  内容: {html_show[:500]}')
    else:
        log(f'  TYPE: HTML')
        # res_block が含まれるか
        parts = re.split(r'<li\s+id="res', html_show)
        log(f'  <li id="res"> 数: {len(parts)-1}')
        for chunk in parts[1:]:
            m = re.match(r'^(\d+)_block', chunk)
            if not m:
                continue
            rrid = int(m.group(1))
            if rrid == 0:
                continue
            ct_m = re.search(r'itemprop="commentTime"[^>]*>([\s\S]*?)</span>', chunk)
            body_start = chunk.find('class="res_body"')
            body = ''
            if body_start != -1:
                after = chunk.index('>', body_start) + 1
                end = chunk.find('</div>', after)
                if end != -1:
                    body = strip(chunk[after:end])[:80]
            log(f'  rrid={rrid} date={ct_m.group(1).strip() if ct_m else "N/A"} body={body}')

        # 先頭 800 文字
        log(f'  先頭 HTML (800文字):')
        log(html_show[:800])

# rrid=00 (不存在) の場合
log()
log('--- rrid=00 (存在しないレス) の挙動 ---')
if show_urls:
    bad_url = re.sub(r'rrid=\d+', 'rrid=99999', show_urls[0])
    html_bad, final = fetch(bad_url)
    if html_bad:
        log(f'URL: {bad_url}')
        log(f'size: {len(html_bad):,}  final: {final}')
        log(f'先頭 300文字: {html_bad[:300]}')

# ============================================================
# 2. updatedAt のエンコード問題
# ============================================================

sec('2. updatedAt の &ensp; エンコードと全フォーマットパターン')

# 複数の板のスレ一覧を取得して updatedAt のパターンを収集
TL_PATHS = [
    '/thr_tl/acode=4/ctgid=157/bid=5813/',
    '/thr_tl/acode=3/ctgid=116/bid=247/',
    '/thr_tl/acode=1/ctgid=104/bid=330/',
    '/thr_tl/acode=7/ctgid=116/bid=247/',
]

all_updatedAt_raw = []
for path in TL_PATHS:
    html_tl, _ = fetch(path)
    if not html_tl:
        continue
    parts = re.split(r'<li\s+data-tid=', html_tl)
    for chunk in parts[1:]:
        ud_idx = chunk.find('class="ttUdTime"')
        if ud_idx == -1:
            continue
        ud_start = chunk.index('>', ud_idx) + 1
        ud_block = chunk[ud_start:ud_start + 300]
        first_span = ud_block.find('<span')
        if first_span != -1:
            raw_time = ud_block[:first_span].strip()
            all_updatedAt_raw.append(raw_time)

log(f'updatedAt サンプル数: {len(all_updatedAt_raw)}')
log()
log('--- raw テキスト (HTML エンティティ含む) ---')
seen_formats = set()
for raw in all_updatedAt_raw:
    fmt = re.sub(r'\d', 'N', raw).strip()
    if fmt not in seen_formats:
        seen_formats.add(fmt)
        log(f'  raw  : {repr(raw)}')
        log(f'  strip: {repr(strip(raw))}')
        log()

log('--- 全パターン集計 ---')
from collections import Counter
fmt_counter = Counter()
for raw in all_updatedAt_raw:
    fmt = re.sub(r'\d', 'N', raw).strip()
    fmt_counter[fmt] += 1
for fmt, cnt in fmt_counter.most_common():
    log(f'  {cnt}件: {repr(fmt)}')

# ============================================================
# 3. 削除済みレスの HTML 構造
# ============================================================

sec('3. 削除済みレスの HTML 構造')

# レス数が多いスレ(削除が多そうな活発なスレ)で調査
# 通常モードで rrid にギャップがあるものを探す
html_normal, _ = fetch('/thr_res/acode=4/ctgid=157/bid=5813/tid=13030722/tp=1/')
if html_normal:
    parts_n = re.split(r'<li\s+id="res', html_normal)
    seen_rrids = set()
    for chunk in parts_n[1:]:
        m = re.match(r'^(\d+)_block', chunk)
        if m:
            seen_rrids.add(int(m.group(1)))
    log(f'通常ページ rrid (重複含む): {sorted(seen_rrids)}')

    # rrid=0 のブロック（プレースホルダー）の構造
    for chunk in parts_n[1:]:
        m = re.match(r'^0_block', chunk)
        if m:
            log(f'rrid=0 ブロック 先頭200文字:')
            log('<li id="res' + chunk[:200])
            break

    # commentTime なしのブロック (= quote or placeholder)
    log()
    log('--- commentTime なしのブロック (先頭3件) ---')
    no_ct_count = 0
    for chunk in parts_n[1:]:
        m = re.match(r'^(\d+)_block', chunk)
        if not m:
            continue
        rrid = int(m.group(1))
        has_ct = bool(re.search(r'itemprop="commentTime"', chunk))
        if not has_ct and rrid != 0 and no_ct_count < 3:
            no_ct_count += 1
            log(f'rrid={rrid} has_ct=False 先頭150文字:')
            log('<li id="res' + chunk[:150])
            log()

# 別のスレで削除済みレスを探す（直接 rrid 指定）
# 通常モードで大きなスレのギャップを確認
log()
log('--- 削除レス候補スレッドで調査 ---')
# 東京 芸能のスレで deletedレスがある可能性
html_e, _ = fetch('/thr_res/acode=3/ctgid=116/bid=247/tid=12412150/tp=1/')
if html_e:
    parts_e = re.split(r'<li\s+id="res', html_e)
    rrids_e = []
    for chunk in parts_e[1:]:
        m = re.match(r'^(\d+)_block', chunk)
        if m:
            rrid = int(m.group(1))
            has_ct = bool(re.search(r'itemprop="commentTime"', chunk))
            has_body = 'class="res_body"' in chunk
            rrids_e.append((rrid, has_ct, has_body))
    log(f'rrid 一覧 (rrid, has_ct, has_body): {rrids_e}')

# ============================================================
# 4. 画像付きレスの res_body 形式
# ============================================================

sec('4. 画像付きレスの res_body HTML 形式')

# 画像付きスレを探す: 検索で「画像」「写真」を含むスレ
IMAGE_SEARCH = '/sch_all/acode=4/word=%E5%86%99%E7%9C%9F/'
html_search, _ = fetch(IMAGE_SEARCH)
img_threads = []
if html_search:
    # h2 id="tid-N" からスレ取得
    for m in re.finditer(r'href="(/thr_res/acode=(\d+)/ctgid=(\d+)/bid=(\d+)/tid=(\d+)/[^"]*)"', html_search):
        img_threads.append(m.group(1))
        if len(img_threads) >= 3:
            break

log(f'画像スレ候補: {img_threads}')

for tpath in img_threads[:2]:
    log()
    log(f'スレ: {tpath}')
    html_img, _ = fetch(tpath)
    if not html_img:
        continue

    parts_img = re.split(r'<li\s+id="res', html_img)
    found_img = False
    for chunk in parts_img[1:]:
        m = re.match(r'^(\d+)_block', chunk)
        if not m:
            continue
        rrid = int(m.group(1))
        if rrid == 0:
            continue
        if not re.search(r'itemprop="commentTime"', chunk):
            continue

        body_start = chunk.find('class="res_body"')
        if body_start == -1:
            continue
        after = chunk.index('>', body_start) + 1
        end = chunk.find('</div>', after)
        if end == -1:
            continue
        body_raw = chunk[after:end]

        if '<img' in body_raw:
            found_img = True
            log(f'  rrid={rrid} 画像あり body_raw (300文字):')
            log(f'  {body_raw[:300]}')
            log(f'  img src: {re.findall(r"src=\"([^\"]+)\"", body_raw)[:3]}')
            break

    if not found_img:
        log(f'  画像付きレスなし')

# 画像検索を別の方法で試す
log()
log('--- <img> タグを含む res_body をスレ一覧から探す ---')
# 北海道 雑談板の複数スレをスキャン
html_scan_list, _ = fetch('/thr_tl/acode=1/ctgid=104/bid=330/')
if html_scan_list:
    scan_parts = re.split(r'<li\s+data-tid=', html_scan_list)
    for chunk in scan_parts[1:6]:
        tid_m = re.match(r'^["\']?(\d+)["\']?', chunk)
        if not tid_m:
            continue
        tid = tid_m.group(1)
        href_m = re.search(r'href="(/thr_res/[^"]+)"', chunk)
        if not href_m:
            continue
        html_t, _ = fetch(href_m.group(1))
        if not html_t:
            continue
        if '<img' in html_t and 'res_body' in html_t:
            # 画像を含む res_body を見つけた
            body_pattern = re.search(r'class="res_body"[^>]*>([\s\S]*?)</div>', html_t)
            while body_pattern:
                content = body_pattern.group(1)
                if '<img' in content:
                    log(f'  tid={tid} 画像付き body (300文字): {content[:300]}')
                    img_srcs = re.findall(r'src="([^"]+)"', content)
                    log(f'  img src: {img_srcs[:3]}')
                    break
                body_pattern = re.search(r'class="res_body"[^>]*>([\s\S]*?)</div>',
                                         html_t[body_pattern.end():])
            break

# ============================================================
# 5. 複数アンカー参照の body 形式
# ============================================================

sec('5. 複数アンカー参照 (>>1 >>2 >>3) の body 形式')

# rw=1 モードで複数アンカーを含むレスを探す
for page in range(1, 5):
    path = (f'/thr_res/acode=4/ctgid=157/bid=5813/tid=13030722/p={page}/tp=1/rw=1/'
            if page > 1 else
            '/thr_res/acode=4/ctgid=157/bid=5813/tid=13030722/tp=1/rw=1/')
    html_p, _ = fetch(path)
    if not html_p:
        break
    parts_p = re.split(r'<li\s+id="res', html_p)
    found_multi = False
    for chunk in parts_p[1:]:
        m = re.match(r'^(\d+)_block', chunk)
        if not m:
            continue
        rrid = int(m.group(1))
        if rrid == 0:
            continue
        if not re.search(r'itemprop="commentTime"', chunk):
            continue
        body_start = chunk.find('class="res_body"')
        if body_start == -1:
            continue
        after = chunk.index('>', body_start) + 1
        end = chunk.find('</div>', after)
        if end == -1:
            continue
        body_raw = chunk[after:end]
        thr_show_count = body_raw.count('thr_res_show')
        if thr_show_count >= 2:
            log(f'page={page} rrid={rrid}: アンカー {thr_show_count}個')
            log(f'  body_raw (400文字): {body_raw[:400]}')
            log(f'  anchors: {re.findall(r"href=\"(/thr_res_show/[^\"]+)\"", body_raw)}')
            found_multi = True
            break
    if found_multi:
        break
else:
    log('複数アンカー付きレスは発見できず（テストスレに存在しない可能性）')

# >>NNN アンカーの HTML パターンを詳しく調査
log()
log('--- >>NNN アンカーの全 HTML パターン ---')
all_anchor_patterns = set()
html_anchor, _ = fetch('/thr_res/acode=4/ctgid=157/bid=5813/tid=13030722/tp=1/rw=1/')
if html_anchor:
    # res_body 内の <a> タグ全パターン
    bodies = re.findall(r'class="res_body"[^>]*>([\s\S]*?)</div>', html_anchor)
    for body in bodies:
        for a_tag in re.findall(r'<a[^>]*>[^<]*</a>', body):
            all_anchor_patterns.add(a_tag)
    log(f'res_body 内 <a> タグのユニークパターン:')
    for pat in sorted(all_anchor_patterns):
        log(f'  {pat}')

# >>NNN アンカーの span 構造
log()
log('--- <span ><a href=...>>NNN</a> の完全構造 ---')
if html_anchor:
    span_anchors = re.findall(r'<span\s*>[^<]*<a\s+href="([^"]*)"[^>]*>([\s\S]*?)</a>[^<]*</span>', html_anchor)
    for href, text in span_anchors[:5]:
        log(f'  href={href} text={repr(text)}')

# ============================================================
# 6. スレッド一覧の「固定スレ」(row_fixed_icon) 判定
# ============================================================

sec('6. スレッド一覧の固定スレ・ピックアップ etc. の判定方法')

html_tl_top, _ = fetch('/thr_tl/acode=1/ctgid=104/bid=330/')
if html_tl_top:
    parts_top = re.split(r'<li\s+data-tid=', html_tl_top)
    log(f'件数: {len(parts_top)-1}')
    log()
    for chunk in parts_top[1:]:
        tid_m = re.match(r'^["\']?(\d+)["\']?', chunk)
        tid = tid_m.group(1) if tid_m else '?'
        has_fixed = 'row_fixed_icon' in chunk
        has_em = bool(re.search(r'<em>\d+</em>', chunk))
        em_val = re.search(r'<em>(\d+)</em>', chunk)
        title_m = re.search(r'class="thr_status_icon"\s+title="([^"]+)"', chunk)
        title = title_m.group(1)[:40] if title_m else '?'
        log(f'tid={tid} fixed={has_fixed} em={em_val.group(1) if em_val else "none"} title={title}')

# ============================================================
# 7. スレッド詳細の総レス数フィールド
# ============================================================

sec('7. スレッド詳細の総レス数・スレタイトルのフィールド')

html_detail, _ = fetch('/thr_res/acode=4/ctgid=157/bid=5813/tid=13030722/tp=1/')
if html_detail:
    # レス数: "レス数NNN" または "NNN件"
    res_total_patterns = [
        r'レス数\s*(\d+)',
        r'(\d+)\s*レス',
        r'class="[^"]*res_cnt[^"]*"[^>]*>([\s\S]*?)</',
        r'合計[！!]\s*(\d+)',
    ]
    for pat in res_total_patterns:
        m = re.search(pat, html_detail)
        if m:
            log(f'パターン {repr(pat)}: {m.group(0)[:60]}')

    # <title> タグ
    title_m = re.search(r'<title>([^<]+)</title>', html_detail)
    if title_m:
        log(f'<title>: {title_m.group(1)[:100]}')

    # meta description
    desc_m = re.search(r'<meta[^>]*name="description"[^>]*content="([^"]*)"', html_detail)
    if desc_m:
        log(f'meta description (100文字): {desc_m.group(1)[:100]}')

    # class="goodbad_entry_guide" の周辺 (合計レス数が入っている可能性)
    guide_m = re.search(r'class="goodbad_entry_guide"([\s\S]{0,300})', html_detail)
    if guide_m:
        log(f'goodbad_entry_guide 周辺: {guide_m.group(0)[:300]}')

    # 報告 NNN NNN 合計 の構造
    report_m = re.search(r'報告\s*([\s\S]{0,100})合計', html_detail)
    if report_m:
        log(f'報告...合計: {report_m.group(0)[:100]}')

# ============================================================
# 8. スレッド一覧の updatedAt 正確な取り方 (decodeEntities)
# ============================================================

sec('8. parseThreadList での updatedAt 正確なデコード方法')

html_tl8, _ = fetch('/thr_tl/acode=4/ctgid=157/bid=5813/')
if html_tl8:
    parts_tl8 = re.split(r'<li\s+data-tid=', html_tl8)
    log('先頭5件の updatedAt の raw 抽出:')
    for chunk in parts_tl8[1:6]:
        tid_m = re.match(r'^["\']?(\d+)["\']?', chunk)
        tid = tid_m.group(1) if tid_m else '?'
        ud_idx = chunk.find('class="ttUdTime"')
        if ud_idx == -1:
            continue
        ud_start = chunk.index('>', ud_idx) + 1
        ud_block = chunk[ud_start:ud_start + 200]
        first_span = ud_block.find('<span')
        raw_time = ud_block[:first_span].strip() if first_span != -1 else ud_block.strip()

        # 方法1: strip() (HTML タグ除去のみ)
        method1 = re.sub(r'<[^>]*>', '', raw_time).strip()
        # 方法2: replace &ensp;
        method2 = method1.replace('&ensp;', '').replace('&nbsp;', '').strip()
        # 方法3: 数字/文字/「前」だけ残す
        method3 = re.search(r'[\d/]+\s*[\d:]+|[\d]+時間前|[\d]+分前|たった今', raw_time)

        log(f'tid={tid}:')
        log(f'  raw   : {repr(raw_time[:50])}')
        log(f'  method1: {repr(method1[:50])}')
        log(f'  method2: {repr(method2[:50])}')
        log(f'  method3: {method3.group(0) if method3 else "NONE"}')

# ============================================================
# 出力保存
# ============================================================
OUT_FILE = os.path.join(OUT_DIR, 'analyze_remaining.txt')
with open(OUT_FILE, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))

log()
log(f'出力完了: {OUT_FILE}')
