import urllib.request
import re
import os

BASE_URL = 'https://bakusai.com'
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Mobile/15E148 Safari/604.1',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'ja-JP,ja;q=0.9',
}

OUT_DIR = os.path.join(os.path.dirname(__file__), 'out')
os.makedirs(OUT_DIR, exist_ok=True)
OUT_FILE = os.path.join(OUT_DIR, 'analyze_areatop_missing_boards.txt')

ACODE = 4
AREA_URL = f'{BASE_URL}/areatop/acode={ACODE}/'

cat_re = re.compile(r'href="/bbstop/acode=(\d+)/ctgid=(\d+)/?"[^>]*>([\s\S]*?)</a>')
board_re = re.compile(r'href="/thr_tl/acode=(\d+)/ctgid=(\d+)/bid=(\d+)/?"[^>]*>([\s\S]*?)</a>')


def fetch(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=20) as resp:
        return resp.read().decode('utf-8', errors='replace')


def clean_text(s):
    s = re.sub(r'<[^>]+>', ' ', s)
    s = re.sub(r'\s+', ' ', s)
    return s.strip()


def is_junk(name):
    return ('もっと見る' in name) or ('PICKUP!' in name)

area_html = fetch(AREA_URL)

# categories (dedup, keep order)
cat_list = []
for m in cat_re.finditer(area_html):
    ctgid = m.group(2)
    name = clean_text(m.group(3))
    if not any(c['ctgid'] == ctgid for c in cat_list):
        cat_list.append({'ctgid': ctgid, 'name': name})

# areatop boards grouped
area_boards = {}
for m in board_re.finditer(area_html):
    ctgid = m.group(2)
    name = clean_text(m.group(4))
    area_boards.setdefault(ctgid, []).append({'bid': m.group(3), 'name': name})

lines = []
lines.append(f'AREA_URL: {AREA_URL}')
lines.append('')

problem_categories = []

for cat in cat_list:
    ctgid = cat['ctgid']
    name = cat['name']
    boards = area_boards.get(ctgid, [])
    count = len(boards)
    junk_count = sum(1 for b in boards if is_junk(b['name']))
    # heuristic: suspicious if few boards or has junk
    if count == 0 or junk_count > 0 or count < 10:
        # fetch bbstop and compare size
        bbs_url = f'{BASE_URL}/bbstop/acode={ACODE}/ctgid={ctgid}/'
        try:
            bbs_html = fetch(bbs_url)
            bbs_boards = []
            for m in board_re.finditer(bbs_html):
                bbs_boards.append({'bid': m.group(3), 'name': clean_text(m.group(4))})
            bbs_count = len(bbs_boards)
        except Exception:
            bbs_count = -1
            bbs_boards = []
        # flag if bbstop is much larger
        if bbs_count >= 0 and (bbs_count > count * 2 or (count <= 10 and bbs_count >= 20)):
            problem_categories.append({
                'ctgid': ctgid,
                'name': name,
                'areatop_count': count,
                'areatop_junk': junk_count,
                'bbstop_count': bbs_count,
                'sample': bbs_boards[:10],
            })

lines.append('--- Suspected Missing Boards (areatop vs bbstop) ---')
for p in problem_categories:
    lines.append(f"ctgid={p['ctgid']} name={p['name']} areatop={p['areatop_count']} (junk={p['areatop_junk']}) bbstop={p['bbstop_count']}")
    for b in p['sample']:
        lines.append(f"  bid={b['bid']} name={b['name']}")

with open(OUT_FILE, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))
