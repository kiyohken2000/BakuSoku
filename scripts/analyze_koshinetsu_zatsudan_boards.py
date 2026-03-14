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
OUT_FILE = os.path.join(OUT_DIR, 'analyze_koshinetsu_zatsudan_boards.txt')

AREA_URL = f'{BASE_URL}/areatop/acode=4/'
BBS_URL = f'{BASE_URL}/bbstop/acode=4/ctgid=104/'

board_re = re.compile(r'href="/thr_tl/acode=(\d+)/ctgid=(\d+)/bid=(\d+)/?"[^>]*>([\s\S]*?)</a>')

def fetch(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=15) as resp:
        return resp.read().decode('utf-8', errors='replace')

def clean_text(s):
    s = re.sub(r'<[^>]+>', ' ', s)
    s = re.sub(r'\s+', ' ', s)
    return s.strip()

area_html = fetch(AREA_URL)
bbs_html = fetch(BBS_URL)

lines = []
lines.append(f'AREA_URL: {AREA_URL}')
lines.append(f'BBS_URL:  {BBS_URL}')
lines.append('')

# areatop boards for ctgid=104
area_boards = []
for m in board_re.finditer(area_html):
    if m.group(2) == '104':
        area_boards.append((m.group(3), clean_text(m.group(4))))
lines.append('--- areatop ctgid=104 boards ---')
lines.append(f'count={len(area_boards)}')
for bid, name in area_boards[:50]:
    lines.append(f'  bid={bid} name={name}')

lines.append('')
# bbstop boards for ctgid=104
bbs_boards = []
for m in board_re.finditer(bbs_html):
    bbs_boards.append((m.group(3), clean_text(m.group(4))))
lines.append('--- bbstop ctgid=104 boards ---')
lines.append(f'count={len(bbs_boards)}')
for bid, name in bbs_boards[:50]:
    lines.append(f'  bid={bid} name={name}')

with open(OUT_FILE, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))
