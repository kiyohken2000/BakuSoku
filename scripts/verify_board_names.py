"""
修正後の板名取得ロジックを検証
"""
import sys, re, urllib.request, html as html_mod
sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf-8', buffering=1, closefd=False)

UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'text/html'})
    with urllib.request.urlopen(req, timeout=15) as res:
        return res.read().decode('utf-8', errors='replace')

def decode_entities(s):
    return html_mod.unescape(s)

def strip_tags(s):
    return decode_entities(re.sub(r'<[^>]+>', '', s))

def extract_board_name(inner_html):
    """修正後ロジック: brdName div を優先取得"""
    m = re.search(r'class="brdName[^"]*"[^>]*>([\s\S]*?)</div>', inner_html)
    if m:
        return decode_entities(strip_tags(m.group(1))).strip()
    return strip_tags(inner_html)

def clean_board_name(raw):
    if not raw: return None
    if 'もっと見る' in raw: return None
    lines = [l.strip() for l in raw.split('\n') if l.strip()]
    if not lines: return None
    if lines[0] == 'PICKUP!' and len(lines) > 1: return lines[1]
    return lines[0]

# いくつかのカテゴリを確認
test_urls = [
    ('https://bakusai.com/bbstop/acode=4/ctgid=148/', '雑談'),
    ('https://bakusai.com/bbstop/acode=4/ctgid=119/', '公務員'),
    ('https://bakusai.com/bbstop/acode=4/ctgid=108/', '美容'),
    ('https://bakusai.com/bbstop/acode=4/ctgid=157/', '政治'),
]

for url, label in test_urls:
    html = fetch(url)
    boards = []
    pattern = r'href="/thr_tl/acode=(\d+)/ctgid=(\d+)/bid=(\d+)/?"[^>]*>([\s\S]*?)</a>'
    for m in re.finditer(pattern, html):
        inner = m.group(4)
        name = clean_board_name(extract_board_name(inner))
        if name:
            boards.append(name)

    print(f'\n=== {label} ({url}) ===')
    print(f'板数: {len(boards)}')
    # 絵文字のみの名前を検出
    emoji_only = [n for n in boards if not re.search(r'[\u3040-\u9fff\u4e00-\u9fff\uff00-\uffef]', n) and not re.search(r'[a-zA-Z0-9]', n)]
    print(f'絵文字のみ(問題あり): {len(emoji_only)}件')
    for n in emoji_only[:5]:
        print(f'  問題: {repr(n)}')
    print('サンプル(最初10件):')
    for n in boards[:10]:
        print(f'  ✓ {n}')
