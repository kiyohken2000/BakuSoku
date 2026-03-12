# 進捗管理 — BakuSoku（爆速）

最終更新: 2026-03-11

[Sukikira - GitHub](https://github.com/kiyohken2000/sukikira)

---

## 全体ステータス

| フェーズ | 状態 | 備考 |
|---------|:----:|------|
| 0. 調査 | **完了** | 通信仕様・HTML パース・API 全て特定済み |
| 1. 環境構築 | **完了** | |
| 2. コアライブラリ | **完了** | `src/lib/bakusai.js` |
| 3. 画面実装（閲覧系） | **完了** | BoardList / ThreadList / ThreadDetail / Search / Settings / History / Favorites / NgWords |
| 4. 投稿 | 一部完了 | ログイン不要の匿名投稿 UI 実装済み・EULA 同意フロー実装済み |
| 5. UX 強化 | 進行中 | 各種機能実装済み（下記参照） |
| 6. リリース準備 | 未着手 | LP スケルトンのみ作成済み |
| — | **後回し** | ログイン機能・Good/Bad 投票・AuthContext（ログイン必須機能は全て保留） |

---

## フェーズ 0: 調査（完了）

- [x] bakusai.com のスクレイピング対策調査
- [x] スレッド詳細 HTML パース仕様特定
- [x] スレッド一覧 HTML パース仕様特定
- [x] 投稿 AJAX 仕様特定（ajax_post_sp.js 解析）
- [x] Good/Bad API 特定（goodbadButton.js 解析）
- [x] MQTT ペイロード形式特定（mqtt_newres_sp.js 解析）
- [x] URL パターン全体像の把握
- [x] カテゴリ・板一覧ページ構造確認（通常・成人・ギャンブル）
- [x] 検索ページ構造確認
- [x] rw=1 ページネーション構造確認（Python スクリプトで詳細調査）
- [x] 仕様書（SPEC.md）作成・更新

---

## フェーズ 1: 環境構築

- [x] `apps/mobile` に Expo プロジェクト作成（ボイラープレートベース）
- [x] React Navigation セットアップ（タブ + スタック）
- [x] ThemeContext（darkColors/lightColors）
- [x] SettingsContext（NG ワード・お気に入り・既読管理・履歴・投稿EULA・再開ページ）
- [x] colors.js（オレンジアクセント `#f97316`）

---

## フェーズ 2: コアライブラリ（bakusai.js）

- [x] 共通ヘッダー・fetch ラッパー（Cookie 管理含む）
- [x] `getAreaTop(acode)` — カテゴリ・板一覧取得（通常・成人・ギャンブル並列フェッチ）
- [x] `getBoards(acode, ctgid)` — 板一覧取得
- [x] `getThreadList(acode, ctgid, bid, page)` — スレッド一覧取得・パース
- [x] `getThread(acode, ctgid, bid, tid, page)` — スレッド詳細取得・パース（最新ページ）
- [x] `getThreadFromStart(acode, ctgid, bid, tid, page)` — rw=1 モード（最古ページから）
- [x] `checkThreadLatestRrid(acode, ctgid, bid, tid)` — 新着チェック用最新 RRID 取得
- [x] `getRatingList(tid, rrids)` — Good/Bad カウント一括取得
- [x] `pushRating(tid, rrid, rateId)` — Good/Bad 投票（API 実装済み）
- [x] `postResponse(action, formFields, body, name)` — レス投稿
- [x] `search(acode, word)` — 全体検索（updatedAt・resCount 取得対応）
- [x] `getResShow(acode, ctgid, bid, tid, rrid)` — アンカーポップアップ用単一レス取得
- [ ] `getSuggestions(acode, word)` — サジェスト（未実装）

---

## フェーズ 3: 画面実装（閲覧系）

- [x] BoardList — カテゴリ → 掲示板一覧（成人・ギャンブルをメモ条件で表示切替）
- [x] ThreadList — スレッド一覧（無限スクロール・新着バッジ・長押しコンテキストメニュー）
- [x] ThreadDetail — スレッド詳細（レス一覧・Good/Bad 表示・無限スクロール・再開読み込み）
- [x] Search — 全体検索（×クリアボタン・最終更新日時・レス数表示）
- [x] Settings — NG ワード・テーマ・地域設定・メモ欄（成人表示制御）
- [x] NgWords — NGワード管理画面
- [x] History — 閲覧履歴（長押しコンテキストメニュー・新着チェック）
- [x] Favorites — お気に入り掲示板・スレ（スレタブに新着チェック）

---

## フェーズ 4: 投稿

- [x] Post — レス投稿 UI（ThreadDetail 内モーダル、FormData + X-Requested-With）
- [x] 投稿前 EULA 同意モーダル（初回のみ表示、AsyncStorage に保存）
- [x] 「このレスにレス」機能（`>>N` を本文に挿入してモーダルを開く）
- [~] Good/Bad 投票 UI — カウント表示のみ実装済み（**投票はログイン必須のため後回し**）

### 後回し（ログイン必須機能）

> ログイン機能の実装は優先度を下げ、後のフェーズで対応する。

- [ ] ログイン機能（LINE/Google/X OAuth via expo-web-browser）
- [ ] AuthContext（ログイン状態管理）
- [ ] Good/Bad 投票 UI（ログイン後に解放）
- [ ] スレ作成機能（スレタイ・本文・名前入力、○×モードを渡す POST）

---

## フェーズ 5: UX 強化

- [x] 既読管理（新着バッジ）— seenCounts / readSet による新着判定
- [x] ハプティクス — BoardList / ThreadList / ThreadDetail
- [x] アンカー（`>>NNN`）ポップアップ — ThreadDetail 内でタップしてポップアップ表示（ページ外レスもフェッチ）
- [x] プルトゥリフレッシュ — ThreadDetail（上引っ張りで新着追加）・ThreadList
- [x] 無限スクロール — ThreadDetail（1→モード: 下端で次ページ自動ロード / →最新モード: 下端で古いレス自動ロード）
- [x] 読む方向モード切替（1→ / →最新）— 全スレ共通・永続化
- [x] スレ読み再開 — rw=1 モードで最後に読んだページを保存・復元（readPositions）
- [x] 長押しコンテキストメニュー — ThreadList / History（お気に入り追加・ブラウザで開く等）
- [x] スレタイ全文ポップアップ — ThreadDetail ヘッダータップ
- [x] 新着チェック（手動・並列5件） — History・Favorites スレタブ
- [x] 空ページ連続スキップ — rw=1 モードで 0 件ページが続いても最大3ページ自動スキップ
- [x] react-native-vector-icons/FontAwesome によるアイコン統一
- [ ] MQTT リアルタイム更新（最大の差別化機能）
- [x] スレ内検索（テキスト検索・ハイライト・件数表示・前後ナビ）
- [x] スレ一覧キャッシュクリア＆再取得（ThreadDetail ヘッダーメニュー）
- [x] 天気予報ボード対応（weather_thr_list_box レイアウト専用パーサー追加）

---

## フェーズ 6: リリース準備

- [x] アプリアイコン作成（`docs/ICON_PROMPTS.md` 参照）
- [x] スプラッシュスクリーン
- [x] ランディングページ（`apps/web/`、Cloudflare Pages）
- [x] プライバシーポリシー
- [[x] ストアメタデータ
- [ ] App Store 申請
- [ ] Google Play 申請

---

## 完了済みの作業ログ

| 日付 | 作業内容 |
|------|---------|
| 2026-03-11 | プロジェクト作成、通信仕様調査完了、SPEC.md 作成、LP スケルトン作成 |
| 2026-03-11 | フェーズ1-3 実装完了: ThemeContext / SettingsContext / bakusai.js / 全閲覧画面 / 投稿 UI |
| 2026-03-11 | パーサーバグ修正（スペース2個・li要素・重複rrid）、フェーズ5 UX強化（アンカーポップアップ・新着バッジ・ハプティクス・プルトゥリフレッシュ）|
| 2026-03-11 | Python調査スクリプト群作成、HTML構造の全容解明・パーサー全面修正（日時・名前・スレ一覧ページネーション・検索結果）|
| 2026-03-11 | 全域調査完了・bakusai.js 完全修正（getResShow追加・isPinned・updatedAt decodeEntities）・アンカーポップアップをページ外レスもフェッチ対応 |
| 2026-03-11 | rw=1 ページネーション全面修正（動的リンク検出方式）・読む方向モード全スレ共通化・履歴/お気に入りタブ追加・バッチロード＆無限スクロール |
| 2026-03-11 | FontAwesome アイコン統一・NGワード管理画面・外観スイッチ右寄せ・成人/ギャンブルカテゴリ追加（メモ欄条件表示）|
| 2026-03-11 | 不要改行除去・&ensp;デコード修正・スレタイ全文ポップアップ・「このレスにレス」機能・投稿EULA・最新から表示モードの降順修正 |
| 2026-03-11 | 引っ張り更新修正（stale closure→useRef）・rw=1 ページネーション regex 改善・空ページスキップロジック |
| 2026-03-11 | BoardList パフォーマンス最適化（React.memo / useCallback / useMemo / SectionList 仮想化props）|
| 2026-03-11 | スレ読み再開機能（readPositions: rw=1 モードで最後に読んだページを保存・復元）|
| 2026-03-11 | 長押しコンテキストメニュー（ThreadList / History）・お気に入りスレ追加/削除 |
| 2026-03-11 | 新着チェック機能（History・Favorites スレタブ・並列5件・進捗表示・バッジ）|
| 2026-03-11 | 検索画面改善（×クリアボタン・結果に最終更新日時・レス数表示）・空ページ連続スキップ（最大3ページ）|
| 2026-03-11 | 投稿機能実装（FormData修正・Refererヘッダー・クッションページ自動処理） |
| 2026-03-11 | スレ内検索（テキスト検索・ハイライト・前後ナビ）・キャッシュクリア＆再取得機能 |
| 2026-03-11 | 設定画面に外部リンク追加（LP・PP・利用規約・サポート） |
| 2026-03-11 | 画像ボード対応（weather_thr_list_box・photograph_thr_list_wrapper 専用パーサー追加） |
