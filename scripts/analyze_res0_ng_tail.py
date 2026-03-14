import io, re, sys, requests
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
HEADERS = {"User-Agent": UA, "Accept-Language": "ja,en-US;q=0.9,en;q=0.8"}
r = requests.get("https://bakusai.com/thr_res/acode=4/ctgid=137/bid=1177/tid=13179663/tp=1/", headers=HEADERS, timeout=15)
r.encoding = "utf-8"
html = r.text
block_m = re.search(r'<li[^>]*id="res0_whole"[^>]*>([\s\S]*?)(?=<li\s|<\/ul>)', html)
block = block_m.group(1) if block_m else ""
print(f"block 全長: {len(block)}")
print("--- 4500文字以降 ---")
print(block[4500:])
