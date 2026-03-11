# 進捗管理 — BakuSoku（爆速）

最終更新: 2026-03-11（フェーズ1〜3 実装完了）

[Sukikira - GitHub](https://github.com/kiyohken2000/sukikira)

---

## 全体ステータス

| フェーズ | 状態 | 備考 |
|---------|:----:|------|
| 0. 調査 | **完了** | 通信仕様・HTML パース・API 全て特定済み |
| 1. 環境構築 | **完了** | |
| 2. コアライブラリ | **完了** | `src/lib/bakusai.js` |
| 3. 画面実装（閲覧系） | **完了** | BoardList / ThreadList / ThreadDetail / Search / Settings |
| 4. 投稿・Good/Bad | 一部完了 | 投稿 UI 実装済み・Good/Bad 表示のみ（投票は未実装） |
| 5. UX 強化 | 未着手 | |
| 6. リリース準備 | 未着手 | LP スケルトンのみ作成済み |

---

## フェーズ 0: 調査（完了）

- [x] bakusai.com のスクレイピング対策調査
- [x] スレッド詳細 HTML パース仕様特定
- [x] スレッド一覧 HTML パース仕様特定
- [x] 投稿 AJAX 仕様特定（ajax_post_sp.js 解析）
- [x] Good/Bad API 特定（goodbadButton.js 解析）
- [x] MQTT ペイロード形式特定（mqtt_newres_sp.js 解析）
- [x] URL パターン全体像の把握
- [x] カテゴリ・板一覧ページ構造確認
- [x] 検索ページ構造確認
- [x] 仕様書（SPEC.md）作成・更新

---

## フェーズ 1: 環境構築

- [x] `apps/mobile` に Expo プロジェクト作成（ボイラープレートベース）
- [x] React Navigation セットアップ（タブ + スタック）
- [x] ThemeContext（darkColors/lightColors）
- [x] SettingsContext（NG ワード・お気に入り・既読管理・履歴）
- [x] colors.js（オレンジアクセント `#f97316`）

---

## フェーズ 2: コアライブラリ（bakusai.js）

- [x] 共通ヘッダー・fetch ラッパー（Cookie 管理含む）
- [x] `getAreaTop(acode)` — カテゴリ・板一覧取得
- [x] `getBoards(acode, ctgid)` — 板一覧取得（bbstop フォールバック）
- [x] `getThreadList(acode, ctgid, bid, page)` — スレッド一覧取得・パース
- [x] `getThread(acode, ctgid, bid, tid, page)` — スレッド詳細取得・パース
- [x] `getRatingList(tid, rrids)` — Good/Bad カウント一括取得
- [x] `pushRating(tid, rrid, rateId)` — Good/Bad 投票（API 実装済み）
- [x] `postResponse(action, formFields, body, name)` — レス投稿
- [x] `search(acode, word)` — 全体検索
- [ ] `getSuggestions(acode, word)` — サジェスト（未実装）

---

## フェーズ 3: 画面実装（閲覧系）

- [x] BoardList — 地域選択 → カテゴリ → 掲示板一覧
- [x] ThreadList — スレッド一覧（無限スクロール・お気に入り★）
- [x] ThreadDetail — スレッド詳細（レス一覧・Good/Bad 表示・前ページ読み込み）
- [x] Search — 全体検索
- [x] Settings — NG ワード・テーマ・地域設定・お気に入り・閲覧履歴

---

## フェーズ 4: 投稿・Good/Bad

- [x] Post — レス投稿 UI（ThreadDetail 内モーダル、FormData + X-Requested-With）
- [ ] Good/Bad 投票 UI（ログイン必須） — カウント表示は実装済み
- [ ] ログイン機能（LINE/Google/X OAuth via expo-web-browser）
- [ ] AuthContext（ログイン状態管理）

---

## フェーズ 5: UX 強化

- [ ] MQTT リアルタイム更新（最大の差別化機能）
- [ ] お気に入り（フォルダ形式・一括更新）
- [ ] 既読管理（新着バッジ）
- [ ] 閲覧・投稿履歴
- [ ] ハプティクス
- [ ] スレ内検索
- [ ] アンカー（`>>NNN`）ポップアップ

---

## フェーズ 6: リリース準備

- [ ] アプリアイコン作成（`docs/ICON_PROMPTS.md` 参照）
- [ ] スプラッシュスクリーン
- [ ] ランディングページ（`apps/web/`、Cloudflare Pages）
- [ ] プライバシーポリシー
- [ ] ストアメタデータ
- [ ] App Store 申請
- [ ] Google Play 申請

---

## 完了済みの作業ログ

| 日付 | 作業内容 |
|------|---------|
| 2026-03-11 | プロジェクト作成、通信仕様調査完了、SPEC.md 作成、LP スケルトン作成 |
| 2026-03-11 | フェーズ1-3 実装完了: ThemeContext / SettingsContext / bakusai.js / 全閲覧画面 / 投稿 UI |
