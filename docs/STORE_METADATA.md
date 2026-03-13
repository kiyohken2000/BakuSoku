# ストア申請メタデータ

コピペ用。提出前に最新バージョン番号・スクリーンショットを確認すること。

---

## App Store（Apple）

### アプリ名
```
BakuSoku
```
※ 30字以内。現在 8字。

### サブタイトル
```
ローカルクチコミ掲示板
```
※ 30字以内。現在 11字。

### プロモーションテキスト（検索結果上部に表示・170字以内）
```
爆サイ.com を広告なし・ダークモードで快適に。お気に入り・履歴・NGワード・スレ内検索など専用アプリならではの便利機能を搭載。アップデートのお知らせはここに反映されます。
```
※ いつでも審査なしで変更可能。キャンペーン・アップデート告知に使える。

### 説明文（4000字以内）
```
BakuSoku は、爆サイ.com を快適に閲覧するための非公式ブラウザアプリです。

【主な機能】

■ 広告なしで快適
煩わしい広告を一切排除。コンテンツだけに集中して閲覧できます。

■ ダークモード
目に優しいダークテーマを標準搭載。ライトモードとワンタップで切り替え可能。夜間の閲覧も快適です。

■ 爆速ブラウジング
ネイティブアプリならではの軽快な操作感。スレッドの読み込みもサクサク。

■ スレッド検索
キーワードでスレッドを横断検索。スレッド内のテキスト検索にも対応し、ハイライト表示と前後ナビゲーションで目当ての書き込みがすぐ見つかります。

■ お気に入り管理
板もスレッドもお気に入り登録可能。新着チェック機能で見逃しゼロ。

■ NGワードフィルタ
見たくないワードを非表示に。自分好みの閲覧環境をカスタマイズできます。

■ 書き込み対応
アプリから直接レスを投稿。アンカー（>>N）やコピーもワンタップで操作可能。

■ 全国17地域対応
北海道から沖縄まで全国17地域をカバー。地元の話題をすぐチェック。

■ 閲覧履歴・既読管理
閲覧履歴の自動保存と既読管理。前回の続きからすぐ再開できます。

■ その他の便利機能
・長押しコンテキストメニュー（お気に入り追加・ブラウザで開く等）
・アンカー（>>N）ポップアップ表示
・プルトゥリフレッシュ
・読む方向モード切替（1→ / →最新）
・スレタイ全文ポップアップ表示
・スレ読み再開（前回の続きから表示）

【プライバシーについて】
収集したデータはすべて端末内にのみ保存され、外部サーバーへは送信されません。
広告 SDK・クラッシュレポートツールは使用していません。

【免責事項】
本アプリは爆サイ.com（bakusai.com）の非公式アプリです。爆サイ.com および運営会社とは一切関係ありません。
コンテンツ取得のために爆サイ.com に直接アクセスします。書き込みの際には爆サイ.com のサーバーにデータが送信されます。
本アプリの利用によって生じたいかなる損害についても、開発者は責任を負いません。
```

### キーワード（100字以内・カンマ区切り・スペースなし）
```
爆サイ,爆サイ.com,掲示板,ローカル掲示板,地域掲示板,専ブラ,ブラウザ,広告なし,ダークモード,匿名掲示板,2ch,5ch
```
現在 約55字。残り45字の余裕あり。

### カテゴリ
```
プライマリ: ニュース
セカンダリ: ソーシャルネットワーキング
```

### 年齢レーティング
```
18+（ユーザー生成コンテンツ含む・成人向けカテゴリあり）
```
レーティング設定時の回答:
- 「ユーザー生成コンテンツ」→ あり（掲示板への書き込み機能）
- 「頻繁/激しい成人向けコンテンツ」→ あり（ユーザー投稿に含まれる可能性）
- 「頻繁/激しい汚い言葉」→ あり（ユーザー投稿に含まれる可能性）
- 「無制限のウェブアクセス」→ なし
- 「アルコール・タバコ」→ なし
- 「ギャンブル」→ なし

### URL 類
```
サポートURL:         https://bakusoku.pages.dev/#/support
マーケティングURL:   https://bakusoku.pages.dev
プライバシーポリシー: https://bakusoku.pages.dev/#/privacy
```

### 著作権
```
© 2026 BakuSoku
```

### レビュー用メモ（App Review Notes）
```
## Overview
BakuSoku is an unofficial native client for bakusai.com, a Japanese regional bulletin board. The app fetches public HTML from bakusai.com and presents it natively. No backend — all requests go directly to bakusai.com.

## No Account Required
No login needed. Launch and browse immediately. To post, tap the compose button on any thread screen.

## Features Beyond the Website (Guideline 4.2)
Native features not available on bakusai.com mobile:
1. Ad-Free — removes all ads
2. Dark Mode — full dark theme (website has none)
3. Favorites — boards and threads with new-post badges
4. History — automatic tracking with new-post count
5. NG Word Filter — hide posts by keyword
6. In-Thread Search — highlight + prev/next navigation
7. Reading Position Restore — resume from last read post
8. Anchor Popups — tap >>N to preview referenced post
9. Context Menus — long-press threads for quick actions
10. Haptic Feedback

## Privacy
- All data stored locally (AsyncStorage + SQLite). No backend, no analytics, no ad SDKs.
- Posting sends data directly to bakusai.com only.
- Policy: https://bakusoku.pages.dev/#/privacy

## UGC Moderation (Guideline 1.2)
App is rated 18+. bakusai.com is an adult-rated regional forum.
- EULA: Users agree to no-tolerance terms before posting.
- NG Word Filter: Hides posts matching registered keywords instantly.
- Block User: Tap flag icon on any post → adds poster's name to NG filter, hiding all their posts.
- Report: Tap flag icon → opens bakusai.com report page in browser.
- Contact: Settings → Support (https://bakusoku.pages.dev/#/support)
- Developer reviews forwarded reports within 24 hours.

## Disclaimer
Not affiliated with bakusai.com. Accesses public content only.

## Test Instructions
1. Launch → board list appears.
2. Tap region → category → board → thread list.
3. Tap thread → view posts, try >>N anchors, search icon, compose button.
4. Long-press thread → context menu (favorites, open in browser).
5. Check Favorites and History tabs.

## Test Account
Not required.
```

---

## Google Play

### アプリ名（50字以内）
```
BakuSoku
```

### ショート description（80字以内）
```
爆サイ.com の非公式ブラウザ。広告なし・ダークモード・お気に入り・履歴管理を快適に。
```
現在 約40字。

### 説明文（4000字以内）
```
BakuSoku は、爆サイ.com を快適に閲覧するための非公式ブラウザアプリです。

【主な機能】

■ 広告なしで快適
煩わしい広告を一切排除。コンテンツだけに集中して閲覧できます。

■ ダークモード
目に優しいダークテーマを標準搭載。ライトモードとワンタップで切り替え可能。夜間の閲覧も快適です。

■ 爆速ブラウジング
ネイティブアプリならではの軽快な操作感。スレッドの読み込みもサクサク。

■ スレッド検索
キーワードでスレッドを横断検索。スレッド内のテキスト検索にも対応し、ハイライト表示と前後ナビゲーションで目当ての書き込みがすぐ見つかります。

■ お気に入り管理
板もスレッドもお気に入り登録可能。新着チェック機能で見逃しゼロ。

■ NGワードフィルタ
見たくないワードを非表示に。自分好みの閲覧環境をカスタマイズできます。

■ 書き込み対応
アプリから直接レスを投稿。アンカー（>>N）やコピーもワンタップで操作可能。

■ 全国17地域対応
北海道から沖縄まで全国17地域をカバー。地元の話題をすぐチェック。

■ 閲覧履歴・既読管理
閲覧履歴の自動保存と既読管理。前回の続きからすぐ再開できます。

■ その他の便利機能
・長押しコンテキストメニュー（お気に入り追加・ブラウザで開く等）
・アンカー（>>N）ポップアップ表示
・プルトゥリフレッシュ
・読む方向モード切替（1→ / →最新）
・スレタイ全文ポップアップ表示
・スレ読み再開（前回の続きから表示）

【プライバシーについて】
収集したデータはすべて端末内にのみ保存され、外部サーバーへは送信されません。
広告 SDK・クラッシュレポートツールは使用していません。

【免責事項】
本アプリは爆サイ.com（bakusai.com）の非公式アプリです。爆サイ.com および運営会社とは一切関係ありません。
コンテンツ取得のために爆サイ.com に直接アクセスします。書き込みの際には爆サイ.com のサーバーにデータが送信されます。
本アプリの利用によって生じたいかなる損害についても、開発者は責任を負いません。
```

### カテゴリ
```
コミュニケーション
```

### コンテンツレーティング
```
IARC レーティング設定で回答:
- 「ユーザー生成コンテンツ」→ あり
- 「コミュニティ機能」→ あり
- 「性的なコンテンツ」→ ユーザー生成コンテンツに含まれる可能性あり
- 「暴力的なコンテンツ」→ ユーザー生成コンテンツに含まれる可能性あり
- 「ギャンブル」→ なし
→ 想定レーティング: Teen（12歳以上）
```

### データセーフティ
```
- データを外部サーバーに収集・共有するか → いいえ（端末内保存のみ）
- ユーザーがデータの削除を要求できるか → はい（設定→すべてのデータを削除）
- 個人情報の収集 → なし
- 位置情報の収集 → なし（地域選択は手動設定）
- アプリのアクティビティ → なし（端末内のみ）
- デバイス ID → なし
```

### タグ（最大5つ）
```
掲示板
ブラウザ
地域
ニュース
ソーシャル
```

### URL 類・連絡先
```
ウェブサイト:         https://bakusoku.pages.dev
プライバシーポリシー: https://bakusoku.pages.dev/#/privacy
メールアドレス:       retwpay@gmail.com
```

---

## スクリーンショット 撮影ガイド

提出時に必要な画面。以下の順番で並べると機能が伝わりやすい。

| # | 画面 | 内容 |
|---|------|------|
| 1 | 掲示板一覧 | カテゴリ一覧の全体像（ダークモード推奨） |
| 2 | スレッド一覧 | スレタイ・レス数・新着バッジが見える状態 |
| 3 | スレッド閲覧 | レスの本文・アンカー・Good/Bad が見える状態 |
| 4 | 検索 | 検索結果が表示されている状態 |
| 5 | お気に入り | 板・スレッドタブの切り替えが見える状態 |
| 6 | 書き込み | 投稿モーダルが開いている状態 |
| 7 | 設定 | ダークモードで各設定項目が見える状態 |

### サイズ要件
- **App Store**: 6.9インチ (1320×2868 または 1290×2796) が必須。他サイズは自動縮小される。
- **Google Play**: 最低2枚。推奨 1080×1920px（縦）または 1920×1080px（横）。

### フィーチャーグラフィック（Google Play 必須）
- サイズ: 1024 x 500 px
- 内容案: オレンジ(#f97316)グラデーション背景 + アプリアイコン + "BakuSoku" ロゴ + 「爆サイ.com を、もっと快適に。」

---

## 提出前チェックリスト

- [ ] `apps/mobile/app.json` の version / buildNumber / versionCode を更新
- [ ] `eas build` が通ること
- [ ] スクリーンショット 7枚準備（6.9インチサイズ）
- [ ] フィーチャーグラフィック 1024x500 準備（Google Play 用）
- [ ] プライバシーポリシー URL が生きていること（https://bakusoku.pages.dev/#/privacy）
- [ ] サポート URL が生きていること（https://bakusoku.pages.dev/#/support）
- [ ] App Store Connect でバンドルID `net.votepurchase.bakusoku` を登録済み
- [ ] Google Play Console でアプリ作成済み
- [ ] アプリアイコン 1024x1024（iOS）/ 512x512（Android）準備済み
