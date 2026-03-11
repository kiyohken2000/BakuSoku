# 引継ぎドキュメント — BakuSoku（爆速）

最終更新: 2026-03-11

---

## プロジェクト概要

爆サイ.com (bakusai.com) の非公式ブラウザアプリ。
スキキラ（好き嫌い.com 専ブラ）のアーキテクチャ・UI設計を流用する。

- アプリ名: **BakuSoku（爆速）**
- フレームワーク: Expo (React Native)
- バックエンドなし。bakusai.com を直接 fetch
- 詳細仕様: `docs/SPEC.md`

---

## リポジトリ構成

```
bakusai/
├── apps/
│   ├── mobile/          # Expo アプリ本体（未着手）
│   └── web/             # ランディングページ（Vite + React、スケルトンのみ）
├── docs/
│   ├── SPEC.md          # 技術仕様書（通信仕様・HTML パース・API 設計）
│   ├── HANDOFF.md       # 本ファイル
│   ├── PROGRESS.md      # 進捗管理
│   └── ICON_PROMPTS.md  # アイコン生成プロンプト
└── scripts/
    ├── analyze_thread.py       # スレッド詳細 HTML 解析
    ├── analyze_ajax_post.py    # JS ファイル取得・投稿仕様解析
    ├── analyze_goodbad.py      # Good/Bad ボタン HTML・インラインスクリプト
    ├── analyze_goodbad2.py     # goodbadButton.js 解析（投票 API 特定）
    ├── analyze_navigation.py   # ナビゲーションリンク・URL パターン特定
    ├── analyze_pages.py        # 板一覧・カテゴリ・検索ページ構造
    ├── analyze_threaditem.py   # スレ一覧アイテム・レスブロック HTML
    └── out/                    # 解析出力ファイル
```

---

## 通信仕様の要点（SPEC.md の要約）

### スクレイピング対策
- **Cloudflare なし**。CAPTCHA なし。レートリミットなし
- スキキラで苦労した問題は全て存在しない
- 固定 UA 1つで OK。ローテーション不要

### 主要エンドポイント

| 用途 | メソッド | URL |
|------|---------|-----|
| スレ一覧 | GET | `/thr_tl/acode={A}/ctgid={C}/bid={B}/` |
| スレ詳細 | GET | `/thr_res/acode={A}/ctgid={C}/bid={B}/tid={T}/tp=1/` |
| カテゴリ板一覧 | GET | `/bbstop/acode={A}/ctgid={C}/` |
| 全体検索 | GET | `/sch_all/acode={A}/word={W}/` |
| Good/Bad 取得 | POST | `/rating_list/` |
| Good/Bad 投票 | POST | `/rating_push` |
| レス投稿 | POST | スレッドの URL（FormData + `X-Requested-With: XMLHttpRequest`） |

### MQTT リアルタイム
- `wss://mqtt1.bakusai.com:8084/mqtt`
- トピック: `thread/{tid}`
- ペイロード: `{rrid, body, date, name}`
- 認証不要（clientId のみ）

### 投稿
- ログイン不要（国内 IP）
- CSRF トークン不要
- FormData で POST、レスポンス `{status: 'success'|'cushion'}`

### Good/Bad
- カウント取得はログイン不要
- 投票はログイン必須

---

## スキキラとの違い・注意点

| | スキキラ | BakuSoku |
|---|---|---|
| Cloudflare 対策 | 必須（UA ローテ・キャッシュバスト等） | **不要** |
| CSRF トークン | `auth1`/`auth2`/`auth-r` | **なし** |
| ページネーション | `?nxc=` クエリ（WAF にブロックされた） | URL パス `/p={N}/`（問題なし） |
| Cookie 管理 | `sk_anie`/`sk_vote` 等複雑 | `bakusai_session` のみ |
| リアルタイム更新 | なし | MQTT WebSocket |
| 投稿認証 | Cookie ベース | ログイン不要（国内 IP） |

---

## 次のステップ

`docs/PROGRESS.md` のフェーズ 1 から着手。
