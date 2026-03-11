"""
成人/ギャンブルカテゴリの ctgtop_a エンドポイントを調査
"""
import sys, re, urllib.request, html as html_mod
sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf-8', buffering=1, closefd=False)

UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

def fetch(url):
    req = urllib.request.Request(url, headers={
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
    })
    with urllib.request.urlopen(req, timeout=15) as res:
        return res.read().decode('utf-8', errors='replace'), res.geturl()

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

# areatop の成人/ギャンブルリンクを正確に抽出
print('=== areatop の特殊カテゴリリンク ===')
html, _ = fetch('https://bakusai.com/areatop/acode=4/')
special_links = re.findall(r'href="(/ctgtop[^"]+)"', html)
print(f'ctgtop リンク数: {len(special_links)}')
for link in special_links:
    print(f'  {link}')

# ctgtop_a を調査
test_urls = []
for link in set(special_links):
    test_urls.append(('https://bakusai.com' + link, link))

# 推測でギャンブルも試す
extra = ['/ctgtop_g/acode=4/', '/ctgtop_b/acode=4/', '/ctgtop_c/acode=4/']
for e in extra:
    if e not in [l for _, l in test_urls]:
        test_urls.append(('https://bakusai.com' + e, e))

print()
for url, label in test_urls:
    print(f'=== {label} ===')
    try:
        h, final_url = fetch(url)
        print(f'最終URL: {final_url}')
        print(f'サイズ: {len(h):,} bytes')
        title_m = re.search(r'<title>([^<]+)</title>', h)
        if title_m:
            print(f'title: {title_m.group(1).strip()}')

        # bbstop リンク (カテゴリ)
        cat_links = re.findall(r'href="(/bbstop/acode=\d+/ctgid=(\d+)/?)"', h)
        seen_c = set()
        cats = []
        for href, ctgid in cat_links:
            if ctgid not in seen_c:
                seen_c.add(ctgid)
                cats.append((ctgid, href))
        print(f'bbstop カテゴリリンク数: {len(cats)}')
        for ctgid, href in cats[:15]:
            # カテゴリ名取得
            pos = h.find(href)
            ctx = h[pos:pos+300]
            alt_m = re.search(r'alt="([^"]+)"', ctx)
            name = alt_m.group(1) if alt_m else strip_tags(ctx[:100]).strip()[:30]
            print(f'  ctgid={ctgid}: {name[:40]}')

        # 板リンク (thr_tl)
        board_pattern = r'href="/thr_tl/acode=(\d+)/ctgid=(\d+)/bid=(\d+)/?"[^>]*>([\s\S]*?)</a>'
        boards = []
        for m in re.finditer(board_pattern, h):
            name = clean_board_name(extract_board_name(m.group(4)))
            if name:
                boards.append((m.group(2), m.group(3), name))
        print(f'直接板リンク数: {len(boards)}')
        for ctgid, bid, name in boards[:10]:
            print(f'  ctgid={ctgid} bid={bid}: {name}')

    except Exception as e:
        print(f'エラー: {e}')
    print()
