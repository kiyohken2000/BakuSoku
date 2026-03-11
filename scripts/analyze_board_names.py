"""
bbstop ページの板名HTML構造を詳細調査
- 絵文字のみになっている板のHTMLを特定
- cleanBoardName が切り捨てているものを確認
"""
import sys, re, urllib.request, urllib.error, html as html_mod
sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf-8', buffering=1, closefd=False)

UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

def fetch(url):
    req = urllib.request.Request(url, headers={
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            return res.read().decode('utf-8', errors='replace')
    except Exception as e:
        print(f'fetch error: {e}')
        return ''

def strip_tags(s):
    return re.sub(r'<[^>]+>', '', s)

def decode_entities(s):
    return html_mod.unescape(s)

# --- 現在の cleanBoardName ロジックを再現 ---
def clean_board_name(raw):
    if not raw:
        return None
    if 'もっと見る' in raw or 'もっと\u0020見る' in raw:
        return None
    lines = [l.strip() for l in raw.split('\n') if l.strip()]
    if not lines:
        return None
    if lines[0] == 'PICKUP!' and len(lines) > 1:
        return lines[1]
    return lines[0]

# acode=4 の複数カテゴリの bbstop を調査
ACODE = 4
# areatop から ctgid を取得
AREATOP = f'https://bakusai.com/areatop/acode={ACODE}/'

print('areatop からカテゴリ一覧を取得中...')
top_html = fetch(AREATOP)
cat_matches = re.findall(r'href="/bbstop/acode=(\d+)/ctgid=(\d+)/"[^>]*>([^<]*)</a>', top_html)
# 重複除去
seen = set()
categories = []
for a, c, name in cat_matches:
    if c not in seen:
        seen.add(c)
        categories.append((int(a), int(c), strip_tags(name).strip()))

print(f'カテゴリ数: {len(categories)}')
print()

# 各カテゴリの bbstop を調査
problem_boards = []
all_boards = []

for acode, ctgid, catname in categories[:20]:  # 最初の20カテゴリ
    url = f'https://bakusai.com/bbstop/acode={acode}/ctgid={ctgid}/'
    html = fetch(url)
    if not html:
        continue

    # /thr_tl/ リンクを全て抽出（前後コンテキスト付き）
    pattern = r'href="/thr_tl/acode=(\d+)/ctgid=(\d+)/bid=(\d+)/?"([^>]*)>([\s\S]*?)</a>'
    for m in re.finditer(pattern, html):
        a2, c2, bid, attrs, inner = m.groups()
        raw_text = strip_tags(inner)
        cleaned = clean_board_name(raw_text)
        decoded = decode_entities(cleaned) if cleaned else None

        board = {
            'catname': catname,
            'ctgid': ctgid,
            'bid': bid,
            'raw_text': raw_text,
            'cleaned': cleaned,
            'decoded': decoded,
            'inner_html': inner[:200],
        }
        all_boards.append(board)

        # 絵文字のみ判定: テキストが空か絵文字のみ
        if decoded:
            # 絵文字・記号だけかチェック (日本語・英数字がなければ怪しい)
            no_cjk = re.sub(r'[\u3000-\u9fff\uff00-\uffef\u4e00-\u9fff\u3040-\u30ff]', '', decoded)
            no_ascii = re.sub(r'[a-zA-Z0-9]', '', no_cjk).strip()
            # 実際の文字がほぼ絵文字のみ
            is_emoji_only = len(decoded.strip()) <= 4 or (len(no_ascii) > 0 and len(decoded.strip()) <= 6)
            if is_emoji_only or decoded.strip() == raw_text.split('\n')[0].strip():
                problem_boards.append(board)

print(f'全板数: {len(all_boards)}')
print(f'問題のある板数(絵文字のみ疑い): {len(problem_boards)}')
print()

# 問題板のHTML構造を詳しく表示
print('=' * 60)
print('問題のある板のHTML構造サンプル (最初の20件)')
print('=' * 60)
shown = 0
for b in all_boards:
    decoded = b['decoded'] or ''
    raw = b['raw_text']

    # 絵文字のみかどうか判定
    text_only = re.sub(r'[\U00010000-\U0010ffff\u2600-\u27ff\u2b00-\u2bff\u1f000-\u1ffff]', '', decoded).strip()
    # CJK文字チェック
    has_cjk = bool(re.search(r'[\u3040-\u9fff]', decoded))

    if not has_cjk and decoded and shown < 20:
        print(f'\n--- カテゴリ: {b["catname"]} / bid={b["bid"]} ---')
        print(f'raw_text (repr): {repr(raw[:100])}')
        print(f'cleaned:  {repr(b["cleaned"])}')
        print(f'decoded:  {repr(decoded)}')
        print(f'inner_html: {repr(b["inner_html"][:200])}')
        shown += 1

print()
print('=' * 60)
print('正常に取れている板のサンプル (最初の10件)')
print('=' * 60)
shown2 = 0
for b in all_boards:
    decoded = b['decoded'] or ''
    has_cjk = bool(re.search(r'[\u3040-\u9fff]', decoded))
    if has_cjk and shown2 < 10:
        print(f'  [{b["catname"]}] {decoded[:40]}')
        shown2 += 1

print()
print('=' * 60)
print('内部HTMLのパターン分析 (絵文字板)')
print('=' * 60)
# 絵文字板のinnerHTMLからパターンを探す
patterns_found = {}
for b in all_boards:
    decoded = b['decoded'] or ''
    has_cjk = bool(re.search(r'[\u3040-\u9fff]', decoded))
    if not has_cjk and decoded:
        inner = b['inner_html']
        # spanタグの有無
        has_span = '<span' in inner
        has_img = '<img' in inner
        has_br = '<br' in inner
        key = f'span={has_span},img={has_img},br={has_br}'
        if key not in patterns_found:
            patterns_found[key] = {'count': 0, 'example': inner[:150]}
        patterns_found[key]['count'] += 1

for k, v in patterns_found.items():
    print(f'{k}: {v["count"]}件')
    print(f'  例: {repr(v["example"])}')
    print()
