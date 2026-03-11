"""
bbstop の板名HTML構造を詳細調査 (改良版)
"""
import sys, re, urllib.request, urllib.error, html as html_mod
sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf-8', buffering=1, closefd=False)

UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

def fetch(url):
    req = urllib.request.Request(url, headers={
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
    })
    with urllib.request.urlopen(req, timeout=15) as res:
        return res.read().decode('utf-8', errors='replace')

def strip_tags(s):
    return re.sub(r'<[^>]+>', '', s)

# --- Step 1: areatop の生HTMLから bbstop リンクを確認 ---
print('=== Step 1: areatop の bbstop リンク構造 ===')
top_html = fetch('https://bakusai.com/areatop/acode=4/')
# bbstop リンクを前後50文字付きで抽出
bbstop_hits = [(m.start(), m.group()) for m in re.finditer(r'bbstop[^"<]{0,80}', top_html)]
print(f'bbstop 出現回数: {len(bbstop_hits)}')
for pos, hit in bbstop_hits[:5]:
    ctx = top_html[max(0, pos-20):pos+120]
    print(f'  {repr(ctx)}')

# thr_tl リンク (板リンク) も確認
tl_hits = [(m.start(), m.group()) for m in re.finditer(r'/thr_tl/[^"]{0,80}', top_html)]
print(f'\nthr_tl 出現回数: {len(tl_hits)}')
for pos, hit in tl_hits[:5]:
    ctx = top_html[max(0, pos-30):pos+150]
    print(f'  {repr(ctx)}')

# --- Step 2: 既知の公務員カテゴリ ctgid を特定 ---
# スクリーンショットで見えたカテゴリ: 政治・経済, 公務員, 美容
# areatop の href パターンを緩く検索
print('\n=== Step 2: カテゴリリンク一覧 ===')
cat_pattern = re.findall(r'href="(/bbstop/[^"]+)"', top_html)
print(f'カテゴリリンク数: {len(cat_pattern)}')
for href in cat_pattern[:20]:
    print(f'  {href}')

print('\n=== Step 3: 板リンク一覧 (areatop から) ===')
board_pattern = re.findall(r'href="(/thr_tl/[^"]+)"', top_html)
print(f'板リンク数: {len(board_pattern)}')
for href in board_pattern[:10]:
    print(f'  {href}')

# --- Step 3: 最初のカテゴリの bbstop を直接調査 ---
if cat_pattern:
    first_cat_url = 'https://bakusai.com' + cat_pattern[0]
    print(f'\n=== Step 4: bbstop 詳細調査 ({first_cat_url}) ===')
    bb_html = fetch(first_cat_url)
    print(f'HTML size: {len(bb_html):,} bytes')

    # thr_tl リンクを全抽出 (前後コンテキスト付き)
    tl_links = list(re.finditer(r'href="/thr_tl/[^"]*"', bb_html))
    print(f'板リンク数: {len(tl_links)}')

    for i, m in enumerate(tl_links[:8]):
        pos = m.start()
        # リンクの前後 300 文字を取得
        ctx = bb_html[max(0, pos-10):pos+300]
        # <a ... > ～ </a> を探す
        a_match = re.search(r'<a[^>]+href="/thr_tl/[^"]*"[^>]*>([\s\S]*?)</a>', ctx)
        if a_match:
            inner = a_match.group(1)
            raw_text = strip_tags(inner)
            decoded = html_mod.unescape(raw_text)
            print(f'\n  [{i+1}] href={m.group()[:60]}')
            print(f'  inner HTML: {repr(inner[:200])}')
            print(f'  raw_text: {repr(raw_text[:100])}')
            print(f'  decoded: {repr(decoded[:100])}')
        else:
            print(f'\n  [{i+1}] href={m.group()[:60]}')
            print(f'  context: {repr(ctx[:200])}')

# --- Step 4: 公務員カテゴリを特定して詳細調査 ---
# ctgid が分かれば専用フェッチ
# areatop から ctgid を検索
ctgid_map = {}
for m in re.finditer(r'href="/bbstop/acode=(\d+)/ctgid=(\d+)/', top_html):
    # その付近のテキストでカテゴリ名を取る
    pos = m.end()
    name_area = top_html[pos:pos+100]
    name_match = re.search(r'>([^<]{1,30})</a>', top_html[m.start():m.start()+200])
    name = strip_tags(name_match.group(1)).strip() if name_match else '?'
    ctgid_map[m.group(2)] = {'acode': m.group(1), 'name': name}

print('\n=== Step 5: areatop から抽出したカテゴリ一覧 ===')
for ctgid, info in list(ctgid_map.items())[:20]:
    print(f'  ctgid={ctgid}: {info["name"]}')

# 全カテゴリの bbstop を調べて絵文字板を集計
print('\n=== Step 6: 絵文字板の統計 (全カテゴリ) ===')
emoji_only_count = 0
total_count = 0
emoji_examples = []

for ctgid, info in list(ctgid_map.items())[:15]:
    url = f'https://bakusai.com/bbstop/acode={info["acode"]}/ctgid={ctgid}/'
    try:
        bb_html = fetch(url)
    except:
        continue

    for m in re.finditer(r'<a[^>]+href="/thr_tl/[^"]*"[^>]*>([\s\S]*?)</a>', bb_html):
        inner = m.group(1)
        raw_text = strip_tags(inner)
        decoded = html_mod.unescape(raw_text).strip()
        # 改行を正規化
        lines = [l.strip() for l in decoded.split('\n') if l.strip()]
        first_line = lines[0] if lines else ''

        total_count += 1
        has_cjk = bool(re.search(r'[\u3040-\u9fff\u4e00-\u9fff]', first_line))
        if not has_cjk and first_line:
            emoji_only_count += 1
            if len(emoji_examples) < 5:
                emoji_examples.append({
                    'cat': info['name'],
                    'first_line': first_line,
                    'all_lines': lines,
                    'inner_html': inner[:300],
                })

print(f'総板数: {total_count}, 絵文字のみ(CJK無し): {emoji_only_count}')
print()
for ex in emoji_examples:
    print(f'カテゴリ: {ex["cat"]}')
    print(f'first_line: {repr(ex["first_line"])}')
    print(f'all_lines:  {repr(ex["all_lines"][:5])}')
    print(f'inner_html: {repr(ex["inner_html"])}')
    print()
