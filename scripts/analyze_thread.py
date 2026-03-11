"""
スレッド詳細ページの HTML 構造を解析する。
- レス構造（番号・投稿者・日時・本文・Good/Bad）
- スレ主投稿（OP）の構造
- 投稿フォームのフィールド・hidden input・CSRF トークン
- インライン JavaScript 変数
- Cookie（Set-Cookie ヘッダー）
- レスポンスヘッダー

出力: scripts/out/analyze_thread.txt
"""

import urllib.request
import urllib.parse
import re
import os

OUT_DIR = os.path.join(os.path.dirname(__file__), 'out')
os.makedirs(OUT_DIR, exist_ok=True)
OUT_FILE = os.path.join(OUT_DIR, 'analyze_thread.txt')

BASE_URL = 'https://bakusai.com'
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Mobile/15E148 Safari/604.1',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'ja-JP,ja;q=0.9',
}

# 東京 > 芸能 > 男性芸能人 のアクティブなスレッド
TEST_URLS = [
    '/thr_res/acode=3/ctgid=116/bid=63/tid=12412150/tp=1/',   # 松本人志スレ（レス多め）
    '/thr_res/acode=3/ctgid=137/bid=1177/tid=13174792/tp=1/',  # 芸能ニュース（レス少なめ）
]

lines = []

def log(s=''):
    lines.append(str(s))

def fetch(path):
    url = BASE_URL + path
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        resp = urllib.request.urlopen(req, timeout=15)
        headers_list = resp.getheaders()
        html = resp.read().decode('utf-8', errors='replace')
        final_url = resp.url
        status = resp.status
        return html, headers_list, final_url, status
    except urllib.error.HTTPError as e:
        return f'HTTPError: {e.code}', [], '', e.code
    except Exception as e:
        return f'Error: {e}', [], '', 0

for test_url in TEST_URLS:
    log(f'{"="*80}')
    log(f'URL: {BASE_URL}{test_url}')
    log(f'{"="*80}')

    html, resp_headers, final_url, status = fetch(test_url)

    log(f'\n--- Response Info ---')
    log(f'Status: {status}')
    log(f'Final URL: {final_url}')
    log(f'HTML length: {len(html)} chars')

    log(f'\n--- Response Headers ---')
    for name, value in resp_headers:
        log(f'  {name}: {value}')

    log(f'\n--- Set-Cookie Headers ---')
    cookies = [v for n, v in resp_headers if n.lower() == 'set-cookie']
    if cookies:
        for c in cookies:
            log(f'  {c}')
    else:
        log('  (none)')

    if isinstance(html, str) and len(html) > 100:

        # --- OP (スレ主投稿) ---
        log(f'\n--- OP (スレ主投稿) ---')
        # .thr_id
        thr_id_match = re.search(r'class="thr_id"[^>]*>([\s\S]*?)</div>', html)
        if thr_id_match:
            op_html = thr_id_match.group(1)[:500]
            log(f'  .thr_id found, length={len(thr_id_match.group(1))}')
            log(f'  Content (first 500 chars): {op_html}')
        else:
            log('  .thr_id NOT found')

        # 会員限定チェック
        if '会員限定' in html:
            log('  *** "会員限定" text found in page ***')
            # 前後の文脈を抽出
            idx = html.index('会員限定')
            context = html[max(0,idx-200):idx+200]
            # タグ除去
            context_clean = re.sub(r'<[^>]+>', ' ', context).strip()
            log(f'  Context: {context_clean[:300]}')
        else:
            log('  "会員限定" NOT found — OP is visible')

        # <h1> タイトル
        h1 = re.search(r'<h1[^>]*>(.*?)</h1>', html)
        if h1:
            log(f'  <h1> title: {h1.group(1).strip()[:100]}')

        # --- レス構造 ---
        log(f'\n--- レス構造 ---')
        # <dl> ベースのレスを探す
        res_metas = re.findall(r'class="res_meta_wrap"[^>]*>([\s\S]*?)</div>', html)
        log(f'  .res_meta_wrap count: {len(res_metas)}')
        if res_metas:
            for i, meta in enumerate(res_metas[:3]):
                clean = re.sub(r'<[^>]+>', ' ', meta).strip()
                clean = re.sub(r'\s+', ' ', clean)
                log(f'  Example {i+1}: {clean[:200]}')

        # レス本文
        res_bodies = re.findall(r'class="(?:div_box|resbody|res_body)"[^>]*>([\s\S]*?)</div>', html)
        log(f'  res body count: {len(res_bodies)}')
        if res_bodies:
            for i, body in enumerate(res_bodies[:3]):
                clean = re.sub(r'<[^>]+>', ' ', body).strip()
                clean = re.sub(r'\s+', ' ', clean)
                log(f'  Body {i+1}: {clean[:200]}')

        # Good/Bad
        log(f'\n--- Good/Bad ---')
        good_bad = re.findall(r'(Good!?|Bad!?)[^<]{0,100}', html)
        log(f'  Good/Bad text occurrences: {len(good_bad)}')
        # onclick handlers
        good_onclick = re.findall(r'onclick="[^"]*[Gg]ood[^"]*"', html)
        bad_onclick = re.findall(r'onclick="[^"]*[Bb]ad[^"]*"', html)
        log(f'  Good onclick handlers: {len(good_onclick)}')
        if good_onclick[:2]:
            for h in good_onclick[:2]:
                log(f'    {h}')
        log(f'  Bad onclick handlers: {len(bad_onclick)}')
        if bad_onclick[:2]:
            for h in bad_onclick[:2]:
                log(f'    {h}')

        # Good/Bad 関連の data-* 属性
        good_data = re.findall(r'data-[a-z]+="[^"]*"[^>]*(?:Good|Bad)', html)
        log(f'  data-* near Good/Bad: {len(good_data)}')
        for d in good_data[:3]:
            log(f'    {d[:200]}')

        # Good/Bad の ID 属性
        good_ids = re.findall(r'id="[^"]*(?:[Gg]ood|[Bb]ad)[^"]*"', html)
        log(f'  IDs containing good/bad: {len(good_ids)}')
        for gid in good_ids[:5]:
            log(f'    {gid}')

        # --- 投稿フォーム ---
        log(f'\n--- 投稿フォーム ---')
        forms = re.findall(r'<form[^>]*>([\s\S]*?)</form>', html)
        log(f'  <form> tags found: {len(forms)}')
        for i, form_html in enumerate(forms):
            # form attributes
            form_tag = re.search(r'<form([^>]*)>', html[html.index(form_html)-100:html.index(form_html)+10])
            if form_tag:
                log(f'  Form {i+1} attributes: {form_tag.group(1).strip()[:200]}')

            # input fields
            inputs = re.findall(r'<input([^>]*)/?>', form_html)
            log(f'  Form {i+1} inputs ({len(inputs)}):')
            for inp in inputs:
                name = re.search(r'name="([^"]*)"', inp)
                type_ = re.search(r'type="([^"]*)"', inp)
                value = re.search(r'value="([^"]*)"', inp)
                log(f'    name={name.group(1) if name else "?"} type={type_.group(1) if type_ else "?"} value={value.group(1)[:50] if value else "?"}')

            # textarea
            textareas = re.findall(r'<textarea([^>]*)>', form_html)
            for ta in textareas:
                log(f'  Form {i+1} textarea: {ta.strip()[:200]}')

            # select
            selects = re.findall(r'<select([^>]*)>', form_html)
            for sel in selects:
                log(f'  Form {i+1} select: {sel.strip()[:200]}')

        # form 外の input/textarea（フォームタグなしの場合）
        all_inputs = re.findall(r'<input([^>]*)/?>', html)
        all_textareas = re.findall(r'<textarea([^>]*)>', html)
        log(f'\n  Total <input> on page: {len(all_inputs)}')
        log(f'  Total <textarea> on page: {len(all_textareas)}')

        # _token (Laravel CSRF)
        token_inputs = [inp for inp in all_inputs if '_token' in inp]
        log(f'  _token inputs: {len(token_inputs)}')
        for t in token_inputs:
            log(f'    {t[:200]}')

        # --- JavaScript 変数 ---
        log(f'\n--- JavaScript Variables ---')
        js_vars = re.findall(r'var\s+(\w+)\s*=\s*(["\'].*?["\']|[\d.]+|true|false|null)', html)
        for name, value in js_vars:
            log(f'  {name} = {value}')

        # MQTT 関連
        log(f'\n--- MQTT Config ---')
        mqtt_vars = re.findall(r'(?:const|var|let)\s+(MQTT_\w+)\s*=\s*(["\'].*?["\']|[\d.]+)', html)
        for name, value in mqtt_vars:
            log(f'  {name} = {value}')

        # --- 外部スクリプト URL ---
        log(f'\n--- External Scripts ---')
        scripts = re.findall(r'<script[^>]*src="([^"]+)"[^>]*>', html)
        for s in scripts:
            if 'google' not in s and 'gtag' not in s and 'ad' not in s.lower():
                log(f'  {s}')

        # --- アンカー（引用）構造 ---
        log(f'\n--- Anchor/Quote Structure ---')
        anchors = re.findall(r'<a[^>]*href="(/thr_res_show/[^"]*)"[^>]*>(.*?)</a>', html)
        log(f'  Quote anchors: {len(anchors)}')
        if anchors[:3]:
            for href, text in anchors[:3]:
                log(f'    href={href} text={text}')

        # --- ページネーション ---
        log(f'\n--- Pagination ---')
        page_links = re.findall(r'href="([^"]*p=\d+[^"]*)"', html)
        log(f'  Page links: {len(page_links)}')
        for pl in page_links[:5]:
            log(f'    {pl}')

    log('')

# 出力
with open(OUT_FILE, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))

pass  # output written to file only (avoid cp932 encoding errors on Windows)
