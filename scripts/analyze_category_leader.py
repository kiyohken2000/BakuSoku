"""
「爆サイ.com カテゴリーダーの独り言」板の実態調査
- bid=5817 が全カテゴリで重複表示されているのか
- スレッド一覧は本当に空か
"""
import sys, re, urllib.request, html as html_mod
sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf-8', buffering=1, closefd=False)

UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

def fetch(url):
    req = urllib.request.Request(url, headers={
        'User-Agent': UA, 'Accept': 'text/html', 'Accept-Language': 'ja',
    })
    with urllib.request.urlopen(req, timeout=15) as res:
        return res.read().decode('utf-8', errors='replace'), res.geturl()

def strip_tags(s):
    return html_mod.unescape(re.sub(r'<[^>]+>', '', s))

# 複数カテゴリの bbstop で "カテゴリーダー" bid を収集
test_ctgids = [104, 148, 119, 157, 108, 103, 102, 126]
found_bids = {}

for ctgid in test_ctgids:
    url = f'https://bakusai.com/bbstop/acode=4/ctgid={ctgid}/'
    try:
        html, _ = fetch(url)
    except:
        continue
    # カテゴリーダー関連リンク
    for m in re.finditer(r'href="/thr_tl/[^"]*"[^>]*>([\s\S]*?)</a>', html):
        inner = m.group(1)
        text = strip_tags(inner).strip()
        if 'カテゴリ' in text and '独り言' in text:
            href_m = re.search(r'href="(/thr_tl/[^"]+)"', m.group(0))
            href = href_m.group(1) if href_m else ''
            bid_m = re.search(r'bid=(\d+)', href)
            bid = bid_m.group(1) if bid_m else '?'
            if bid not in found_bids:
                found_bids[bid] = []
            found_bids[bid].append(ctgid)
            # acode/ctgid も抽出
            acode_m = re.search(r'acode=(\d+)/ctgid=(\d+)/bid=', href)

print('=== カテゴリーダー板の bid 一覧 ===')
for bid, ctgids in found_bids.items():
    print(f'bid={bid}: {len(ctgids)}カテゴリで出現 → ctgids={ctgids}')

print()
print('=== 各 bid のスレッド一覧を確認 ===')
# acode=4/ctgid=156 がよく使われているようなので確認
test_bids = list(found_bids.keys()) or ['5817']
for bid in test_bids[:5]:
    # ctgid=156 で試す
    for ctgid in [156, 157]:
        url = f'https://bakusai.com/thr_tl/acode=4/ctgid={ctgid}/bid={bid}/'
        try:
            html, final_url = fetch(url)
            # スレ数
            tids = re.findall(r'data-tid="(\d+)"', html)
            title_m = re.search(r'<title>([^<]+)</title>', html)
            title = title_m.group(1).strip() if title_m else ''
            print(f'bid={bid} ctgid={ctgid}: スレ数={len(set(tids))}, title={title[:50]}')
            print(f'  URL={final_url}')
            if tids:
                # 最初のスレタイを表示
                thread_titles = re.findall(r'title="([^"]+)"[^>]*class="thr_status_icon', html)
                for t in thread_titles[:3]:
                    print(f'  スレ: {t[:50]}')
            break
        except Exception as e:
            print(f'bid={bid} ctgid={ctgid}: エラー {e}')

print()
print('=== 正確な href を bbstop から取得して直接アクセス ===')
html, _ = fetch('https://bakusai.com/bbstop/acode=4/ctgid=104/')
for m in re.finditer(r'href="(/thr_tl/[^"]+)"[^>]*>([\s\S]*?)</a>', html):
    href = m.group(1)
    text = strip_tags(m.group(2))
    if 'カテゴリ' in text and '独り言' in text:
        full_url = 'https://bakusai.com' + href
        try:
            thr_html, final_url = fetch(full_url)
            tids = re.findall(r'data-tid="(\d+)"', thr_html)
            title_m = re.search(r'<title>([^<]+)</title>', thr_html)
            title = title_m.group(1).strip() if title_m else ''
            print(f'href={href}')
            print(f'  スレ数={len(set(tids))}, title={title[:50]}')
            print(f'  最終URL={final_url}')
        except Exception as e:
            print(f'  エラー: {e}')
        break  # 1件だけ確認

print()
print('=== bid=5817 の正しい URL を特定 ===')
html5817_url = 'https://bakusai.com/thr_tl/acode=4/ctgid=156/bid=5817/'
try:
    html5817, final5817 = fetch(html5817_url)
    tids = re.findall(r'data-tid="(\d+)"', html5817)
    title_m = re.search(r'<title>([^<]+)</title>', html5817)
    print(f'URL: {html5817_url}')
    print(f'最終URL: {final5817}')
    print(f'スレ数: {len(set(tids))}')
    if title_m:
        print(f'title: {title_m.group(1).strip()}')
    # parseThreadList で使う data-tid を確認
    print(f'data-tid サンプル: {list(set(tids))[:5]}')
except Exception as e:
    print(f'エラー: {e}')
