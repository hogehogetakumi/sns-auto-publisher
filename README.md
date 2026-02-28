# SNS自動投稿バッチシステム - 実装完了ウォークスルー

## 概要

設計書に基づき、Google Driveを起点として複数SNS（YouTube / TikTok / Instagram / X）へ動画を自動投稿するTypeScriptバッチシステムを実装しました。

## ディレクトリ構成

```
SNS_HUB/
├── .github/workflows/batch.yml     # GitHub Actions（毎日19:00 JST）
├── src/
│   ├── config/env.ts               # 環境変数管理・バリデーション
│   ├── types/index.ts              # 全型定義
│   ├── services/
│   │   ├── drive.ts                # Google Drive API
│   │   ├── youtube.ts              # YouTube Shorts
│   │   ├── tiktok.ts               # TikTok Direct Post
│   │   ├── instagram.ts            # Instagram Reels
│   │   ├── x.ts                    # X (条件付き)
│   │   └── mail.ts                 # Gmail通知
│   ├── utils/logger.ts             # ログユーティリティ
│   └── index.ts                    # メインフロー制御
├── .env.example                    # 環境変数テンプレート
├── .gitignore
├── package.json
└── tsconfig.json
```

## 処理フロー

```mermaid
flowchart TD
    A["Phase 1: 初期化"] --> B["環境変数読み込み\n必須キーチェック\nXフラグ判定"]
    B --> C["Phase 2: ファイル取得"]
    C --> D["投稿待ちフォルダから\nMP4 + JSON ペア取得"]
    D --> E["Phase 3: 直列アップロード"]
    E --> F["YouTube Shorts"]
    F --> G["TikTok"]
    G --> H["Instagram Reels"]
    H --> I{"X有効?"}
    I -- Yes --> J["X投稿"]
    I -- No --> K["スキップ"]
    J --> L["Phase 4: 後処理"]
    K --> L
    L --> M{"全成功?"}
    M -- Yes --> N["ファイルを投稿済みフォルダへ移動"]
    M -- No --> O["ファイルは元の位置に保持"]
    N --> P["メール通知送信"]
    O --> P
```

## 主要な設計ポイント

| 設計項目 | 実装内容 |
|---------|---------|
| X条件付き実行 | 環境変数の有無で`isXEnabled`フラグを自動設定 |
| 直列実行 | YouTube→TikTok→Instagram→Xの順に直列で実行 |
| 逐次ステータス更新 | 各SNS成功時にGoogle Drive上のJSONを即時更新 |
| 成功判定 | X無効時はYT/TT/IGのみ、X有効時は全4媒体で判定 |
| エラーハンドリング | 1媒体の失敗がバッチ全体を停止させない設計 |
| メール通知 | HTML形式のバッジ付きサマリーレポート |

## 検証結果

- ✅ `npm install` — 69パッケージインストール成功
- ✅ `npx tsc --noEmit` — TypeScriptコンパイルエラー **ゼロ**

## 次のステップ

1. GitHub リポジトリにpush
2. GitHub Secretsに認証情報を登録（`.env.example` 参照）
3. Google Driveに「投稿待ちフォルダ」と「投稿済みフォルダ」を作成
4. 手動実行（workflow_dispatch）でE2Eテスト
# sns-auto-publisher
