import requests
import re

BASE = "https://bakusai.com"
acode = 4
ctgid = 103
bid = 257
tid = 12402123

UA_MOBILE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"


def fetch(path):
    url = BASE + path
    headers = {
        "User-Agent": UA_MOBILE,
        "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
        "Referer": f"{BASE}/thr_tl/acode={acode}/ctgid={ctgid}/bid={bid}/",
    }
    r = requests.get(url, headers=headers)
    return r.text


def count_responses(html):
    return len(re.findall(r'<li\s+id="res\d+_block"', html))


def find_next_normal(html):
    m = re.search(r'class="paging_nex_res_and_button"[\s\S]{0,2000}?href="([^"]*\/thr_res\/[^"]+)"', html)
    if not m:
        return None
    href = m.group(1)
    m2 = re.search(r'/p=(\d+)/tp=1/(?!rw)', href)
    return int(m2.group(1)) if m2 else None


def main():
    page = 1
    seen = 0
    for _ in range(1, 15):
        path = f"/thr_res/acode={acode}/ctgid={ctgid}/bid={bid}/tid={tid}/p={page}/tp=1/" if page != 1 else f"/thr_res/acode={acode}/ctgid={ctgid}/bid={bid}/tid={tid}/tp=1/"
        html = fetch(path)
        cnt = count_responses(html)
        nxt = find_next_normal(html)
        print(f"page {page}: responses={cnt}, next_normal={nxt}")
        seen += cnt
        if not nxt or nxt == page:
            break
        page = nxt
    print(f"seen_total (sum of page counts) = {seen}")


if __name__ == "__main__":
    main()
