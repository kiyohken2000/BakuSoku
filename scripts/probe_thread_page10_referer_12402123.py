import requests
import re

BASE = "https://bakusai.com"
acode=4; ctgid=103; bid=257; tid=12402123
page=10
UA_MOBILE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"


def fetch(with_referer):
    headers={"User-Agent":UA_MOBILE,"Accept-Language":"ja,en-US;q=0.9,en;q=0.8"}
    if with_referer:
        headers["Referer"] = f"{BASE}/thr_tl/acode={acode}/ctgid={ctgid}/bid={bid}/"
    url = f"{BASE}/thr_res/acode={acode}/ctgid={ctgid}/bid={bid}/tid={tid}/p={page}/tp=1/"
    return requests.get(url, headers=headers).text


def summarize(html):
    res_blocks = len(re.findall(r'<li\s+id="res\d+_block"', html))
    paging = bool(re.search(r'class="paging_nex_res_and_button"', html))
    return res_blocks, paging

h1 = fetch(True)
h2 = fetch(False)
print('with referer', summarize(h1))
print('without referer', summarize(h2))
