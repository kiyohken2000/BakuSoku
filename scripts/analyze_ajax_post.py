"""
ajax_post_sp.js と mqtt_newres_sp.js を取得して解析する。
- 投稿の AJAX エンドポイント
- Good/Bad の AJAX エンドポイント
- MQTT メッセージのペイロード形式
- リクエスト/レスポンスの構造

出力: scripts/out/analyze_ajax_post.txt
"""

import urllib.request
import os

OUT_DIR = os.path.join(os.path.dirname(__file__), 'out')
os.makedirs(OUT_DIR, exist_ok=True)
OUT_FILE = os.path.join(OUT_DIR, 'analyze_ajax_post.txt')

BASE_URL = 'https://bakusai.com'
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Mobile/15E148 Safari/604.1',
    'Accept': '*/*',
    'Accept-Language': 'ja-JP,ja;q=0.9',
}

JS_FILES = [
    '/js/thr/ajax_post_sp.js?t=202603111105',
    '/js/thr/mqtt_newres_sp.js?t=202603111105',
    '/js/thr/thr_status_icon.js?t=202603111105',
    '/js/thr/showCharCnt.js?t=202603111105',
    '/js/thr/switchMask.js?t=202603111105',
    '/js/jquery.common.sp.js?t=202603111105',
]

lines = []

def log(s=''):
    lines.append(str(s))

for js_path in JS_FILES:
    url = BASE_URL + js_path
    log(f'{"="*80}')
    log(f'Fetching: {url}')
    log(f'{"="*80}')

    req = urllib.request.Request(url, headers=HEADERS)
    try:
        resp = urllib.request.urlopen(req, timeout=15)
        content = resp.read().decode('utf-8', errors='replace')
        log(f'Length: {len(content)} chars')
        log(f'Status: {resp.status}')
        log('')
        log('--- Full Content ---')
        log(content)
    except Exception as e:
        log(f'Error: {e}')

    log('')

with open(OUT_FILE, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))
