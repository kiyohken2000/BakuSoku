"""
1. /thr_res_show/ アンカーポップアップのレスポンス構造
2. updatedAt デコード
3. スレッド詳細 総レス数フィールド
出力: scripts/out/analyze_show_url.txt
"""
import urllib.request, re, os, sys
sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf-8', buffering=1, closefd=False)

OUT_DIR = os.path.join(os.path.dirname(__file__), 'out')
os.makedirs(OUT_DIR, exist_ok=True)

BASE = 'https://bakusai.com'
UA = ('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) '
      'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')

lines = []
def log(s=''):
    print(s)
    lines.append(str(s))

def fetch(path, full=False):
    url = path if full else (BASE + path)
    req = urllib.request.Request(url, headers={
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja-JP,ja;q=0.9',
    })
    resp = urllib.request.urlopen(req, timeout=15)
    return resp.read().decode('utf-8', errors='replace'), resp.geturl()

def strip(s):
    s = re.sub(r'<[^>]+>', '', s)
    for e, r in [('&amp;','&'),('&lt;','<'),('&gt;','>'),('&nbsp;',' '),('&ensp;',' '),('&quot;','"')]:
        s = s.replace(e, r)
    return re.sub(r'\s+', ' ', s).strip()

def sec(t):
    log(); log('='*70); log(t); log('='*70)

# =============================================================
# A. /thr_res_show/ のレスポンス
# =============================================================
sec('A. /thr_res_show/ アンカーポップアップ')

html, _ = fetch('/thr_res/acode=4/ctgid=157/bid=5813/tid=13030722/tp=1/rw=1/')
show_urls = re.findall(r'href="(/thr_res_show/[^"]+)"', html)
log(f'thr_res_show リンク数: {len(show_urls)}')
for u in show_urls[:6]:
    log(f'  {u}')

log()
log('--- 各 URL のフェッチ結果 ---')
for url in show_urls[:4]:
    log()
    log(f'GET: {url}')
    try:
        h, final = fetch(url)
    except Exception as e:
        log(f'  ERROR: {e}')
        continue
    log(f'  size={len(h)} final={final}')

    if h.strip().startswith('{') or h.strip().startswith('['):
        log(f'  TYPE=JSON: {h[:400]}')
        continue

    log(f'  TYPE=HTML')
    # li id="res" の数
    parts = re.split(r'<li\s+id="res', h)
    log(f'  <li id="res"> 数: {len(parts)-1}')
    for chunk in parts[1:]:
        m = re.match(r'^(\d+)_block', chunk)
        if not m: continue
        rrid = int(m.group(1))
        if rrid == 0: continue
        ct = re.search(r'itemprop="commentTime"[^>]*>([\s\S]*?)</span>', chunk)
        b_start = chunk.find('class="res_body"')
        body = ''
        if b_start != -1:
            after = chunk.index('>', b_start)+1
            end = chunk.find('</div>', after)
            body = strip(chunk[after:end])[:80] if end != -1 else ''
        log(f'  rrid={rrid} date={ct.group(1).strip() if ct else "N/A"} body={body}')

    log(f'  先頭600文字:\n{h[:600]}')

# rrid=00 の挙動
log()
log('--- rrid=00 (不存在) ---')
url_bad = '/thr_res_show/acode=4/ctgid=157/bid=5813/tid=13030722/rrid=00/#res00'
try:
    h_bad, final_bad = fetch(url_bad)
    log(f'size={len(h_bad)} final={final_bad}')
    log(f'先頭300: {h_bad[:300]}')
except Exception as e:
    log(f'ERROR: {e}')

# =============================================================
# B. updatedAt のデコード
# =============================================================
sec('B. updatedAt の全パターン')

html_tl, _ = fetch('/thr_tl/acode=4/ctgid=157/bid=5813/')
parts_tl = re.split(r'<li\s+data-tid=', html_tl)
log(f'件数: {len(parts_tl)-1}')
for chunk in parts_tl[1:11]:
    tid_m = re.match(r'^["\']?(\d+)["\']?', chunk)
    tid = tid_m.group(1) if tid_m else '?'
    ud_idx = chunk.find('class="ttUdTime"')
    if ud_idx == -1: continue
    ud_start = chunk.index('>', ud_idx)+1
    ud_block = chunk[ud_start:ud_start+200]
    first_span = ud_block.find('<span')
    raw = ud_block[:first_span].strip() if first_span != -1 else ud_block.strip()
    decoded = strip(raw)
    log(f'tid={tid}: raw={repr(raw[:40])} decoded={repr(decoded[:40])}')

# =============================================================
# C. スレッド詳細の総レス数フィールド
# =============================================================
sec('C. スレッド詳細の総レス数・スレタイトル')

html_d, _ = fetch('/thr_res/acode=4/ctgid=157/bid=5813/tid=13030722/tp=1/')

# <title>
title_m = re.search(r'<title>([^<]+)</title>', html_d)
log(f'<title>: {title_m.group(1)[:100] if title_m else "NONE"}')

# 「報告 NNNN MMMM 合計！」パターン (OP 周辺)
report_m = re.search(r'報告\s*(\d+)\s*(\d+)\s*合計', html_d)
if report_m:
    log(f'報告 {report_m.group(1)} {report_m.group(2)} 合計')

# レス数: class="name" の合計部分
name_area_m = re.search(r'class="name"[^>]*>([\s\S]{0,800})', html_d)
if name_area_m:
    stripped = strip(name_area_m.group(1))[:200]
    log(f'class="name" stripped: {stripped}')

# OP ブロック (rrid=0_whole)
op_m = re.search(r'id="res_?0_whole"([\s\S]{0,600})', html_d)
if op_m:
    log(f'rrid=0_whole 周辺: {op_m.group(0)[:400]}')

# meta description
desc_m = re.search(r'<meta[^>]*name="description"[^>]*content="([^"]*)"', html_d)
if desc_m:
    log(f'description: {desc_m.group(1)[:120]}')

# =============================================================
# D. スレッド一覧 固定スレ判定
# =============================================================
sec('D. スレッド一覧 固定スレ・<em> の意味')

html_tl2, _ = fetch('/thr_tl/acode=1/ctgid=104/bid=330/')
parts2 = re.split(r'<li\s+data-tid=', html_tl2)
log(f'件数: {len(parts2)-1}')
for chunk in parts2[1:]:
    tid_m = re.match(r'^["\']?(\d+)["\']?', chunk)
    tid = tid_m.group(1) if tid_m else '?'
    has_fixed = 'row_fixed_icon' in chunk
    em_m = re.search(r'<em>(\d+)</em>', chunk)
    title_m = re.search(r'class="thr_status_icon"\s+title="([^"]+)"', chunk)
    title = title_m.group(1)[:40] if title_m else '?'
    log(f'tid={tid} em={em_m.group(1) if em_m else "none"} fixed={has_fixed} title={title}')

# =============================================================
# 保存
# =============================================================
OUT = os.path.join(OUT_DIR, 'analyze_show_url.txt')
with open(OUT, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))
log()
log(f'完了: {OUT}')
