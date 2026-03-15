import os
import re
import requests

BASE = "https://bakusai.com"
acode = 4
ctgid = 103
bid = 257
tid = 12402123

UA_MOBILE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
UA_PC = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"

out_dir = os.path.join("scripts", "_out")
os.makedirs(out_dir, exist_ok=True)


def fetch(path, ua):
    url = BASE + path
    headers = {
        "User-Agent": ua,
        "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
        "Referer": f"{BASE}/thr_tl/acode={acode}/ctgid={ctgid}/bid={bid}/",
    }
    r = requests.get(url, headers=headers)
    return r.text


def summarize_html(html):
    title = None
    m = re.search(r'<title[^>]*>([\s\S]*?)</title>', html, re.I)
    if m:
        title = re.sub(r'\s+', ' ', m.group(1).strip())

    res_blocks = len(re.findall(r'<li\s+id="res\d+_block"', html))
    has_res0 = bool(re.search(r'id="res0_whole"', html))
    has_paging = bool(re.search(r'class="paging_nex_res_and_button"', html))

    ids = re.findall(r'<li\s+id="res(\d+)_block"', html)
    ids = ids[:10]

    return {
        "title": title,
        "res_blocks": res_blocks,
        "has_res0": has_res0,
        "has_paging": has_paging,
        "ids": ids,
    }


def save(name, html):
    path = os.path.join(out_dir, name)
    with open(path, "w", encoding="utf-8") as f:
        f.write(html)


def safe_str(s):
    if s is None:
        return None
    return s.encode('ascii', errors='backslashreplace').decode('ascii')


def extract_next(html):
    m = re.search(r'class="paging_nex_res_and_button"[\s\S]{0,2000}?href="([^"]*\/thr_res\/[^"]+)"', html)
    if not m:
        return None, None
    href = m.group(1)
    rw1 = re.search(r'/p=(\d+)/tp=1/rw=1/', href)
    normal = re.search(r'/p=(\d+)/tp=1/(?!rw)', href)
    return (int(rw1.group(1)) if rw1 else None), (int(normal.group(1)) if normal else None)


def main():
    paths = {
        "normal_p1": f"/thr_res/acode={acode}/ctgid={ctgid}/bid={bid}/tid={tid}/tp=1/",
        "normal_p2": f"/thr_res/acode={acode}/ctgid={ctgid}/bid={bid}/tid={tid}/p=2/tp=1/",
    }

    rows = []
    for label, path in paths.items():
        for ua_label, ua in [("mobile", UA_MOBILE), ("pc", UA_PC)]:
            html = fetch(path, ua)
            fname = f"{tid}_{label}_{ua_label}.html"
            save(fname, html)
            s = summarize_html(html)
            n1, n2 = extract_next(html)
            rows.append((label, ua_label, s, n1, n2))

    for label, ua_label, s, n1, n2 in rows:
        title = safe_str(s['title'])
        print(f"{label} / {ua_label}: title={title!r} res_blocks={s['res_blocks']} has_res0={s['has_res0']} has_paging={s['has_paging']} next_rw1={n1} next_normal={n2} ids={s['ids']}")

    print(f"saved html to {out_dir}")


if __name__ == "__main__":
    main()
