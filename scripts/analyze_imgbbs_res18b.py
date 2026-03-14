"""
rrid=18 のページを探す + 構造調査
"""
import io, re, sys, requests
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
HEADERS = {"User-Agent": UA, "Accept-Language": "ja,en-US;q=0.9,en;q=0.8"}
BASE = "https://bakusai.com/thr_res/acode=4/ctgid=137/bid=1177/tid=13179663"

target_rrid = '18'
found_html = None

for page in range(1, 10):
    url = f"{BASE}/p={page}/tp=1/rw=1/"
    r = requests.get(url, headers=HEADERS, timeout=15)
    r.encoding = "utf-8"
    html = r.text
    rrids = re.findall(r'<li[^>]*id="res(\d+)_block"', html)
    print(f"page={page}: rrid={rrids}")
    if target_rrid in rrids:
        found_html = html
        print(f"  → rrid={target_rrid} 発見!")
        break
    if not rrids or rrids == ['00', '0']:
        print("  → 終端")
        break

if not found_html:
    print(f"\nrrid={target_rrid} が見つかりませんでした")
    sys.exit(0)

# rrid=18 の構造解析
parts = re.split(r'(?=<li[^>]*id="res\d+_block")', found_html)
for part in parts:
    rrid_m = re.match(r'<li[^>]*id="res(\d+)_block"', part)
    if not rrid_m or rrid_m.group(1) != target_rrid:
        continue

    print()
    print("=" * 60)
    print(f"rrid={target_rrid} の res_body 周辺")
    print("=" * 60)

    body_start = part.find('class="res_body"')
    if body_start == -1:
        print("res_body なし")
        continue

    after = part.find('>', body_start) + 1
    body_content = part[after:]

    # 現行パーサー: 最初の </div> で切る
    body_end = body_content.find('</div>')
    print(f"[現行] 最初の </div> まで (index={body_end}):")
    print(repr(body_content[:body_end]))

    print()
    print("[全文] res_body の内容 (1200文字):")
    print(body_content[:1200])

    # res_img や画像リンクを検索
    print()
    print("res_img / img タグ:")
    for tag in re.findall(r'<(?:div[^>]*class="res_img[^"]*"[^>]*>|img[^>]+>)', body_content[:1200]):
        print(f"  {tag[:200]}")
