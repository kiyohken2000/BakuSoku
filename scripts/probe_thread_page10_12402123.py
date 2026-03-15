import pathlib, re
import requests

BASE = "https://bakusai.com"
acode=4; ctgid=103; bid=257; tid=12402123
page=10
UA_MOBILE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"

headers={"User-Agent":UA_MOBILE,"Accept-Language":"ja,en-US;q=0.9,en;q=0.8","Referer":f"{BASE}/thr_tl/acode={acode}/ctgid={ctgid}/bid={bid}/"}
url = f"{BASE}/thr_res/acode={acode}/ctgid={ctgid}/bid={bid}/tid={tid}/p={page}/tp=1/"
html = requests.get(url, headers=headers).text

idx = html.find('class="paging_nex_res_and_button"')
print('paging idx', idx)
if idx != -1:
    snippet = html[idx:idx+2500]
    m = re.search(r'href="([^\"]*\/thr_res\/[^\"]+)"', snippet)
    print('paging href', m.group(1) if m else None)
    print('snippet len', len(snippet))
    # check distance to href in full html
    m2 = re.search(r'class="paging_nex_res_and_button"[\s\S]*?href="([^\"]*\/thr_res\/[^\"]+)"', html)
    if m2:
        span = m2.start(), m2.end()
        print('match span', span, 'len', span[1]-span[0])

# see if any tid links include p=11
links = re.findall(r'href="([^\"]*thr_res[^\"]*)"', html)
links = [l for l in links if f'tid={tid}' in l]
print('has p=11', any('/p=11/' in l for l in links))
