"""
PC UA と Mobile UA の差を調査
1. スレッド詳細: レス件数・ページ構造
2. areatop: カテゴリ/板リンクの量
3. スクレイピング対策の有無
"""
import sys, re, urllib.request, urllib.error
sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf-8', buffering=1, closefd=False)

PC_UA   = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
MOB_UA  = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

THREAD_URL   = 'https://bakusai.com/thr_res/acode=4/ctgid=157/bid=5813/tid=13030722/tp=1/'
THREAD_RW1   = 'https://bakusai.com/thr_res/acode=4/ctgid=157/bid=5813/tid=13030722/tp=1/rw=1/'
AREATOP_URL  = 'https://bakusai.com/areatop/acode=4/'

def fetch(url, ua):
    req = urllib.request.Request(url, headers={
        'User-Agent': ua,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            return res.read().decode('utf-8', errors='replace'), res.geturl()
    except urllib.error.HTTPError as e:
        return None, f'HTTP {e.code}'
    except Exception as e:
        return None, str(e)

def count_pattern(html, pattern):
    return len(re.findall(pattern, html))

def first_match(html, pattern):
    m = re.search(pattern, html)
    return m.group(1).strip() if m else '(not found)'

print('=' * 60)
print('1. スレッド詳細 (通常モード)')
print('=' * 60)
for label, ua in [('MOBILE', MOB_UA), ('PC', PC_UA)]:
    html, final_url = fetch(THREAD_URL, ua)
    if html is None:
        print(f'{label}: エラー → {final_url}')
        continue
    res_count = count_pattern(html, r'<li\s+id="res')
    has_js_load = 'ajax' in html.lower() or 'lazyload' in html.lower() or 'fetch(' in html
    paging = first_match(html, r'paging_nex_res_and_button[\s\S]{0,400}?href="([^"]+)"')
    print(f'{label}: レス数={res_count}, JS依存={has_js_load}, 次ページ={paging[:60]}')
    print(f'  最終URL={final_url}')

print()
print('=' * 60)
print('2. スレッド詳細 (rw=1 最初から)')
print('=' * 60)
for label, ua in [('MOBILE', MOB_UA), ('PC', PC_UA)]:
    html, final_url = fetch(THREAD_RW1, ua)
    if html is None:
        print(f'{label}: エラー → {final_url}')
        continue
    res_count = count_pattern(html, r'<li\s+id="res')
    has_js_load = 'ajax' in html.lower() or 'lazyload' in html.lower() or 'fetch(' in html
    paging = first_match(html, r'paging_nex_res_and_button[\s\S]{0,400}?href="([^"]+)"')
    print(f'{label}: レス数={res_count}, JS依存={has_js_load}, 次ページ={paging[:60]}')
    print(f'  最終URL={final_url}')

print()
print('=' * 60)
print('3. areatop (板一覧) acode=4')
print('=' * 60)
for label, ua in [('MOBILE', MOB_UA), ('PC', PC_UA)]:
    html, final_url = fetch(AREATOP_URL, ua)
    if html is None:
        print(f'{label}: エラー → {final_url}')
        continue
    cat_count   = count_pattern(html, r'href="/bbstop/acode=\d+/ctgid=\d+/')
    board_count = count_pattern(html, r'href="/thr_tl/acode=\d+/ctgid=\d+/bid=\d+/')
    has_js_load = 'ajax' in html.lower() or 'fetch(' in html
    print(f'{label}: カテゴリリンク={cat_count}, 板リンク={board_count}, JS依存={has_js_load}')
    print(f'  最終URL={final_url}')
    # 最初の板リンクを数個サンプル表示
    samples = re.findall(r'href="(/thr_tl/[^"]+)"[^>]*>([^<]+)', html)[:5]
    for href, name in samples:
        print(f'  例: {name.strip()[:30]} → {href}')

print()
print('=' * 60)
print('4. リダイレクト確認 (PC UAでモバイル向けURLが変わるか)')
print('=' * 60)
html_m, url_m = fetch(AREATOP_URL, MOB_UA)
html_p, url_p = fetch(AREATOP_URL, PC_UA)
print(f'MOBILE 最終URL: {url_m}')
print(f'PC     最終URL: {url_p}')
same = (url_m == url_p)
print(f'同じURL: {same}')
if html_m and html_p:
    print(f'MOBILE HTML size: {len(html_m):,} bytes')
    print(f'PC     HTML size: {len(html_p):,} bytes')
