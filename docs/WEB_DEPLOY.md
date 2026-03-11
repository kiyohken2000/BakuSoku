# Web (ランディングページ) デプロイ手順

## ホスティング

Cloudflare Pages（GitHub 連携なし・手動デプロイ）

- **プロジェクト名**: `bakusoku`
- **本番 URL**: https://bakusoku.pages.dev/
- **プライバシーポリシー**: https://bakusoku.pages.dev/#/privacy
- **利用規約**: https://bakusoku.pages.dev/#/terms
- **サポート**: https://bakusoku.pages.dev/#/support

## デプロイコマンド

```bash
cd apps/web && npm run build && npx wrangler pages deploy dist --project-name bakusoku --commit-dirty=true
```

## 技術スタック

- Vite + React (SPA)
- ハッシュルーティング (`#/privacy`, `#/terms`, `#/support`)
- CSS のみ（UIライブラリなし）

## ディレクトリ構成

```
apps/web/
├── src/
│   ├── App.jsx          # ランディングページ + ルーター
│   ├── App.css          # ランディングページのスタイル
│   ├── index.css        # グローバルリセット
│   ├── main.jsx         # エントリポイント
│   ├── pages/
│   │   ├── Privacy.jsx  # プライバシーポリシー
│   │   ├── Terms.jsx    # 利用規約
│   │   ├── Support.jsx  # サポート (FAQ + お問い合わせ)
│   │   └── Legal.css    # 法務ページ共通スタイル
│   └── assets/imsages/
│       ├── icon.png     # アプリアイコン
│       ├── favicon.ico
│       ├── badges/
│       │   ├── appstore.png
│       │   └── googleplay.png
│       └── screenshots/
│           └── *.jpg    # アプリスクリーンショット (12枚)
├── index.html
├── vite.config.js
└── package.json
```

## 備考

- ストアバッジ（App Store / Google Play）はまだリンクなし・半透明表示（未公開のため）
- 公開後、`App.jsx` 内の `<img className="store-badge">` を `<a>` で囲んでストア URL を設定する
- assets ディレクトリ名が `imsages`（typo）だが、ビルドに影響なし
