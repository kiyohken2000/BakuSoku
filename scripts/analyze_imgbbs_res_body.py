"""
imagebbs 系スレの画像付きレス HTML 構造調査
対象: https://bakusai.com/thr_res/acode=4/ctgid=137/bid=1177/tid=13179663/tp=1/
"""
import io, re, sys, requests
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
HEADERS = {"User-Agent": UA, "Accept-Language": "ja,en-US;q=0.9,en;q=0.8"}
r = requests.get("https://bakusai.com/thr_res/acode=4/ctgid=137/bid=1177/tid=13179663/tp=1/", headers=HEADERS, timeout=15)
r.encoding = "utf-8"
html = r.text

# res18_block を探す
m = re.search(r'<li[^>]*id="res18_block"[^>]*>([\s\S]*?)</li>', html)
if not m:
    # </li>で終わらない可能性
    idx = html.find('id="res18_block"')
    if idx != -1:
        end = html.find('<li ', idx + 1)
        print("--- res18_block (次の<li>まで) ---")
        print(html[idx: end if end != -1 else idx+3000])
    else:
        print("res18_block が見つかりません")
else:
    print("--- res18_block ---")
    print(m.group(0)[:3000])

print()
print("=" * 60)
print("res_body クラスの出現パターン (全レス)")
print("=" * 60)

# res_body の直後の構造を確認
for m2 in re.finditer(r'class="res_body"[^>]*>([\s\S]{0,800}?)</div>', html):
    inner = m2.group(1)
    if 'img' in inner.lower() or '画像' in inner:
        print(f"\n--- 画像含む res_body ---")
        print(inner[:600])
        print("...</div>")
        break
