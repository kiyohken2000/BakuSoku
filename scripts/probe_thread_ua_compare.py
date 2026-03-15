import requests
import re

BASE = "https://bakusai.com"
acode = 4
ctgid = 103
bid = 257
tid = 13129341

UA_MOBILE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
UA_PC = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"


def fetch(path, ua):
    url = BASE + path
    headers = {
        "User-Agent": ua,
        "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
        "Referer": f"{BASE}/thr_tl/acode={acode}/ctgid={ctgid}/bid={bid}/",
    }
    r = requests.get(url, headers=headers)
    return r.text


def count_responses(html):
    return len(re.findall(r'<li\s+id="res\d+_block"', html))


def get_total_from_title(html):
    m = re.search(r'<title>[^<]*?(\d+)レス', html)
    return int(m.group(1)) if m else None


def find_next_rw1(html):
    m = re.search(r'class="paging_nex_res_and_button"[\s\S]{0,2000}?href="([^"]*\/thr_res\/[^"]+)"', html)
    if not m:
        return None
    href = m.group(1)
    m2 = re.search(r'/p=(\d+)/tp=1/rw=1/', href)
    return int(m2.group(1)) if m2 else None


def probe(ua_label, ua):
    print(f"=== {ua_label} ===")
    page = 1
    seen_total = 0
    while True:
        path = f"/thr_res/acode={acode}/ctgid={ctgid}/bid={bid}/tid={tid}/p={page}/tp=1/rw=1/" if page != 1 else f"/thr_res/acode={acode}/ctgid={ctgid}/bid={bid}/tid={tid}/tp=1/rw=1/"
        html = fetch(path, ua)
        cnt = count_responses(html)
        total = get_total_from_title(html)
        next_p = find_next_rw1(html)
        print(f"page {page}: responses={cnt}, title_total={total}, next_rw1={next_p}")
        seen_total += cnt
        if next_p is None or next_p == page or page >= 5:
            break
        page = next_p
    print(f"seen_total (sum of page counts) = {seen_total}")
    print()


probe("MOBILE", UA_MOBILE)
probe("PC", UA_PC)
