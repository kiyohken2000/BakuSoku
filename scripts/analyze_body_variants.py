"""
5. 削除済みレス・画像付きレス・複数アンカーの body 形式

出力: scripts/out/analyze_body_variants.txt
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
    for e, r in [('&amp;','&'),('&lt;','<'),('&gt;','>'),('&nbsp;',' '),('&ensp;',' ')]:
        s = s.replace(e, r)
    return re.sub(r'\s+', ' ', s).strip()

def sec(t):
    log(); log('='*70); log(t); log('='*70)

def get_bodies(html):
    """html からレスブロックの (rrid, date, body_raw) を返す"""
    results = []
    parts = re.split(r'<li\s+id="res', html)
    for chunk in parts[1:]:
        m = re.match(r'^(\d+)_block', chunk)
        if not m: continue
        rrid = int(m.group(1))
        if rrid == 0: continue
        ct = re.search(r'itemprop="commentTime"[^>]*>([\s\S]*?)</span>', chunk)
        if not ct: continue  # quote スキップ
        b_start = chunk.find('class="res_body"')
        if b_start == -1: continue
        after = chunk.index('>', b_start)+1
        end = chunk.find('</div>', after)
        body_raw = chunk[after:end] if end != -1 else ''
        results.append((rrid, ct.group(1).strip(), body_raw))
    return results

# =============================================================
# A. 削除済みレスの HTML 構造
# =============================================================
sec('A. 削除済みレスの HTML 構造')

# テストスレの通常ページ (rrid に飛びがあるか確認)
html_n, _ = fetch('/thr_res/acode=4/ctgid=157/bid=5813/tid=13030722/tp=1/')
parts_n = re.split(r'<li\s+id="res', html_n)

log('通常ページの全 rrid:')
rrid_info = []
for chunk in parts_n[1:]:
    m = re.match(r'^(\d+)_block', chunk)
    if not m: continue
    rrid = int(m.group(1))
    has_ct = bool(re.search(r'itemprop="commentTime"', chunk))
    has_body = 'class="res_body"' in chunk
    style_hidden = 'display:none' in chunk[:200]
    rrid_info.append((rrid, has_ct, has_body, style_hidden))

log(str([(r,ct,b,h) for r,ct,b,h in rrid_info]))

# commentTime なし (rrid != 0) のブロックを全部表示
log()
log('--- rrid != 0 かつ commentTime なし のブロック ---')
for chunk in parts_n[1:]:
    m = re.match(r'^(\d+)_block', chunk)
    if not m: continue
    rrid = int(m.group(1))
    if rrid == 0: continue
    has_ct = bool(re.search(r'itemprop="commentTime"', chunk))
    if not has_ct:
        style_m = re.search(r'style="([^"]*)"', chunk[:300])
        log(f'rrid={rrid} style={style_m.group(1) if style_m else "none"}')
        log('<li id="res' + chunk[:300])
        log()

# =============================================================
# B. 画像付きレスの body 形式
# =============================================================
sec('B. 画像付きレスの res_body HTML')

# 画像投稿が多い板を探す: 芸能系・グラビア系
IMG_CANDIDATES = [
    '/thr_res/acode=3/ctgid=137/bid=5868/tp=1/',   # 東京 グラビアニュース
    '/thr_res/acode=3/ctgid=116/bid=247/tp=1/',    # 東京 お笑い芸人
    '/thr_res/acode=3/ctgid=116/bid=93/tp=1/',     # 東京 TV・ラジオ番組総合
]

found_img = False
for path in IMG_CANDIDATES:
    log(f'試行: {path}')
    try:
        html_img, _ = fetch(path)
    except Exception as e:
        log(f'  ERROR: {e}')
        continue

    bodies = get_bodies(html_img)
    for rrid, date, body_raw in bodies:
        if '<img' in body_raw:
            log(f'  画像発見! rrid={rrid}')
            log(f'  body_raw (500文字): {body_raw[:500]}')
            img_srcs = re.findall(r'src="([^"]+)"', body_raw)
            log(f'  img src: {img_srcs}')
            found_img = True
            break
    if found_img:
        break

if not found_img:
    log('画像付きレスが見つからなかったためスレ一覧からスキャン')
    # スレ一覧の複数板をスキャン
    BOARDS = [
        '/thr_tl/acode=3/ctgid=137/bid=5868/',  # グラビア
        '/thr_tl/acode=3/ctgid=116/bid=4123/',  # 東京TV
    ]
    for board_path in BOARDS:
        try:
            html_bl, _ = fetch(board_path)
        except:
            continue
        parts_bl = re.split(r'<li\s+data-tid=', html_bl)
        for chunk in parts_bl[1:5]:
            href_m = re.search(r'href="(/thr_res/[^"]+)"', chunk)
            if not href_m: continue
            try:
                html_t, _ = fetch(href_m.group(1))
            except:
                continue
            bodies_t = get_bodies(html_t)
            for rrid, date, body_raw in bodies_t:
                if '<img' in body_raw:
                    log(f'  発見: {href_m.group(1)} rrid={rrid}')
                    log(f'  body_raw (500文字): {body_raw[:500]}')
                    found_img = True
                    break
            if found_img: break
        if found_img: break

if not found_img:
    log('画像付きレスは今回のサンプルでは発見できず')
    # 一般的な画像タグパターンだけ記録
    log('''
想定される画像 body 構造:
  <img src="https://img.bakusai.com/m/..." alt="..." class="...">
  または
  <a href="[大画像URL]"><img src="[サムネURL]" ...></a>
''')

# =============================================================
# C. 複数アンカー参照 (>>N >>M) の body 形式
# =============================================================
sec('C. 複数アンカー参照の body 形式')

# rw=1 で複数ページをスキャン
for page in range(1, 8):
    path = (f'/thr_res/acode=4/ctgid=157/bid=5813/tid=13030722/p={page}/tp=1/rw=1/'
            if page > 1 else
            '/thr_res/acode=4/ctgid=157/bid=5813/tid=13030722/tp=1/rw=1/')
    try:
        html_p, _ = fetch(path)
    except Exception as e:
        log(f'page={page} ERROR: {e}')
        break

    bodies = get_bodies(html_p)
    for rrid, date, body_raw in bodies:
        cnt = body_raw.count('thr_res_show')
        if cnt >= 2:
            log(f'page={page} rrid={rrid}: アンカー {cnt}個')
            log(f'body_raw: {body_raw[:600]}')
            log(f'href一覧: {re.findall(r"href=\"(/thr_res_show/[^\"]+)\"", body_raw)}')
            break
    else:
        continue
    break
else:
    log('複数アンカーは見つからず。1アンカーのパターンを詳細表示:')
    html_p1, _ = fetch('/thr_res/acode=4/ctgid=157/bid=5813/tid=13030722/tp=1/rw=1/')
    bodies_p1 = get_bodies(html_p1)
    for rrid, date, body_raw in bodies_p1:
        if 'thr_res_show' in body_raw:
            log(f'rrid={rrid}: {body_raw[:500]}')
            break

# >>NNN アンカーの全パターン
log()
log('--- >>NNN アンカーの全 HTML 構造パターン ---')
html_a, _ = fetch('/thr_res/acode=4/ctgid=157/bid=5813/tid=13030722/tp=1/rw=1/')
bodies_a = get_bodies(html_a)
anchor_patterns = set()
for rrid, date, body_raw in bodies_a:
    # span > a パターン
    spans = re.findall(r'<span[^>]*>(<a[^>]*>[^<]*</a>)</span>', body_raw)
    for s in spans:
        anchor_patterns.add(s)
    # a タグのみ
    atags = re.findall(r'<a[^>]+href="[^"]*thr_res_show[^"]*"[^>]*>([\s\S]*?)</a>', body_raw)
    for a in atags:
        anchor_patterns.add(a)

log(f'発見したアンカーパターン:')
for p in sorted(anchor_patterns):
    log(f'  {repr(p[:100])}')

# body 内の全 <a> タグと <span> タグの構造
log()
log('--- res_body 内の全タグ構造 (rrid=5 前後) ---')
for rrid, date, body_raw in bodies_a:
    if rrid < 3: continue
    log(f'rrid={rrid} body_raw:')
    log(body_raw[:400])
    log()
    if rrid > 7: break

# =============================================================
# D. >>NNN アンカーの span wrapper 構造
# =============================================================
sec('D. >>NNN アンカーの <span > ラッパー構造')

# 完全な span>a 構造を確認
html_full, _ = fetch('/thr_res/acode=4/ctgid=157/bid=5813/tid=13030722/tp=1/rw=1/')
span_a_all = re.findall(
    r'(<span\s*>[\s\S]*?<a\s+href="/thr_res_show/[^>]+>[\s\S]*?</a>[\s\S]*?</span>)',
    html_full
)
log(f'<span><a href="/thr_res_show/"> パターン数: {len(span_a_all)}')
for s in span_a_all[:5]:
    log(f'  {repr(s[:150])}')

# span なしの直接アンカー
direct_a = re.findall(
    r'(?<!span\s>)(<a\s+href="/thr_res_show/[^>]+>[\s\S]*?</a>)',
    html_full
)
log(f'直接 <a href="/thr_res_show/"> パターン数: {len(direct_a)}')
for a in direct_a[:5]:
    log(f'  {repr(a[:100])}')

# =============================================================
# 保存
# =============================================================
OUT = os.path.join(OUT_DIR, 'analyze_body_variants.txt')
with open(OUT, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))
log()
log(f'完了: {OUT}')
