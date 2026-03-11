# 進捗管理 — BakuSoku（爆速）

最終更新: 2026-03-11

[Sukikira - GitHub](https://github.com/kiyohken2000/sukikira)

---

## 全体ステータス

| フェーズ | 状態 | 備考 |
|---------|:----:|------|
| 0. 調査 | **完了** | 通信仕様・HTML パース・API 全て特定済み |
| 1. 環境構築 | 未着手 | |
| 2. コアライブラリ | 未着手 | |
| 3. 画面実装（閲覧系） | 未着手 | |
| 4. 投稿・Good/Bad | 未着手 | |
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
- [ ] React Navigation セットアップ（タブ + スタック）
- [ ] ThemeContext（スキキラから流用、darkColors/lightColors）
- [ ] SettingsContext（NG ワード・お気に入り・既読管理・履歴）
- [ ] colors.js（オレンジアクセント `#f97316`）

---

## フェーズ 2: コアライブラリ（bakusai.js）

- [ ] 共通ヘッダー・fetch ラッパー
- [ ] `getCategories(acode)` — カテゴリ一覧取得
- [ ] `getBoards(acode, ctgid)` — 板一覧取得
- [ ] `getThreadList(acode, ctgid, bid, page)` — スレッド一覧取得・パース
- [ ] `getThread(acode, ctgid, bid, tid, page)` — スレッド詳細取得・パース
- [ ] `getRatingList(tid, rrids)` — Good/Bad カウント一括取得
- [ ] `pushRating(tid, rrid, rateId)` — Good/Bad 投票
- [ ] `postResponse(formFields, body, name, image)` — レス投稿
- [ ] `search(acode, word)` — 全体検索
- [ ] `getSuggestions(acode, word)` — サジェスト

---

## フェーズ 3: 画面実装（閲覧系）

- [ ] BoardList — 地域選択 → カテゴリ → 掲示板一覧
- [ ] ThreadList — スレッド一覧（無限スクロール）
- [ ] ThreadDetail — スレッド詳細（レス一覧・Good/Bad 表示）
- [ ] Search — 全体検索
- [ ] Settings — NG ワード・テーマ・地域設定

---

## フェーズ 4: 投稿・Good/Bad

- [ ] Post — レス投稿画面（FormData + X-Requested-With）
- [ ] Good/Bad 投票 UI（ログイン必須）
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
