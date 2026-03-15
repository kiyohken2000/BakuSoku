import os
import re
import requests

BASE = "https://bakusai.com"
acode = 4
ctgid = 103
bid = 257
tid = 12402123
page = 11

UA_MOBILE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"

out_dir = os.path.join("scripts", "_out")
os.makedirs(out_dir, exist_ok=True)

path = f"/thr_res/acode={acode}/ctgid={ctgid}/bid={bid}/tid={tid}/p={page}/tp=1/"
url = BASE + path
headers = {
    "User-Agent": UA_MOBILE,
    "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
    "Referer": f"{BASE}/thr_tl/acode={acode}/ctgid={ctgid}/bid={bid}/",
}
html = requests.get(url, headers=headers).text

fname = f"{tid}_normal_p{page}_mobile.html"
with open(os.path.join(out_dir, fname), "w", encoding="utf-8") as f:
    f.write(html)

res_blocks = len(re.findall(r'<li\s+id="res\d+_block"', html))
print('res_blocks', res_blocks)

# title
m = re.search(r'<title[^>]*>([\s\S]*?)</title>', html, re.I)
if m:
    title = re.sub(r'\s+', ' ', m.group(1).strip())
    print('title', title.encode('ascii', errors='backslashreplace').decode('ascii'))

# paging link
m = re.search(r'class="paging_nex_res_and_button"[\s\S]{0,2000}?href="([^"]*\/thr_res\/[^"]+)"', html)
print('paging link', m.group(1) if m else None)

# tid links and page numbers
links = re.findall(r'href="([^\"]*thr_res[^\"]*)"', html)
links = [l for l in links if f'tid={tid}' in l]

pages = set()
for l in links:
    pm = re.search(r'/p=(\d+)/tp=1/', l)
    if pm:
        pages.add(int(pm.group(1)))
print('page numbers in links', sorted(pages)[:20])

