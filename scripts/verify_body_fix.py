"""
修正後のパーサーロジックを Python で再現して rrid=18 の body を確認
"""
import io, re, sys, requests
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
HEADERS = {"User-Agent": UA, "Accept-Language": "ja,en-US;q=0.9,en;q=0.8"}

url = "https://bakusai.com/thr_res/acode=4/ctgid=137/bid=1177/tid=13179663/p=3/tp=1/rw=1/"
r = requests.get(url, headers=HEADERS, timeout=15)
r.encoding = "utf-8"
html = r.text

parts = re.split(r'(?=<li[^>]*id="res\d+_block")', html)

def parse_body_new(body_content):
    """div カウント方式で res_body の終端を検出"""
    body_end_idx = body_content.find('</div>')  # フォールバック
    depth = 1
    pos = 0
    while pos < len(body_content):
        next_open = body_content.find('<div', pos)
        next_close = body_content.find('</div>', pos)
        if next_close == -1:
            break
        if next_open != -1 and next_open < next_close:
            depth += 1
            pos = next_open + 4
        else:
            depth -= 1
            if depth == 0:
                body_end_idx = next_close
                break
            pos = next_close + 6

    raw = body_content[:body_end_idx]
    # >>N アンカー変換
    raw = re.sub(r'<br\s*/?>', '\n', raw, flags=re.IGNORECASE)
    raw = re.sub(r'<a[^>]*>&gt;&gt;(\d+)</a>', r'>>\1', raw)
    raw = re.sub(r'<[^>]+>', '', raw)
    raw = raw.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>').replace('&quot;', '"').replace('&nbsp;', ' ')
    lines = [l.strip() for l in raw.split('\n')]
    lines = [l for l in lines if l and '画像拡大' not in l]
    return '\n'.join(lines).strip()

for part in parts:
    m = re.match(r'<li[^>]*id="res(\d+)_block"', part)
    if not m:
        continue
    rrid = m.group(1)
    body_marker = 'class="res_body"'
    bs = part.find(body_marker)
    if bs == -1:
        continue
    after = part.find('>', bs) + 1
    body_content = part[after:]

    print(f"rrid={rrid}: {parse_body_new(body_content)!r}")
