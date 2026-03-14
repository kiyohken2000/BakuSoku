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
OUT_FILE = os.path.join(OUT_DIR, 'analyze_koshinetsu_categories.txt')

URL = f'{BASE_URL}/areatop/acode=4/'
CTGIDS_TO_CHECK = [123, 104, 157]
DEBUG_BIDS = ['2209', '2210', '2205']
ADULT_URL = f'{BASE_URL}/ctgtop_a/acode=4/'
GAMBLE_URL = f'{BASE_URL}/ctgtop_g/acode=4/'

req = urllib.request.Request(URL, headers=HEADERS)
with urllib.request.urlopen(req, timeout=15) as resp:
    html = resp.read().decode('utf-8', errors='replace')

# adult/gamble pages
def fetch(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=15) as resp:
        return resp.read().decode('utf-8', errors='replace')

adult_html = fetch(ADULT_URL)
gamble_html = fetch(GAMBLE_URL)

lines = []

def clean_text(s):
    s = re.sub(r'<[^>]+>', ' ', s)
    s = re.sub(r'\s+', ' ', s)
    return s.strip()

lines.append(f'URL: {URL}')
lines.append('')

# Categories
cat_re = re.compile(r'href="/bbstop/acode=(\d+)/ctgid=(\d+)/?"[^>]*>([\s\S]*?)</a>')
lines.append('--- Categories (all) ---')
cat_list = []
for m in cat_re.finditer(html):
    name = clean_text(m.group(3))
    cat_list.append((m.group(2), name))
for ctgid, name in cat_list:
    lines.append(f'ctgid={ctgid} name={name}')

lines.append('')
lines.append('--- Categories (koshinetsu filter) ---')
for ctgid, name in cat_list:
    if '甲信越' in name:
        lines.append(f'ctgid={ctgid} name={name}')

# Emulate parseAreaTop category de-dup + region name override
lines.append('')
lines.append('--- Categories (dedup w/ region override) ---')
region_name = '甲信越'
dedup = []
for ctgid, name in cat_list:
    existing = next((c for c in dedup if c['ctgid'] == ctgid), None)
    if not existing:
        dedup.append({'ctgid': ctgid, 'name': name})
    else:
        if region_name and (region_name in name) and (region_name not in existing['name']):
            existing['name'] = name
for c in dedup:
    lines.append(f"ctgid={c['ctgid']} name={c['name']}")

lines.append('')
lines.append('--- Has ctgid=104 after dedup ---')
ct104 = next((c for c in dedup if c['ctgid'] == '104'), None)
lines.append(str(ct104) if ct104 else '(missing)')

lines.append('')
lines.append('--- Restricted ctgids (adult/gamble) ---')
def collect_ctgids(src):
    out = []
    for m in cat_re.finditer(src):
        out.append(m.group(2))
    return out
adult_ctgids = collect_ctgids(adult_html)
gamble_ctgids = collect_ctgids(gamble_html)
lines.append(f'adult ctgids: {sorted(set(adult_ctgids))}')
lines.append(f'gamble ctgids: {sorted(set(gamble_ctgids))}')

# Boards
board_re = re.compile(r'href="/thr_tl/acode=(\d+)/ctgid=(\d+)/bid=(\d+)/?"[^>]*>([\s\S]*?)</a>')
lines.append('')
lines.append('--- Boards (filtered) ---')
for m in board_re.finditer(html):
    ctgid = m.group(2)
    name = clean_text(m.group(4))
    if any(k in name for k in ['高校野球', 'ドラフト', '山梨高校野球', '長野高校野球', '新潟高校野球', '甲信越']):
        lines.append(f'ctgid={ctgid} bid={m.group(3)} name={name}')

lines.append('')
lines.append('--- HTML contains "甲信越" snippet ---')
idx = html.find('甲信越')
if idx != -1:
    snippet = html[max(0, idx - 200):idx + 400]
    snippet = re.sub(r'\\s+', ' ', snippet)
    lines.append(snippet)
else:
    lines.append('(not found)')

# bbstop per ctgid
lines.append('')
lines.append('--- bbstop boards (ctgid) ---')
for ctgid in CTGIDS_TO_CHECK:
    url = f'{BASE_URL}/bbstop/acode=4/ctgid={ctgid}/'
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=15) as resp:
        h = resp.read().decode('utf-8', errors='replace')
    lines.append(f'ctgid={ctgid} url={url}')
    boards = []
    for m in board_re.finditer(h):
        name = clean_text(m.group(4))
        boards.append((m.group(3), name))
    lines.append(f'  boards_count={len(boards)}')
    for bid, name in boards[:30]:
        lines.append(f'  bid={bid} name={name}')

    # raw snippets for specific bids
    for bid in DEBUG_BIDS:
        idx = h.find(f'bid={bid}')
        if idx != -1:
            snippet = h[max(0, idx - 200):idx + 400]
            snippet = re.sub(r'\s+', ' ', snippet)
            lines.append(f'  RAW bid={bid}: {snippet}')

with open(OUT_FILE, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))
