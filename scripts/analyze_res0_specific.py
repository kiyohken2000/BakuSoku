# -*- coding: utf-8 -*-
import requests, re, sys

UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
      "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")
HEADERS = {"User-Agent": UA, "Accept-Language": "ja,en-US;q=0.9,en;q=0.8"}

def fetch(url):
    r = requests.get(url, headers=HEADERS, timeout=15)
    r.encoding = "utf-8"
    return r.text

def sp(s):
    try:
        print(s)
    except UnicodeEncodeError:
        print(s.encode("cp932", "replace").decode("cp932"))

def strip_tags(s):
    s = re.sub(r"<br\s*/?>", "\n", s, flags=re.IGNORECASE)
    s = re.sub(r"<[^>]+>", "", s)
    for a, b in [("&amp;","&"),("&lt;","<"),("&gt;",">"),("&nbsp;"," "),("&ensp;"," ")]:
        s = s.replace(a, b)
    return re.sub(r"[ \t]+", " ", s).strip()

# --- rw=1 (最初ページ) ---
url = "https://bakusai.com/thr_res/acode=4/ctgid=148/bid=1538/tid=1462094/tp=1/rw=1/"
html = fetch(url)

og_m = re.search(r'property="og:title"\s+content="([^"]+)"', html)
sp(f"og:title: {og_m.group(1) if og_m else 'なし'}")

# スレ一覧でのタイトル
list_html = fetch("https://bakusai.com/thr_tl/acode=4/ctgid=148/bid=1538/")
idx = list_html.find("1462094")
if idx >= 0:
    ctx = list_html[max(0, idx-300):idx+300]
    t = re.search(r'title="([^"]+)"', ctx)
    sp(f"スレ一覧のタイトル: {t.group(1) if t else 'なし'}")

sp("\n--- rw=1 ページのレス ---")
parts = re.split(r'<li\s+id="res', html)
for p in parts[1:]:
    rrid_m = re.match(r'^(\d+)_block', p)
    if not rrid_m:
        continue
    rrid = int(rrid_m.group(1))
    if rrid == 0:
        continue
    date_m = re.search(r'itemprop="commentTime"[^>]*>([\s\S]{0,50}?)</span>', p)
    date = date_m.group(1).strip() if date_m else None
    if not date:
        continue
    body_start = p.find('class="res_body"')
    body_text = ""
    if body_start >= 0:
        after = p.find(">", body_start) + 1
        inner = p[after:after+800]
        body_text = strip_tags(inner.split("</div>")[0])
    name_area = p.find('class="name"')
    name_text = ""
    if name_area >= 0:
        span_m = re.search(r'<span[^>]*>([^<]+)</span>', p[name_area:name_area+200])
        if span_m:
            name_text = span_m.group(1).strip()
    sp(f">>{rrid} [{date}] {name_text}")
    sp(f"  {body_text[:120]}")
