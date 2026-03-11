import sys, re, urllib.request, html as html_mod
sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf-8', buffering=1, closefd=False)

UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'text/html'})
    with urllib.request.urlopen(req, timeout=15) as res:
        return res.read().decode('utf-8', errors='replace')

def strip_tags(s):
    return html_mod.unescape(re.sub(r'<[^>]+>', '', s))

def is_promo(inner):
    return 'view_user_new_columns' in inner or 'view_user_landscape' in inner

def extract_name(inner_html):
    m = re.search(r'class="brdName(?=["\s])[^"]*"[^>]*>([\s\S]*?)</div>', inner_html)
    if m:
        return html_mod.unescape(strip_tags(m.group(1))).strip()
    return strip_tags(inner_html)

def clean_name(raw):
    if not raw: return None
    if 'もっと見る' in raw: return None
    lines = [l.strip() for l in raw.split('\n') if l.strip()]
    if not lines: return None
    if lines[0] == 'PICKUP!' and len(lines) > 1: return lines[1]
    return lines[0]

for ctgid in [104, 119, 103, 126]:
    html = fetch(f'https://bakusai.com/bbstop/acode=4/ctgid={ctgid}/')
    boards = []
    pattern = r'href="/thr_tl/acode=(\d+)/ctgid=(\d+)/bid=(\d+)/?"[^>]*>([\s\S]*?)</a>'
    for m in re.finditer(pattern, html):
        if is_promo(m.group(4)):
            continue
        name = clean_name(extract_name(m.group(4)))
        if name:
            boards.append(name)
    has_cld = any('カテゴリ' in b and '独り言' in b for b in boards)
    print(f'ctgid={ctgid}: {len(boards)}板, カテゴリーダー混入={has_cld}')
    for b in boards[:5]:
        print(f'  {b}')
