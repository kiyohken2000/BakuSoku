"""
rrid=18 の imageUrl 抽出確認
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
for part in parts:
    m = re.match(r'<li[^>]*id="res(\d+)_block"', part)
    if not m:
        continue
    rrid = m.group(1)
    # res_img から data-original 抽出
    res_img_idx = part.find('class="res_img"')
    image_url = None
    if res_img_idx != -1:
        area = part[res_img_idx:res_img_idx+1000]
        mo = re.search(r'data-original="([^"]+)"', area)
        if mo:
            image_url = mo.group(1)
    if image_url:
        print(f"rrid={rrid}: imageUrl = {image_url}")
