"""
areatop の全カテゴリを確認 + 成人/ギャンブルカテゴリの調査
"""
import sys, re, urllib.request, html as html_mod
sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf-8', buffering=1, closefd=False)

UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

def fetch(url, cookies=''):
    headers = {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
    }
    if cookies:
        headers['Cookie'] = cookies
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=15) as res:
        body = res.read().decode('utf-8', errors='replace')
        # set-cookie を取得
        sc = res.getheader('set-cookie', '')
        return body, sc

def strip_tags(s):
    return html_mod.unescape(re.sub(r'<[^>]+>', '', s))

# --- areatop を取得 ---
print('=== areatop acode=4 の全カテゴリ ===')
html, sc = fetch('https://bakusai.com/areatop/acode=4/')
print(f'set-cookie: {sc[:80] if sc else "(なし)"}')

# bbstop リンクを全抽出
bbstop_links = re.findall(r'href="(/bbstop/acode=(\d+)/ctgid=(\d+)/?)"', html)
seen_ctgid = set()
categories = []
for href, acode, ctgid in bbstop_links:
    if ctgid not in seen_ctgid:
        seen_ctgid.add(ctgid)
        # リンク周辺からカテゴリ名を取得
        pos = html.find(href)
        ctx = html[pos:pos+500]
        # alt 属性から名前
        alt_m = re.search(r'alt="([^"]+)"', ctx)
        # article タグ内テキスト
        article_m = re.search(r'<article[^>]*>([\s\S]*?)</article>', ctx)
        name = ''
        if alt_m:
            name = alt_m.group(1)
        elif article_m:
            name = strip_tags(article_m.group(1)).strip()[:30]
        categories.append((int(acode), int(ctgid), name, href))

print(f'カテゴリ数: {len(categories)}')
for acode, ctgid, name, href in categories:
    print(f'  ctgid={ctgid:4d}: {name[:40]}')

# --- 成人・ギャンブル系を検索 ---
print()
print('=== 成人/ギャンブル関連キーワードの検索 ===')
keywords = ['成人', 'アダルト', '18禁', 'ギャンブル', 'パチンコ', '競馬', 'カジノ', 'adult', 'R18']
for kw in keywords:
    count = html.count(kw)
    if count:
        # 付近のコンテキスト
        pos = html.find(kw)
        ctx = html[max(0, pos-50):pos+100]
        print(f'  "{kw}": {count}回 → {repr(strip_tags(ctx).strip()[:60])}')
    else:
        print(f'  "{kw}": 0回')

# --- bbstop ページに age_check や認証があるか確認 ---
print()
print('=== 成人向けページのアクセス確認 ===')
# 既知の成人向けカテゴリ ctgid を試す (一般的なサイトの構造)
# まずは全 ctgid を bbstop でフェッチしてカテゴリ名を確認
# areatop に含まれない ctgid があるかも

# カテゴリ名に「成人」「ギャンブル」が含まれるか areatop の HTML 全体検索
adult_pos = [(m.start(), m.group()) for m in re.finditer(r'成人|ギャンブル|パチンコ|競馬|エロ|18禁|adult', html, re.IGNORECASE)]
print(f'areatop HTML 内の関連ワード: {len(adult_pos)}件')
for pos, word in adult_pos[:10]:
    ctx = html[max(0, pos-80):pos+120]
    href_m = re.search(r'href="([^"]+)"', ctx)
    print(f'  "{word}" → href={href_m.group(1) if href_m else "なし"} ctx={repr(strip_tags(ctx).strip()[:60])}')

# areatop の別エンドポイントを試す
print()
print('=== 別エンドポイント試行 ===')
alt_urls = [
    'https://bakusai.com/areatop/acode=4/cate=adult/',
    'https://bakusai.com/areatop/acode=4/?age=1',
    'https://bakusai.com/bbstop/acode=4/ctgid=100/',  # よくある成人 ctgid
    'https://bakusai.com/bbstop/acode=4/ctgid=101/',
    'https://bakusai.com/bbstop/acode=4/ctgid=102/',
    'https://bakusai.com/bbstop/acode=4/ctgid=103/',
]
for url in alt_urls:
    try:
        h, _ = fetch(url)
        board_count = len(re.findall(r'href="/thr_tl/acode=\d+/ctgid=\d+/bid=\d+/', h))
        redirect_note = '(別URL?)' if url not in h else ''
        print(f'  {url}')
        print(f'    → 板リンク数={board_count}, サイズ={len(h):,}bytes {redirect_note}')
        # カテゴリ名らしきもの
        title_m = re.search(r'<title>([^<]+)</title>', h)
        if title_m:
            print(f'    title: {title_m.group(1).strip()[:60]}')
    except Exception as e:
        print(f'  {url} → エラー: {e}')

# --- areatop HTML に age_check フォームがあるか確認 ---
print()
print('=== age_check / 年齢確認フォームの確認 ===')
age_keys = ['age_check', 'age_confirm', 'agecheck', 'age_gate', '年齢確認', '成人確認']
for kw in age_keys:
    if kw in html:
        pos = html.find(kw)
        ctx = html[max(0, pos-50):pos+150]
        print(f'  "{kw}" 発見: {repr(ctx[:150])}')
    else:
        print(f'  "{kw}": なし')
