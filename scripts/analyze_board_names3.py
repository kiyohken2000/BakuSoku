"""
残った絵文字のみ板の実際のHTML構造を詳細表示
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

# 公務員カテゴリ (最も問題が多い) を詳しく調査
url = 'https://bakusai.com/bbstop/acode=4/ctgid=119/'
html = fetch(url)

print(f'HTML size: {len(html):,} bytes')
print()

# 全 /thr_tl/ リンクを抽出して inner HTML を表示
pattern = r'href="/thr_tl/acode=(\d+)/ctgid=(\d+)/bid=(\d+)/?"[^>]*>([\s\S]*?)</a>'
matches = list(re.finditer(pattern, html))
print(f'板リンク数: {len(matches)}')

for i, m in enumerate(matches[:15]):
    inner = m.group(4)
    has_brd_name = 'brdName' in inner
    has_list_numb = 'listNumb' in inner
    text = strip_tags(inner)
    lines = [l.strip() for l in text.split('\n') if l.strip()]

    print(f'\n[{i+1}] bid={m.group(3)}, brdName={has_brd_name}, listNumb={has_list_numb}')
    print(f'  inner_html: {repr(inner[:400])}')
    print(f'  lines: {lines[:5]}')

# title 属性も確認
print('\n\n=== title 属性の確認 ===')
# <a href="/thr_tl/..." に title 属性がある場合
title_pattern = r'<a[^>]+href="/thr_tl/[^"]*"[^>]*title="([^"]*)"[^>]*>'
titles = re.findall(title_pattern, html)
print(f'title属性を持つリンク数: {len(titles)}')
for t in titles[:10]:
    print(f'  {t}')

# aria-label も確認
aria_pattern = r'<a[^>]+href="/thr_tl/[^"]*"[^>]*aria-label="([^"]*)"'
arias = re.findall(aria_pattern, html)
print(f'\naria-label属性を持つリンク数: {len(arias)}')
for a in arias[:10]:
    print(f'  {a}')

# 直前の別タグに名前が入ってるケースを確認
# 絵文字板の前後コンテキストを表示
print('\n\n=== 絵文字のみ板の前後コンテキスト (bid=2件) ===')
emoji_count = 0
for m in matches:
    inner = m.group(4)
    text = strip_tags(inner)
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    first = lines[0] if lines else ''
    has_cjk = bool(re.search(r'[\u3040-\u9fff\u4e00-\u9fff]', first))
    has_ascii = bool(re.search(r'[a-zA-Z0-9]', first))
    if not has_cjk and not has_ascii and first and emoji_count < 3:
        pos = m.start()
        ctx_before = html[max(0, pos-300):pos]
        ctx_after = html[m.end():m.end()+300]
        print(f'\nbid={m.group(3)}, first_line={repr(first)}')
        print(f'前コンテキスト: {repr(ctx_before[-200:])}')
        print(f'inner_html: {repr(inner[:300])}')
        print(f'後コンテキスト: {repr(ctx_after[:200])}')
        emoji_count += 1

# 板名が別の要素に入ってないか li ベースで探す
print('\n\n=== liベースの板名構造 ===')
li_pattern = r'<li[^>]*class="[^"]*bbstop[^"]*"[^>]*>([\s\S]*?)</li>'
li_items = re.findall(li_pattern, html)
print(f'bbstop li items: {len(li_items)}')
for item in li_items[:5]:
    print(f'\n  {repr(item[:400])}')
