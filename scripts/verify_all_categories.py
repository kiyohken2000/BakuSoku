"""
成人/ギャンブルカテゴリを含む全カテゴリ取得の最終確認
"""
import sys, re, urllib.request, html as html_mod
sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf-8', buffering=1, closefd=False)

UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'text/html'})
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            return res.read().decode('utf-8', errors='replace')
    except:
        return ''

def strip_tags(s):
    return html_mod.unescape(re.sub(r'<[^>]+>', '', s))

def extract_board_name(inner_html):
    m = re.search(r'class="brdName(?=["\s])[^"]*"[^>]*>([\s\S]*?)</div>', inner_html)
    if m:
        return html_mod.unescape(strip_tags(m.group(1))).strip()
    return strip_tags(inner_html)

def clean_board_name(raw):
    if not raw: return None
    if 'もっと見る' in raw: return None
    lines = [l.strip() for l in raw.split('\n') if l.strip()]
    if not lines: return None
    if lines[0] == 'PICKUP!' and len(lines) > 1: return lines[1]
    return lines[0]

def parse_area_top(html):
    categories = []
    boards = []
    cat_regex = re.compile(r'href="/bbstop/acode=(\d+)/ctgid=(\d+)/?"[^>]*>([\s\S]*?)</a>')
    for m in cat_regex.finditer(html):
        name = strip_tags(m.group(3)).strip()
        ctgid = int(m.group(2))
        if name and not any(c['ctgid'] == ctgid for c in categories):
            categories.append({'acode': int(m.group(1)), 'ctgid': ctgid, 'name': name[:30]})
    board_regex = re.compile(r'href="/thr_tl/acode=(\d+)/ctgid=(\d+)/bid=(\d+)/?"[^>]*>([\s\S]*?)</a>')
    boards_by_ctgid = {}
    for m in board_regex.finditer(html):
        name = clean_board_name(extract_board_name(m.group(4)))
        if name:
            ctgid = int(m.group(2))
            if ctgid not in boards_by_ctgid:
                boards_by_ctgid[ctgid] = []
            if not any(b['bid'] == int(m.group(3)) for b in boards_by_ctgid[ctgid]):
                boards_by_ctgid[ctgid].append({'bid': int(m.group(3)), 'name': name})
    return {'categories': categories, 'boardsByCtgid': boards_by_ctgid}

ACODE = 4
main_html  = fetch(f'https://bakusai.com/areatop/acode={ACODE}/')
adult_html = fetch(f'https://bakusai.com/ctgtop_a/acode={ACODE}/')
gamble_html= fetch(f'https://bakusai.com/ctgtop_g/acode={ACODE}/')

main   = parse_area_top(main_html)
adult  = parse_area_top(adult_html)
gamble = parse_area_top(gamble_html)

# マージ
all_cats = list(main['categories'])
all_boards_by_ctgid = dict(main['boardsByCtgid'])
for cat in adult['categories'] + gamble['categories']:
    if not any(c['ctgid'] == cat['ctgid'] for c in all_cats):
        all_cats.append(cat)
for ctgid, boards in {**adult['boardsByCtgid'], **gamble['boardsByCtgid']}.items():
    if ctgid not in all_boards_by_ctgid:
        all_boards_by_ctgid[ctgid] = boards

print(f'通常カテゴリ数: {len(main["categories"])}')
print(f'成人カテゴリ数: {len(adult["categories"])}')
print(f'ギャンブルカテゴリ数: {len(gamble["categories"])}')
print(f'マージ後合計カテゴリ数: {len(all_cats)}')
print()
print('=== 全カテゴリ一覧 ===')
for cat in all_cats:
    ctgid = cat['ctgid']
    board_count = len(all_boards_by_ctgid.get(ctgid, []))
    tag = ''
    if any(c['ctgid'] == ctgid for c in adult['categories']): tag = ' [成人]'
    elif any(c['ctgid'] == ctgid for c in gamble['categories']): tag = ' [ギャンブル]'
    print(f'  ctgid={ctgid:4d}: {cat["name"][:30]}{tag} (板{board_count}件)')
