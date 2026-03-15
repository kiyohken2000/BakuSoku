import pathlib, re
import requests
BASE = "https://bakusai.com"
acode=4; ctgid=103; bid=257; tid=12402123; page=10
UA_MOBILE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
headers={"User-Agent":UA_MOBILE,"Accept-Language":"ja,en-US;q=0.9,en;q=0.8"}
url = f"{BASE}/thr_res/acode={acode}/ctgid={ctgid}/bid={bid}/tid={tid}/p={page}/tp=1/"
html = requests.get(url, headers=headers).text
print('commentTime', len(re.findall(r'commentTime', html)))
print('res_body', len(re.findall(r'class="res_body"', html)))
