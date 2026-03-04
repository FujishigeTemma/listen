# listen

DJ配信・アーカイブプラットフォーム

## アーキテクチャ

| コンポーネント | パス                | 説明                                                       |
| -------------- | ------------------- | ---------------------------------------------------------- |
| Admin Server   | `apps/admin/server` | Hono (Node.js) — 録音・HLSセグメント管理・R2アップロード   |
| Admin Client   | `apps/admin/client` | Vite + React — 管理画面                                    |
| Web App        | `apps/web`          | Vite + Cloudflare Workers (Hono) + React — リスナー向けSPA |
| DB Schema      | `packages/db`       | Drizzle ORM スキーマ定義                                   |
| Shared         | `packages/shared`   | 共有ユーティリティ                                         |

## 前提条件

- Node.js >= 20
- pnpm >= 9
- ffmpeg (録音機能に必須)

## 外部サービス依存

| サービス      | 用途                     | 必要なキーの取得先   |
| ------------- | ------------------------ | -------------------- |
| Cloudflare D1 | データベース             | Cloudflare Dashboard |
| Cloudflare R2 | HLSセグメントストレージ  | Cloudflare Dashboard |
| Clerk         | 認証                     | clerk.com            |
| Polar         | 課金・サブスクリプション | polar.sh             |

## 環境変数の設定

### 開発環境 (dev)

1. ルートの `.env` を作成:

```sh
cp .env.example .env
# 各値を実際の値で埋める
```

2. Web Worker 用の `.dev.vars` を作成:

```sh
cp apps/web/.dev.vars.example apps/web/.dev.vars
# 各値を実際の値で埋める
```

### 本番環境 (prod)

- Admin Server: デプロイ先のホスティングサービスで環境変数を設定
- Web Worker: `wrangler secret put <KEY>` でシークレットを登録
  - `wrangler.jsonc` の `database_id` を実際の D1 データベースIDに変更

### 環境変数一覧

#### Admin Server

| 変数名                 | 必須     | デフォルト     | 説明                                           |
| ---------------------- | -------- | -------------- | ---------------------------------------------- |
| `PORT`                 | -        | `8080`         | サーバーポート                                 |
| `DATA_DIR`             | -        | `./data`       | HLSセグメント一時保存ディレクトリ              |
| `FFMPEG_INPUT_FMT`     | -        | `avfoundation` | ffmpeg入力フォーマット                         |
| `FFMPEG_INPUT`         | -        | `:0`           | ffmpeg入力デバイス                             |
| `FFMPEG_BITRATE`       | -        | `192k`         | エンコードビットレート                         |
| `HLS_TIME`             | -        | `4`            | HLSセグメント長(秒)                            |
| `HLS_LIST_SIZE`        | -        | `15`           | プレイリスト内セグメント数                     |
| `HLS_FORMAT`           | -        | `cmaf`         | HLSセグメント形式 (`mpegts` / `fmp4` / `cmaf`) |
| `R2_ENDPOINT`          | **必須** | -              | R2 S3互換エンドポイント                        |
| `R2_ACCESS_KEY_ID`     | **必須** | -              | R2 アクセスキーID                              |
| `R2_SECRET_ACCESS_KEY` | **必須** | -              | R2 シークレットアクセスキー                    |
| `R2_BUCKET`            | -        | `dj-hls`       | R2 バケット名                                  |
| `CF_API_TOKEN`         | **必須** | -              | Cloudflare APIトークン                         |
| `CF_ACCOUNT_ID`        | **必須** | -              | CloudflareアカウントID                         |
| `D1_DATABASE_ID`       | **必須** | -              | D1データベースID                               |

#### Admin Client

| 変数名            | 必須     | 説明                 |
| ----------------- | -------- | -------------------- |
| `VITE_API_BASE`   | **必須** | Admin Server API URL |
| `VITE_PUBLIC_URL` | **必須** | 公開URL              |
| `VITE_HLS_BASE`   | **必須** | HLS配信ベースURL     |

#### Web Client

| 変数名                       | 必須     | 説明          |
| ---------------------------- | -------- | ------------- |
| `VITE_CLERK_PUBLISHABLE_KEY` | **必須** | Clerk公開キー |

#### Web Worker (`.dev.vars` / Wrangler Secrets)

| 変数名                         | 必須     | 説明                          |
| ------------------------------ | -------- | ----------------------------- |
| `CLERK_SECRET_KEY`             | **必須** | Clerkシークレットキー         |
| `CLERK_PUBLISHABLE_KEY`        | **必須** | Clerk公開キー                 |
| `CLERK_WEBHOOK_SIGNING_SECRET` | **必須** | Clerk Webhook署名シークレット |
| `POLAR_ACCESS_TOKEN`           | **必須** | Polarアクセストークン         |
| `POLAR_WEBHOOK_SECRET`         | **必須** | Polar Webhookシークレット     |
| `POLAR_PRODUCT_ID`             | **必須** | Polar商品ID                   |

## 開発

```sh
pnpm install
pnpm dev
```

| プロセス     | ポート |
| ------------ | ------ |
| Admin Server | 8080   |
| Admin Client | 5173   |
| Web App      | 8787   |

### ffmpeg の設定

- macOS: デフォルト設定 (`avfoundation`, `:0`) で動作
- Linux: `.env` で `FFMPEG_INPUT_FMT=alsa`, `FFMPEG_INPUT=hw:1,0` に変更
