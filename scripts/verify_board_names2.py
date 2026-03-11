"""
修正ロジック最終確認
"""
import sys, re, urllib.request, html as html_mod
sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf-8', buffering=1, closefd=False)

UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'text/html'})
    with urllib.request.urlopen(req, timeout=15) as res:
        return res.read().decode('utf-8', errors='replace')

def decode_entities(s): return html_mod.unescape(s)
def strip_tags(s): return decode_entities(re.sub(r'<[^>]+>', '', s))

def extract_board_name(inner_html):
    """修正後: brdNameWrap を除外した brdName マッチ"""
    m = re.search(r'class="brdName(?=["\s])[^"]*"[^>]*>([\s\S]*?)</div>', inner_html)
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

test_urls = [
    ('https://bakusai.com/bbstop/acode=4/ctgid=148/', '雑談'),
    ('https://bakusai.com/bbstop/acode=4/ctgid=119/', '公務員'),
    ('https://bakusai.com/bbstop/acode=4/ctgid=108/', '美容'),
    ('https://bakusai.com/bbstop/acode=4/ctgid=157/', '政治'),
    ('https://bakusai.com/bbstop/acode=4/ctgid=104/', '地域雑談'),
]

total_boards = 0
total_emoji_only = 0

for url, label in test_urls:
    html = fetch(url)
    boards = []
    pattern = r'href="/thr_tl/acode=(\d+)/ctgid=(\d+)/bid=(\d+)/?"[^>]*>([\s\S]*?)</a>'
    for m in re.finditer(pattern, html):
        inner = m.group(4)
        name = clean_board_name(extract_board_name(inner))
        if name:
            boards.append((m.group(3), name))

    emoji_only = [(bid, n) for bid, n in boards
                  if not re.search(r'[\u3040-\u9fff\u4e00-\u9fff\uff00-\uffef\u30a0-\u30ff]', n)
                  and not re.search(r'[a-zA-Z0-9]', n)]

    total_boards += len(boards)
    total_emoji_only += len(emoji_only)

    print(f'\n=== {label} ===')
    print(f'板数: {len(boards)}, 絵文字のみ(問題): {len(emoji_only)}件')
    if emoji_only:
        for bid, n in emoji_only[:3]:
            print(f'  問題: bid={bid} → {repr(n)}')
    else:
        print(f'  ✓ 全て正常')
    print('サンプル:')
    for bid, n in boards[:8]:
        print(f'  {n}')

print(f'\n合計: {total_boards}板, 問題: {total_emoji_only}件')
