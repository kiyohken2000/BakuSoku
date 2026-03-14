"""
res0_whole 構造の差異調査

比較:
  動作する: https://bakusai.com/thr_res/acode=4/ctgid=137/bid=5868/tid=13178575/tp=1/
  動作しない: https://bakusai.com/thr_res/acode=4/ctgid=137/bid=1177/tid=13179663/tp=1/
"""

import io, re, sys
import requests

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

UA = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) "
    "Version/17.0 Mobile/15E148 Safari/604.1"
)
HEADERS = {"User-Agent": UA, "Accept-Language": "ja,en-US;q=0.9,en;q=0.8"}

URLS = {
    "OK  (bid=5868)": "https://bakusai.com/thr_res/acode=4/ctgid=137/bid=5868/tid=13178575/tp=1/",
    "NG  (bid=1177)": "https://bakusai.com/thr_res/acode=4/ctgid=137/bid=1177/tid=13179663/tp=1/",
}


def fetch(url):
    r = requests.get(url, headers=HEADERS, timeout=15)
    r.encoding = "utf-8"
    return r.text


def extract_res0_whole(html):
    m = re.search(r'<li[^>]*id="res0_whole"[^>]*>([\s\S]*?)(?=<li\s|<\/ul>)', html)
    return m.group(1) if m else None


def analyze_res0(label, html):
    print()
    print("=" * 70)
    print(f"[{label}]")
    print("=" * 70)

    block = extract_res0_whole(html)
    if not block:
        print("  res0_whole: なし")
        return

    print(f"  res0_whole: あり (長さ {len(block)})")

    # --- 画像 ---
    # 現在のパーサー: div_box 内の img
    divbox_m = re.search(
        r'<div[^>]*id="div_box"[^>]*>([\s\S]*?)(?:<\/div>\s*<!--\s*\/showmore_list|<\/section>)',
        block
    )
    if divbox_m:
        imgs = re.findall(r'<img[^>]+src="([^"]+)"', divbox_m.group(1))
        data_orig = re.findall(r'data-original="([^"]+)"', divbox_m.group(1))
        print(f"\n  div_box: あり")
        print(f"    <img src>: {imgs}")
        print(f"    data-original: {data_orig}")
    else:
        print("\n  div_box: なし")

    # div_box 以外の場所の img
    all_imgs = re.findall(r'<img[^>]+src="([^"]+)"', block)
    all_orig = re.findall(r'data-original="([^"]+)"', block)
    print(f"\n  res0_whole 全体の <img src>: {[i for i in all_imgs if 'spacer' not in i and 'loading' not in i and 'logo' not in i][:5]}")
    print(f"  res0_whole 全体の data-original: {[i for i in all_orig if 'spacer' not in i][:5]}")

    # --- 元記事 URL ---
    # 現行パーサー1: 「元記事」テキスト近傍
    link1 = re.search(r'href="(https?://[^"]+)"[^>]*>[^<]*(?:元記事|記事を読む)[^<]*</a>', block)
    print(f"\n  元記事リンク (現行): {link1.group(1) if link1 else 'なし'}")

    # NewsAeticleUrl クラス
    link2 = re.search(r'class="NewsAeticleUrl"[\s\S]*?href="(https?://[^"]+)"', block)
    print(f"  NewsAeticleUrl:      {link2.group(1) if link2 else 'なし'}")

    # すべての外部 https リンク
    all_links = re.findall(r'href="(https?://[^"]+)"', block)
    external = [l for l in all_links if 'bakusai' not in l and 'zauth' not in l and 'img2' not in l]
    print(f"  外部リンク一覧: {external[:8]}")

    # --- 画像の全コンテキスト ---
    print(f"\n  res0_whole 内の <img> タグ (全文):")
    for tag in re.findall(r'<img[^>]+>', block)[:5]:
        print(f"    {tag[:200]}")

    # --- res0_body 全体 ---
    print(f"\n  res0_body 先頭 800 文字:")
    body_m = re.search(r'id="res0_body"[^>]*>([\s\S]{0,800})', block)
    if body_m:
        print(body_m.group(1)[:800])
    else:
        print("  res0_body: なし")
        # suretai_sticky の直後
        sticky_m = re.search(r'class="suretai_sticky"[\s\S]{0,200}', block)
        if sticky_m:
            print(f"  suretai_sticky 周辺:\n{block[sticky_m.start():sticky_m.start()+600]}")


htmls = {}
for label, url in URLS.items():
    print(f"Fetching {url} ...")
    htmls[label] = fetch(url)

for label, html in htmls.items():
    analyze_res0(label, html)

print()
print("調査完了")
