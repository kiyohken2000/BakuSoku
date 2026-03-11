# 技術仕様書 — BakuSoku（爆速）

最終更新: 2026-03-11（Python スクリプト解析済み）

---

## プロジェクト概要

**BakuSoku（爆速）** — 爆サイ.com (bakusai.com) の非公式ブラウザアプリ。
スキキラ（好き嫌い.com 専ブラ）のアーキテクチャ・UI設計を流用する。
「爆サイを爆速で見る」のダブルミーニング。MQTT リアルタイム更新による速さが最大の差別化。

### コンセプト
- 広告なし・シンプル・快適（5ch専ブラと同じ方向性）
- 既存の爆サイ専ブラ（爆リーII・ThreadMaster 等）との差別化: モダン UI + MQTT リアルタイム更新

---

## リリース対象

- iOS・Android 同時リリース
- EAS Build でビルド

---

## アーキテクチャ

### データフロー

```
Expo（モバイルアプリ）
    │
    │ 直接 HTTP リクエスト
    ▼
爆サイ.com（bakusai.com）
    │
    │ MQTT WebSocket（リアルタイム）
    ▼
mqtt1.bakusai.com:8084
```

バックエンド・プロキシなし。スキキラと同一の構成。

### リクエスト方式

Expo の `fetch()` から直接 bakusai.com にアクセスする。
- サーバー: nginx / PHP 8.3（Laravel）
- **Cloudflare 不使用** — WAF・ボットスコアリング・空ボディ問題なし
- User-Agent はブラウザ風を1つ固定設定（ローテーション不要）
- セッション Cookie（`bakusai_session`）の管理が必要

### スキキラとの比較

| | suki-kira.com | bakusai.com |
|---|---|---|
| CDN/WAF | Cloudflare（積極的ボット判定） | **なし**（nginx 直） |
| 空ボディ問題 | 頻発 | **なし** |
| CAPTCHA | Turnstile | **なし** |
| UA ローテーション | 必須 | 不要（固定で OK） |
| Cookie | 人物ごと・24h 有効 | Laravel セッション |
| リアルタイム更新 | なし | MQTT WebSocket |

---

## スクレイピング対策・アクセス制限（実測済み 2026-03-11）

### 概要

bakusai.com は suki-kira.com と比較して**極めて緩い**ボット対策。
Cloudflare 不使用、CAPTCHA なし、レートリミット検出されず。
既存の爆サイ専ブラ（爆リーII・ThreadMaster）が問題なく動作している実績あり。

### 閲覧（GET）の制限

| コンテンツ | ログイン不要 | 備考 |
|-----------|:-----------:|------|
| スレッド一覧 | **○** | 完全に SSR。タイトル・レス数・閲覧数・日時すべて取得可 |
| レス/コメント本文 | **○** | 全レス閲覧可。番号・日時・投稿者名・本文 |
| ページネーション | **○** | URL ベース（`/p={N}/`）。全ページアクセス可 |
| 検索 | **○** | SSR。`/sch_all/` で全体検索、`/sch_result/` で板内検索 |
| 画像 | **○** | `img2.bakusai.com` から直接取得可 |
| Good/Bad 数 | **○** | `POST /rating_list/` で一括取得（AJAX）。ログイン不要で**カウントは取得可** |
| Good/Bad 投票 | **✗** | `POST /rating_push` でログイン必須（`.notLogin` クラスで制御） |
| スレ主の投稿（OP） | **○** | **HTML にフォームが含まれる**（海外IPでも表示確認済み）。ただしOP本文は空の場合あり |
| 地域ページ (`/areatop/`) | **△** | `acode` 付き `/areatop/acode={A}/` で取得可能だが JS レンダリング部分あり |
| カテゴリ板一覧 (`/bbstop/`) | **○** | 完全に SSR |
| エリアカテゴリ (`/ctgtop/`) | **○** | `/areatop/acode={A}` にリダイレクト。カテゴリ・板リンク取得可 |

### 投稿（POST）の制限

| 機能 | ログイン不要 | 備考 |
|------|:-----------:|------|
| レス投稿 | **○** | **ブラウザからはログインなしで投稿可能**（国内 IP）。フォームは常に表示される |
| スレッド作成 | 要調査 | |
| Good/Bad 投票 | **✗** | 会員限定。非ログイン時はログイン案内ポップアップ |

### 投稿フォーム仕様（実測済み）

投稿フォーム（`form[name=directForm]`）は**ログイン状態に関係なく HTML にレンダリング**される。

**フォームフィールド:**

| フィールド | name 属性 | type | 備考 |
|-----------|----------|------|------|
| 削除ボタン | `admin_delete_btn` | hidden | |
| 掲示板ID | `bid` | hidden | 例: `247` |
| スレッドID | `tid` | hidden | 例: `12412150` |
| カテゴリID | `ctgid` | hidden | 例: `116` |
| 地域コード | `acode` | hidden | 例: `3` |
| ページ種別 | `tp` | hidden | 固定 `1` |
| プロフ | `prof_flg` | hidden | |
| コントローラID | `ctrid` | hidden | |
| 読込時刻 | `loaded_at` | hidden | Unix timestamp（マイクロ秒付き。例: `1773212613.1699`） |
| スタンプ | `stamp_data` | hidden | |
| 投稿者名 | `name` | text | デフォルト「匿名さん」 |
| メールアドレス | `mailaddr` | text | |
| 画像 | `image_post` | file | |
| 本文 | `body` | textarea | |

**重要: CSRF トークン（`_token`）は不要。** フォームに `_token` フィールドは含まれない（実測で確認済み）。

### 投稿の AJAX 仕様（`ajax_post_sp.js` 解析済み）

```javascript
// form[name=directForm] の submit をインターセプト
const formData = new FormData(form);
if (cushionloaded) {
  formData.append('cushion', '1');
}

fetch(form.action, {
  method: 'POST',
  body: formData,
  headers: {
    'X-Requested-With': 'XMLHttpRequest'
  }
})
.then(response => response.json())
.then(data => {
  if (data.status === 'success') {
    form.reset();
  } else if (data.status === 'cushion') {
    // クッションページ（確認モーダル）を表示
  }
});
```

- **エンドポイント**: スレッドの URL そのもの（`form.action` = 現在のページ URL）
- **メソッド**: POST
- **Content-Type**: `multipart/form-data`（FormData）
- **必須ヘッダー**: `X-Requested-With: XMLHttpRequest`
- **レスポンス**: JSON `{ status: 'success' | 'cushion' }`
- **クッション**: 一定条件で確認ダイアログ表示（`cushion` フィールドで回避）

### ボット対策の詳細

| 対策 | 有無 | 詳細 |
|------|:----:|------|
| Cloudflare WAF | **なし** | nginx 直。`cf-` ヘッダーなし |
| CAPTCHA | **なし** | reCAPTCHA・hCaptcha・Turnstile いずれも不使用 |
| レートリミット | **検出されず** | 同一 URL への3連続リクエストが全て正常応答 |
| UA チェック | **緩い** | ブラウザ UA を1つ設定すれば OK。ローテーション不要 |
| JS チャレンジ | **なし** | 「Just a moment...」等のチャレンジページなし |
| TLS フィンガープリント | **なし** | Cloudflare 不使用のため該当なし |
| Tor ブロック | **あり** | `tor_ip_checked` Cookie。Tor 出口ノードを検出 |
| EU IP 検出 | **あり** | `is_eu_ip` Cookie。GDPR 対応用と推測 |
| 海外 IP 投稿制限 | **可能性あり** | 海外 IP からの投稿は制限される可能性。閲覧は制限なし |

### robots.txt

```
User-agent: ia_archiver
Disallow: /

User-Agent: Megalodon
Disallow: /
```

**Internet Archive と Megalodon（ウェブ魚拓）のみ拒否。一般的なクローラー/アプリは制限なし。**

### suki-kira.com の二の舞にならない理由

| suki-kira.com で起きた問題 | bakusai.com での該当 |
|--------------------------|-------------------|
| Cloudflare が UA+ヘッダー組み合わせでボット判定→空ボディ | **Cloudflare なし。発生しない** |
| `?nxc=` ページネーションを WAF が狙い撃ちブロック | **WAF なし。URL ベースのページネーションが正常動作** |
| UA バージョンが古いとブロック | **UA チェックが緩い。固定 UA で OK** |
| Turnstile CAPTCHA で WebView プロキシが使えない | **CAPTCHA なし** |
| Workers プロキシも Cloudflare にブロック | **Cloudflare なし。そもそもプロキシ不要** |
| アプリ公開翌日に WAF ルール変更（運営による対策疑惑） | **リスクは残るが、既存専ブラが長年動作中の実績あり** |

### 残存リスクと対策

| リスク | 可能性 | 対策 |
|--------|:------:|------|
| 運営が Cloudflare を導入する | 低 | 既存専ブラが複数存在し長年運用されている。急な導入は考えにくい |
| レートリミットの導入 | 低〜中 | リクエスト間隔を適切に設定。一括更新時はウェイトを入れる |
| UA ブロック強化 | 低 | `HEADERS` 定数を更新するだけで対応可 |
| ログイン必須化（閲覧含む） | 極低 | 公開掲示板の性質上、閲覧にログインを求めるとトラフィック激減。考えにくい |

---

## 爆サイ.com サイト構造

### 階層

```
地域（Region）
  └── カテゴリ（Category）
        └── 掲示板（Board）
              └── スレッド（Thread）
                    └── レス（Response） ← 最大 1000 件
```

### URL パターン（実測確認済み）

| ページ | URL パターン | fetch 可否 |
|--------|-------------|:----------:|
| トップ | `/` | ○ |
| エリアトップ | `/areatop/acode={A}/` | △（SSR だが一部 JS 依存） |
| エリアカテゴリ | `/ctgtop/acode={A}/` | ○（`/areatop/acode={A}` にリダイレクト） |
| カテゴリ板一覧 | `/bbstop/acode={A}/ctgid={C}/` | ○ |
| スレッド一覧 | `/thr_tl/acode={A}/ctgid={C}/bid={B}/` | ○ |
| スレッド一覧 p2 以降 | `/thr_tl/acode={A}/ctgid={C}/bid={B}/p={P}/` | ○ |
| スレッド詳細 | `/thr_res/acode={A}/ctgid={C}/bid={B}/tid={T}/tp=1/` | ○ |
| スレッド詳細 p2 以降 | `/thr_res/acode={A}/ctgid={C}/bid={B}/tid={T}/p={P}/tp=1/` | ○ |
| 最新レス | `/thr_res/acode={A}/ctgid={C}/bid={B}/tid={T}/p=1/tp=1/` | ○ |
| 最初から | `/thr_res/acode={A}/ctgid={C}/bid={B}/tid={T}/tp=1/rw=1/` | ○ |
| 単一レス表示 | `/thr_res_show/acode={A}/ctgid={C}/bid={B}/tid={T}/rrid={R}/` | ○ |
| 全体検索 | `/sch_all/acode={A}/word={W}/` | ○ |
| 板内検索 | `/sch_result/` POST: bid, tid, ctgid, acode, ctrid, sch, word | ○ |
| サジェスト | `/suggest_input/acode={A}/ctrid=` (JSON) | ○ |
| 通報 | `/thr_repo02/...` | 要ログイン |
| 削除依頼 | `/del_req0/...` | 要ログイン |

### パラメータ

| パラメータ | 意味 |
|-----------|------|
| `acode` | 地域コード（1=北海道, 3=東京, 7=大阪 等） |
| `ctgid` | カテゴリ ID |
| `bid` | 掲示板 ID |
| `tid` | スレッド ID |
| `tp` | スレッドページ種別（固定 `1`） |
| `p` | ページ番号 |
| `rrid` | レス番号 |
| `ctrid` | コントローラ ID |

### 地域コード一覧

| 地域 | acode |
|------|-------|
| 北海道 | 1 |
| 南東北 | 2 |
| 東京 | 3 |
| 甲信越 | 4 |
| 東海 | 5 |
| 北陸 | 6 |
| 大阪 | 7 |
| 山陽 | 8 |
| 四国 | 9 |
| 北部九州 | 10 |
| 沖縄 | 11 |
| 山陰 | 12 |
| 北東北 | 14 |
| 北関東 | 15 |
| 南部九州 | 16 |
| 南関東 | 17 |
| 関西 | 18 |
| 海外 | `/overarea/`（特殊パス） |

### スレッド詳細のページネーション（重要）

- デフォルト URL（`/p=` なし）→ **最新ページ（最後のレス群）**を表示
- `/p=1/` → 同上（最新ページ）
- `/p=2/` → 2番目に新しいページ（例: レス #901-950）
- ページ番号が**大きいほど古い**レスが表示される（逆順）
- 1ページあたり約 50 レス
- 最大 1000 レス / スレッド

---

## HTML パース仕様（実測確認済み）

### スレッド一覧（板ページ）

```html
<div class="thr_list ThrTitleList">
  <ul>
    <li data-tid="{tid}">
      <a href="/thr_res/acode={A}/ctgid={C}/bid={B}/tid={T}/tp=1/">
        <div class="ttTitle">
          <em>{順番}</em>
          <div class="title">
            <div class="thr_status_icon" title="{スレタイトル}">{スレタイトル}</div>
          </div>
        </div>
        <div class="ttUpdate">
          <span class="ttUdTime">
            {更新時間}
            <span class="thrlis_chart_space">
              <i class="fa fa-bar-chart"></i>
            </span>
            <span>{閲覧数}</span>
            <span class="thrlis_comment_space">
              <i class="fa fa-comment-o"></i>
            </span>
            <span>{レス数}</span>
          </span>
        </div>
      </a>
    </li>
  </ul>
</div>
```

**パース対象:**
- `li[data-tid]` → スレッドID
- `.ttTitle em` → 順番（表示用）
- `.thr_status_icon[title]` → スレッドタイトル
- `.ttUdTime` → 更新時間テキスト
- `.thrlis_chart_space` 直後の `<span>` → 閲覧数
- `.thrlis_comment_space` 直後の `<span>` → レス数

**ページネーション:** 「次のページ」リンクで `p={N}` 増加

### カテゴリ板一覧（`/bbstop/`）

```html
<!-- 板リンク -->
<a href="/thr_tl/acode={A}/ctgid={C}/bid={B}/">{板名}</a>
```

板一覧は `/bbstop/acode={A}/ctgid={C}/` から `/thr_tl/` リンクを抽出。

### エリアトップ（`/areatop/`）

- カテゴリリンク: `/bbstop/acode={A}/ctgid={C}/` → カテゴリ名
- 板リンク: `/thr_tl/acode={A}/ctgid={C}/bid={B}/` → 板名
- 検索フォーム: `action="/sch_all/"` with `acode`, `ctrid`, `word`

### スレッド詳細（レス構造）

**OP（スレ主投稿）— `#res0_whole`**

```html
<div id="res0_whole">
  <article class="sticky-container">
    <!-- Good/Bad ボタン（スレ全体用 gb_total） -->
    <span class="rating_good_bad good_bad_Thr isLoading notLogin">
      <span class="good_bad_totla">合計：</span>
      <button class="good_Button gb_total">...</button>
      <button class="bad_Button gb_total">...</button>
    </span>
    <!-- 投稿フォーム (directForm) -->
  </article>
</div>
```

- OP 本文は `#res0_body` 内（空の場合あり）
- `good_bad_Thr` はスレ全体の合計 Good/Bad
- `notLogin` クラスはログイン不要ユーザーに付与（Good/Bad 投票時にログイン案内）

**レス一覧 — `ul#res_list > li`**

```html
<ul id="res_list">
  <li>
    <article id="resArticle" class="article_res">
      <div id="res{N}_block" class="res_block">
        <div class="res_header">
          <span class="res_rotundate">
            <a href="#res_pos" title="#{N}へ返信"
               onclick="...document.directForm.body...">
              <span class="blue">#{N}</span>
            </a>
          </span>
          <span itemprop="commentTime">{YYYY/MM/DD HH:MM}</span>
        </div>

        <div class="res_body">
          {本文テキスト}
        </div>

        <div class="name">
          [{投稿者名}]
        </div>

        <div class="name_goodbad_box">
          <span class="rating_good_bad good_bad_Res isLoading notLogin">
            <button class="good_Button">
              <span class="good_Thumbs"><i class="fa fa-thumbs-o-up"></i></span>
              <span class="good_bad_loading"><img src=".../ring.gif"></span>
              <span class="good_counter">?</span>
              <span class="good_balloon">Good!</span>
            </button>
            <button class="bad_Button">
              <span class="bad_Thumbs"><i class="fa fa-thumbs-o-down"></i></span>
              <span class="good_bad_loading"><img src=".../ring.gif"></span>
              <span class="bad_counter">?</span>
              <span class="bad_balloon">Bad</span>
            </button>
          </span>
        </div>

        <div class="transTarget">
          <a href="#res_pos" title="#{N}へ返信">返信</a>
          <a href="/thr_res_show/.../rrid={N}/" target="_blank">移動</a>
        </div>
      </div>
    </article>
  </li>
</ul>
```

**パース対象:**
- `#res{N}_block` → レスブロック
- `.res_rotundate .blue` → レス番号 `#{N}`
- `span[itemprop="commentTime"]` → 日時
- `.res_body` → 本文
- `.name` → 投稿者名（`[匿名さん]` 形式）
- `.good_counter` / `.bad_counter` → Good/Bad カウント（初期値 `?`、AJAX で更新）
- `.rating_good_bad` → `good_bad_Thr`（スレ合計）or `good_bad_Res`（レス個別）

**アンカー（引用）:**
```html
<a href="/thr_res_show/acode={A}/ctgid={C}/bid={B}/tid={T}/rrid={R}/">
  &gt;&gt;{R}
</a>
```

### JavaScript 変数（スレッド詳細ページ）

```javascript
// 一括削除用
var thr_bbs_bid = '{bid}';
var thr_thread_tid = '{tid}';

// いいねボタン用（CSS セレクター）
var thr_class_name = '.thr_rotundate';           // OP のクラス
var res_class_name = '.res_meta_wrap .res_rotundate';  // 各レスのクラス

// MQTT
const MQTT_host = "mqtt1.bakusai.com";
const MQTT_port = 8084;
const MQTT_clientId = "laravel_mqtt_client_" + Math.random().toString(36).substring(2, 15);
const MQTT_topic = "thread/{tid}";

// その他
var max_res = 1000;
var post_flag = 0;
var msg_cnt = 0;
```

### 検索結果（`/sch_all/`）

- タイトル: `<h1>` に `『{検索語}』の{地域}版全体検索結果｜爆サイ.com`
- 結果リンク: `/thr_res/` で始まるリンク（スレッド詳細へ）
- 結果テキスト: リンク内にタイトル + スニペット（カテゴリ・板・本文の断片）

検索フォーム:
```
GET /sch_all/
  acode: 地域コード
  ctrid: コントローラID
  word: 検索キーワード
```

板内検索:
```
GET /sch_result/
  bid, tid, ctgid, acode, ctrid, sch, word
```

---

## Good/Bad API（`goodbadButton.js` 解析済み）

### カウント一括取得

```
POST /rating_list/
Content-Type: application/x-www-form-urlencoded

data: {
  list: [
    { tid: "{tid}" },                    // index 0 = スレ全体合計
    { tid: "{tid}", rrid: "{rrid1}" },   // index 1 = レス #rrid1
    { tid: "{tid}", rrid: "{rrid2}" },   // index 2 = レス #rrid2
    ...
  ]
}
```

**レスポンス（JSON 配列）:**
```json
[
  {
    "1": { "count": 42, "pushed": false },
    "2": { "count": 5,  "pushed": null }
  },
  ...
]
```

- `"1"` = Good、`"2"` = Bad
- `pushed`: `true`=投票済み、`false`=未投票、`null`=不明（ログインしていない場合）
- 配列の index はリクエストの `list` と対応（0=スレ全体、1〜=各レス）

### Good/Bad 投票

```
POST /rating_push
Content-Type: application/x-www-form-urlencoded

data: {
  tid: "{tid}",
  rrid: "{rrid}",
  rate_id: "1" | "2"    // 1=Good, 2=Bad
}
```

**レスポンス（JSON）:**
```json
{
  "success": true,
  "1": { "count": 43 },
  "2": { "count": 5 }
}
```

**制限:**
- **ログイン必須**（非ログインユーザーは `.notLogin` クラスにより投票不可）
- 投票済みの場合は `pushed: true` で UI に反映（再投票の可否は未検証）

---

## MQTT リアルタイム更新（差別化機能）

### 接続設定（実測確認済み）

```javascript
const client = new Paho.MQTT.Client(
  "mqtt1.bakusai.com",  // host
  8084,                  // port (WSS)
  "/mqtt",               // path
  clientId               // "laravel_mqtt_client_" + random
);

client.connect({
  useSSL: true,
  onSuccess: () => {
    client.subscribe("thread/{tid}");
  }
});
```

### MQTT メッセージペイロード（`mqtt_newres_sp.js` 解析済み）

```json
{
  "rrid": 428,                    // レス番号
  "body": "レス本文テキスト",       // 本文
  "date": "2026/03/06 16:19",     // 投稿日時
  "name": "匿名さん",              // 投稿者名
  "npbMyTeam": 0,                 // NPBチーム ID（野球板用）
  "npbMyTeamShortName": ""        // NPBチーム略称
}
```

### 再接続ロジック（`mqtt_newres_sp.js` より）

- 切断時: 5秒後に自動再接続
- ヘルスチェック: 60秒間隔
- イベント: `visibilitychange`, `focus`, `pageshow`, `online` で再接続判定
- クライアントID: ランダム文字列（認証トークン不要）

### 実装方針

- `react-native` 用 MQTT ライブラリ（`mqtt` or `@react-native-mqtt/mqtt`）
- スレ画面を開いている間だけ接続、離脱時に切断
- 新着レスは MQTT ペイロードから直接 UI に追加（再 fetch 不要）
- Good/Bad カウントは含まれないため、新着レスは初期値 0 で表示

### 未確認事項
- 接続数制限の有無
- MQTT over WSS 以外のプロトコル対応

---

## Cookie・セッション管理

| Cookie | 内容 | 備考 |
|--------|------|------|
| `bakusai_session` | Laravel セッション | httponly, samesite=lax。全機能の認証基盤 |
| `login_acode` | ログイン地域 | ログイン後に設定 |
| `is_eu_ip` | EU IP 判定 | GDPR 対応用 |
| `tor_ip_checked` | Tor 出口ノード判定 | Tor ブロック用 |
| `endNum_*_v2` | 既読管理用 | サーバー側既読管理 |

### 認証フロー

```
1. ユーザーが「ログイン」ボタンをタップ
2. expo-web-browser で bakusai.com/auth/login/ を開く
3. LINE / Google / X いずれかで OAuth 認証
4. bakusai_session Cookie が発行される
5. React Native の fetch が OS レベルで Cookie を自動管理（NSURLSession / OkHttp）
6. 以降の fetch に bakusai_session が自動付与 → Good/Bad 投票が可能に
```

**注意**: `bakusai_session` は httponly のため JS から直接読み取れないが、
React Native の fetch は OS の Cookie ジャーを使うため、`credentials: 'include'` で自動送信される。

### 投稿に関する制限
- **レス投稿はログイン不要**（国内 IP のブラウザで確認済み。海外 IP は制限の可能性あり）
- Good/Bad 投票: **会員限定**
- CSRF トークン（`_token`）: **不要**（フォームに含まれない）
- `X-Requested-With: XMLHttpRequest` ヘッダー: **必須**

---

## UI 設計方針

### ベースアプリ：Geschar

スキキラと同じく、iOS 向け 5ch 専ブラで最も評価が高い Geschar をベースとする。
「広告なし・シンプル・快適」という方向性が一致。

### 各アプリから取り入れる要素

| アプリ | 取り入れる要素 |
|--------|--------------|
| Geschar（ベース） | シンプルで洗練された UI・広告なし |
| ChMate | NG ワードの使いやすさ・コメント密度の高いリスト表示 |
| Twinkle | 黒背景・白文字のダークテーマ |
| 爆リーII | お気に入りフォルダ・一括更新・既読管理 |

### 爆サイビューア独自の差別化

- **MQTT リアルタイム更新**: スレを開いている間、新着レスが自動で流れてくる（他の専ブラにない最大の差別化）
- **モダン UI**: React Native ベースのスムーズなアニメーション・ハプティクス
- **クロスプラットフォーム**: iOS / Android 同一コードベース

### 基本テーマ

ダークモードをデフォルトとする（スキキラと同一）。

```
背景:             #0a0a0a
テキスト:          #e5e5e5
セカンダリテキスト: #888888
カード背景:        #1a1a1a
アクセント:        #f97316（オレンジ）
```

ライトモードも対応（ThemeContext パターンを流用）。

---

## アプリ画面仕様

### ナビゲーション構造

```
NavigationContainer
  └── RootStack (headerShown: false)
        ├── HomeRoot → TabNavigator (底部タブ)
        │     ├── BoardTab      → BoardStacks     → BoardList（掲示板一覧）
        │     ├── FavoriteTab   → FavoriteStacks   → Favorites（お気に入り）
        │     ├── HistoryTab    → HistoryStacks    → History（履歴）
        │     ├── SearchTab     → SearchStacks     → Search（検索）
        │     └── SettingsTab   → SettingsStacks   → Settings（設定）
        ├── ThreadList    (SlideFromRightIOS)  ← スレッド一覧
        ├── ThreadDetail  (SlideFromRightIOS)  ← スレッド詳細
        └── Post          (modal)              ← レス投稿
```

### 画面一覧

| # | 画面 | 役割 | ログイン |
|---|------|------|:--------:|
| 1 | BoardList | 地域選択 → カテゴリ → 掲示板一覧 | 不要 |
| 2 | ThreadList | 選択した掲示板のスレッド一覧（無限スクロール） | 不要 |
| 3 | ThreadDetail | スレッド詳細（レス一覧・リアルタイム更新・Good/Bad） | 不要 |
| 4 | Post | レス投稿（本文・名前・画像） | 不要（国内IP） |
| 5 | Favorites | お気に入りスレッド（フォルダ形式）・一括更新 | 不要 |
| 6 | History | 閲覧履歴・投稿履歴 | 不要 |
| 7 | Search | 全体検索 | 不要 |
| 8 | Settings | NG ワード・テーマ・地域設定・ログイン管理 | 不要 |

---

### 1. 掲示板一覧画面（BoardList）

**表示内容:**
- デフォルト地域の掲示板カテゴリ一覧
- 地域切り替えドロップダウン（18 地域）
- カテゴリタップで掲示板一覧展開

**データ取得:**
- `/bbstop/acode={A}/ctgid={C}/` から板リンクを抽出
- エリアトップ `/areatop/acode={A}/` からカテゴリリンク（`/bbstop/` リンク）を抽出
- **代替案**: カテゴリ・掲示板マスターをアプリ内にハードコード + 定期更新

**確認済みのカテゴリ・掲示板 ID（東京 acode=3）:**

| カテゴリ | ctgid | 掲示板例 | bid |
|---------|-------|---------|-----|
| 雑談 | 104 | | |
| 天気・災害 | 148 | | 5877 |
| 社会 | 119 | 自衛隊・軍事 | |
| スポーツ | 123 | | |
| 芸能 | 116 | お笑い芸人 | 247 |
| | | 男性芸能人 | 63 |
| | | 女性芸能人 | 64 |
| | | テレビ・ラジオ番組総合 | 93 |
| | | 芸能総合 | 506 |
| ニュース速報 | 137 | 事件・事故ニュース | 1098 |
| | | スポーツニュース | 1147 |
| | | 芸能ニュース | 1177 |
| | | 政治・経済ニュース | 1149 |
| | | 国際ニュース | 2494 |
| | | グラビアニュース | 5868 |
| | | ニュース総合 | 1150 |
| 同窓会 | 157 | | |
| クラブ・ディスコ・フェス | 108 | | |
| サークル | 130 | | |
| 趣味 | 117 | アニメ | 533 |

---

### 2. スレッド一覧画面（ThreadList）

**表示内容:**
- スレッドタイトル
- レス数・閲覧数・更新時間
- 新着レス数バッジ（既読管理）

**データ取得:**
```
GET /thr_tl/acode={A}/ctgid={C}/bid={B}/
```

**パース:** 前述のスレッド一覧 HTML 構造参照

**無限スクロール:** `p={N}` パラメータでページネーション

---

### 3. スレッド詳細画面（ThreadDetail）— メイン画面

**表示内容:**

上部:
- スレッドタイトル（`<h1>`）
- レス数 / 最大 1000
- Good / Bad 合計（AJAX で取得）

レス一覧:
- レス番号（`.res_rotundate`）
- 投稿者名・日時
- 本文
- Good / Bad ボタン + カウント
- 画像（あれば拡大表示）

**差別化ポイント:**
- **MQTT リアルタイム更新**: 新着レスが自動追加（スクロール位置維持）
- `>>NNN` アンカータップでポップアップ表示（スキキラ流用）
- NG ワードフィルタ（AsyncStorage 管理）
- スレ内検索

**操作:**
- ⋮メニュー: 返信・非表示・通報・NG ワード追加
- お気に入り登録（★ボタン）
- 最新レスへジャンプ / 先頭へジャンプ

---

### 4. レス投稿画面（Post）

**UI:**
- テキスト入力エリア（`body`）
- 名前入力（`name`、デフォルト「匿名さん」）
- 画像添付ボタン（`image_post`）
- 投稿ボタン

**投稿フロー:**
1. スレッド詳細ページを GET → フォーム内の hidden フィールド（`bid`, `tid`, `ctgid`, `acode`, `tp`, `loaded_at` 等）を取得
2. FormData を構築して POST（`X-Requested-With: XMLHttpRequest` ヘッダー必須）
3. レスポンス `{ status: 'success' }` で完了
4. `cushion` の場合は `cushion=1` を付けて再送信

---

### 5. お気に入り画面（Favorites）

**機能（爆リーII 参考）:**
- フォルダ形式でスレッドを管理（スキキラのブックマーク機能を流用）
- 一括更新: 全お気に入りスレッドの新着レス数を一度に取得
- 新着があるスレッドにバッジ表示
- スレッドが 1000 レスに達したら「DAT 落ち」表示

---

### 6. 履歴画面（History）

**構成（スキキラ流用）:**
- セクション 1「閲覧履歴」: スレッドタイトル・掲示板名・日時
- セクション 2「投稿履歴」: スレッドタイトル・本文プレビュー・日時

---

### 7. 検索画面（Search）

**機能:**
- テキスト入力 + サジェスト（`/suggest_input/` API）
- 全体検索: `/sch_all/acode={A}/word={W}/`
- 検索結果: タイトル・スニペット・カテゴリ・掲示板・日時
- タップでスレッド詳細へ遷移

---

### 8. 設定画面（Settings）

**項目:**
- デフォルト地域（acode）
- NG ワード管理（追加・削除）
- テーマ切り替え（ダーク / ライト）
- 名前のデフォルト設定
- **ログイン管理**（ログイン / ログアウト / ログイン状態表示）— Good/Bad 投票に必要
- バージョン情報

---

## AsyncStorage キー（予定）

| キー | 内容 |
|------|------|
| `@bakusai:defaultAcode` | デフォルト地域コード |
| `@bakusai:ngWords` | NG ワード配列 `string[]` |
| `@bakusai:favorites` | お気に入り `Array<{ id, name, items: Thread[] }>` |
| `@bakusai:readState` | 既読管理 `{ [tid]: lastReadResNum }` |
| `@bakusai:browseHistory` | 閲覧履歴 `Array<{ tid, title, boardName, time }>` |
| `@bakusai:postHistory` | 投稿履歴 `Array<{ tid, title, body, time }>` |
| `@bakusai:defaultName` | デフォルト投稿者名 |
| `@bakusai:goodBadVoted` | Good/Bad 投票済み `{ [tid_rrid]: 'good'|'bad' }` |
| `@bakusai:isDark` | テーマ設定 |
| `@bakusai:isLoggedIn` | ログイン状態 `boolean` |

---

## ファイル構成（予定）

ボイラープレート: https://github.com/kiyohken2000/ReactNativeExpoBoilerplate
ナビゲーション: React Navigation
状態管理: React Context

```
apps/mobile/
├── assets/
├── src/
│   ├── components/
│   │   ├── ThreadCard/       # スレッド一覧のカード
│   │   ├── ResItem/          # レス 1 件
│   │   └── ResInput/         # レス入力欄
│   ├── contexts/
│   │   ├── SettingsContext.js # NG ワード・お気に入り・既読管理・履歴
│   │   ├── AuthContext.js     # ログイン状態管理
│   │   └── ThemeContext.js    # ダークモード / ライトモード
│   ├── routes/
│   │   └── navigation/
│   │       ├── tabs/          # ボトムタブ
│   │       ├── stacks/        # 各タブのスタック
│   │       └── rootStack/     # ルートナビゲーター
│   ├── scenes/
│   │   ├── board/             # 掲示板一覧
│   │   ├── threadList/        # スレッド一覧
│   │   ├── threadDetail/      # スレッド詳細（メイン画面）
│   │   ├── post/              # レス投稿
│   │   ├── favorites/         # お気に入り
│   │   ├── history/           # 履歴
│   │   ├── search/            # 検索
│   │   └── settings/          # 設定
│   ├── theme/
│   │   └── colors.js          # darkColors / lightColors
│   └── utils/
│       ├── bakusai.js         # bakusai.com への全リクエスト処理（集約）
│       ├── mqtt.js            # MQTT 接続管理
│       └── auth.js            # 認証ヘルパー（OAuth フロー）
└── App.js
```

**重要:** bakusai.com へのリクエスト処理は必ず `src/utils/bakusai.js` に集約する。

---

## bakusai.js API 設計（予定）

| 関数 | シグネチャ | 戻り値 | ログイン |
|------|----------|--------|:--------:|
| `getCategories` | `(acode)` | `Category[]` | 不要 |
| `getBoards` | `(acode, ctgid)` | `Board[]` | 不要 |
| `getThreadList` | `(acode, ctgid, bid, page=1)` | `{ threads, nextPage }` | 不要 |
| `getThread` | `(acode, ctgid, bid, tid, page=1)` | `{ title, responses, nextPage, totalRes, formFields }` | 不要 |
| `getResponse` | `(acode, ctgid, bid, tid, rrid)` | `Response` | 不要 |
| `getRatingList` | `(tid, rrids)` | `RatingResult[]` | 不要（カウントのみ） |
| `pushRating` | `(tid, rrid, rateId)` | `{ success, goodCount, badCount }` | **必須** |
| `postResponse` | `(formFields, body, name?, image?)` | `{ status }` | 不要（国内IP） |
| `search` | `(acode, word)` | `{ results }` | 不要 |
| `getSuggestions` | `(acode, word)` | `string[]` | 不要 |

### データ型

```javascript
// スレッド
{
  tid: string,
  title: string,
  updateTime: string,     // "9時間前" 等
  viewCount: number,      // 閲覧数
  resCount: number,       // レス数
  href: string,           // 完全な URL パス
}

// レス
{
  number: number,          // レス番号
  author: string,          // 投稿者名（デフォルト「匿名さん」）
  date: string,            // "YYYY/MM/DD HH:MM"
  body: string,            // 本文（テキスト）
  imageUrl: string | null, // 画像 URL
  goodCount: number,       // AJAX で取得（初期値 0）
  badCount: number,        // AJAX で取得（初期値 0）
  goodPushed: boolean | null,
  badPushed: boolean | null,
}

// Good/Bad 結果
{
  good: { count: number, pushed: boolean | null },
  bad:  { count: number, pushed: boolean | null },
}

// フォームフィールド（投稿用）
{
  bid: string,
  tid: string,
  ctgid: string,
  acode: string,
  tp: string,
  loaded_at: string,      // Unix timestamp
  actionUrl: string,       // POST 先 URL
}
```

---

## 共通ヘッダー

```javascript
const BASE_URL = 'https://bakusai.com'

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Mobile/15E148 Safari/604.1',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ja-JP,ja;q=0.9',
}

// AJAX 用（Good/Bad、投稿）
const AJAX_HEADERS = {
  ...HEADERS,
  'X-Requested-With': 'XMLHttpRequest',
}
```

Cloudflare 不使用のため、UA ローテーションは不要。固定 UA で十分。
ただし UA なしだと 403 の報告があるため、必ず設定すること。

---

## 既存の競合アプリ

| アプリ | プラットフォーム | 特徴 |
|--------|----------------|------|
| 爆リーII | Android | 最も有名。お気に入り・NG・一括更新・テーマ |
| Bomb Rhino | Android | お気に入り・ストーリーズ |
| ThreadMaster | iOS | 爆サイ+5ch+4chan 対応。評価 4.3（2,454件） |
| Siki | Desktop | Electron 製。爆サイ+5ch+まちBBS 等 |

### 差別化戦略

| 機能 | 爆リーII | ThreadMaster | 本アプリ |
|------|---------|-------------|---------|
| MQTT リアルタイム更新 | ? | ? | **○** |
| iOS 対応 | ✗ | ○ | **○** |
| Android 対応 | ○ | ✗ | **○** |
| モダン UI | △ | ○ | **○** |
| ダークモード | ○ | ○ | **○** |
| お気に入り一括更新 | ○ | ○ | **○** |
| NG ワード | ○ | ○ | **○** |
| 広告なし | △ | △ | **○** |

---

## 実装フェーズ

### フェーズ 1: 環境構築
- [ ] Yarn Workspaces モノレポ構成
- [ ] `apps/mobile` に Expo プロジェクト作成（ボイラープレートベース）
- [ ] React Navigation セットアップ
- [ ] ThemeContext（スキキラから流用）

### フェーズ 2: コアライブラリ（bakusai.js）— 閲覧機能
- [ ] 共通ヘッダー・fetch ラッパー
- [ ] `getThreadList` — スレッド一覧取得・パース
- [ ] `getThread` — スレッド詳細取得・パース
- [ ] `getRatingList` — Good/Bad カウント一括取得
- [ ] `search` — 検索
- [ ] `getSuggestions` — サジェスト

### フェーズ 3: 画面実装（閲覧系）
- [ ] BoardList（掲示板一覧・カテゴリマスター）
- [ ] ThreadList（スレッド一覧・無限スクロール）
- [ ] ThreadDetail（スレッド詳細・アンカーポップアップ・NG フィルタ）
- [ ] Search（検索・サジェスト）
- [ ] Settings（NG ワード・テーマ・地域設定）

### フェーズ 4: 投稿・Good/Bad
- [ ] `postResponse` — レス投稿（FormData + X-Requested-With）
- [ ] Post 画面（画像添付）
- [ ] ログイン機能（LINE/Google/X OAuth）— Good/Bad 投票用
- [ ] `pushRating` — Good/Bad 投票

### フェーズ 5: UX 強化
- [ ] お気に入り（フォルダ形式・一括更新）
- [ ] 既読管理（新着バッジ）
- [ ] 閲覧・投稿履歴
- [ ] MQTT リアルタイム更新
- [ ] ハプティクス
- [ ] スレ内検索

### フェーズ 6: リリース準備
- [ ] ランディングページ（Cloudflare Pages）
- [ ] プライバシーポリシー
- [ ] アプリアイコン・スプラッシュスクリーン
- [ ] ストアメタデータ
- [ ] App Store / Google Play 申請

---

## 注意事項

- bakusai.com へのリクエストは過剰に行わない（ポーリング間隔に注意）
- MQTT 接続は表示中のスレッドのみ（バックグラウンド接続はしない）
- 画像アップロードは 15MB 制限
- スレッドは最大 1000 レスで打ち止め
- `bakusai_session` Cookie は httponly → React Native の fetch が OS レベルで自動管理
- 公式アプリは存在しない（FAQ 明記）→ 「非公式」を明示する必要がある
- レス投稿はログイン不要（国内 IP）。Good/Bad 投票のみログイン必須
- 「会員限定」テキストはナビメニューのラベル。コンテンツのアクセス制限ではない

---

## 調査スクリプト一覧

| スクリプト | 出力 | 内容 |
|-----------|------|------|
| `scripts/analyze_thread.py` | `out/analyze_thread.txt` | スレッド詳細 HTML 構造・フォーム・変数・MQTT |
| `scripts/analyze_ajax_post.py` | `out/analyze_ajax_post.txt` | JS ファイル取得（ajax_post_sp, mqtt_newres_sp 等） |
| `scripts/analyze_goodbad.py` | `out/analyze_goodbad.txt` | インラインスクリプト・Good/Bad ボタン HTML |
| `scripts/analyze_goodbad2.py` | `out/analyze_goodbad2.txt` | goodbadButton.js 全文・投票 API |
| `scripts/analyze_navigation.py` | `out/analyze_navigation.txt` | ナビゲーションリンク・正しい URL パターン |
| `scripts/analyze_pages.py` | `out/analyze_pages.txt` | 板一覧・カテゴリ・検索ページ構造 |
| `scripts/analyze_threaditem.py` | `out/analyze_threaditem.txt` | スレ一覧アイテム・レスブロック HTML |
