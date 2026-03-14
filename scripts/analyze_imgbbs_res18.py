"""
rrid=18 の画像付きレス HTML 構造調査
"""
import io, re, sys, requests
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
HEADERS = {"User-Agent": UA, "Accept-Language": "ja,en-US;q=0.9,en;q=0.8"}

url = "https://bakusai.com/thr_res/acode=4/ctgid=137/bid=1177/tid=13179663/p=2/tp=1/rw=1/"
r = requests.get(url, headers=HEADERS, timeout=15)
r.encoding = "utf-8"
html = r.text

rrids = re.findall(r'<li[^>]*id="res(\d+)_block"', html)
print(f"このページの rrid: {rrids}")

# rrid=18 の全 li ブロック
parts = re.split(r'(?=<li[^>]*id="res\d+_block")', html)
for part in parts:
    rrid_m = re.match(r'<li[^>]*id="res(\d+)_block"', part)
    if not rrid_m or rrid_m.group(1) != '18':
        continue
    print()
    print("=" * 60)
    print("rrid=18 full block")
    print("=" * 60)
    print(part[:3000])

    # 現行パーサーの body 抽出をシミュレート
    print()
    print("=" * 60)
    print("現行パーサーの body 抽出シミュレート")
    print("=" * 60)
    body_marker = 'class="res_body"'
    body_start = part.find(body_marker)
    if body_start != -1:
        after = part.find('>', body_start) + 1
        body_content = part[after:]
        body_end = body_content.find('</div>')
        print(f"bodyEnd index: {body_end}")
        raw = body_content[:body_end]
        print(f"抽出 raw:\n{raw}")
        print(f"\n</div>以降 300文字:\n{body_content[body_end:body_end+300]}")
