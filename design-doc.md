# Design Doc: DJ Audio Livestream (Node.js + Hono + React + Cloudflare)

- **Status**: Draft (v6)
- **Last updated**: 2026-01-23
- **Repo**: monorepo（pnpm workspace）

---

## 1. 背景と課題

DJミキサー（Xone:92）からの音声を、Tascam DR-05XP をオーディオインターフェースとしてPCに取り込み、**高音質の音声オンリー配信**を行う。

当初、PCを配信オリジン（視聴者に直接HLSを配る）にすると、視聴者数増加時に**自宅回線の上り（egress）がボトルネック**になり、音切れ・バッファリングが起こりやすい。

そこで本設計では、

- PCは **「生成（ffmpeg）」と「アップロード（Node.js）」**に専念
- 視聴者への配信は **Cloudflare（CDN + R2）** に寄せる
- メタデータ管理に **Cloudflare D1（SQLite）** を採用
- 認証に **Clerk**、課金に **polar.sh** を採用

ことで、スケールと安定性を確保しつつ、通知機能や課金コンテンツへの拡張性を持たせる。

---

## 2. ゴール

### 機能ゴール

- **ローカル管理画面**から配信枠（ID=日付）を作成し、Start/Stopできる
- 配信中はリンクから **ライブとして聴ける**
- 配信終了後は **閲覧期限内であれば同じリンクでアーカイブ再生（シーク可能）**
- **課金ユーザーは閲覧期限に関係なく全アーカイブにアクセス可能**
- **アーカイブ一覧ページ**で過去配信を閲覧できる
- **メール登録**で配信開始・配信予定の通知を受け取れる
- **アカウント登録（課金）**でプレミアム機能を利用できる
- 視聴ページはスマホブラウザで開け、`<audio>`で再生できる

### 非機能ゴール（最優先）

- **音声が途切れにくい**（遅延は許容）
- 視聴者が増えても **ローカルPCのegressが詰まらない**
- 実装は極力ミニマル（複雑な配信サーバなし）
- **型安全なAPI呼び出し**（Hono RPC + TanStack Query）
- **ミニマルながら洗練されたUI**（Tailwind CSS v4 + shadcn/ui）

---

## 3. 非ゴール

- WebRTC級の超低遅延
- 高度な視聴分析（訪問ログは将来拡張で optional）
- マルチビットレートABR（将来拡張）
- 複雑な課金プラン（単一プランのみ）

---

## 4. 技術スタック

### 4.1 共通

| カテゴリ             | 技術             |
| -------------------- | ---------------- |
| 言語                 | TypeScript       |
| パッケージマネージャ | pnpm (workspace) |
| Linter               | oxlint + ESLint  |
| Formatter            | oxfmt            |
| バリデーション       | Valibot          |
| ビルド               | tsup / Vite      |

### 4.2 API / データフェッチ

| カテゴリ     | 技術                      |
| ------------ | ------------------------- |
| サーバー     | Hono                      |
| クライアント | Hono RPC (`hono/client`)  |
| 状態管理     | TanStack Query            |
| 型共有       | Hono AppType エクスポート |

### 4.3 フロントエンド共通

| カテゴリ         | 技術            |
| ---------------- | --------------- |
| フレームワーク   | React 19        |
| ルーティング     | TanStack Router |
| スタイリング     | Tailwind CSS v4 |
| UIコンポーネント | shadcn/ui       |

### 4.4 ローカル（Admin）

| カテゴリ       | 技術                      |
| -------------- | ------------------------- |
| サーバー       | Node.js + Hono            |
| プロセス管理   | execa (ffmpeg制御)        |
| ファイル監視   | chokidar                  |
| R2アップロード | @aws-sdk/client-s3        |
| DB操作         | Drizzle ORM (D1 HTTP API) |

### 4.5 Cloudflare

| カテゴリ     | 技術                            |
| ------------ | ------------------------------- |
| API          | Cloudflare Workers + Hono       |
| 視聴ページ   | Cloudflare Pages + React + Vite |
| データベース | Cloudflare D1                   |
| DB操作       | Drizzle ORM                     |
| ストレージ   | Cloudflare R2                   |

### 4.6 外部サービス

| カテゴリ   | 技術     |
| ---------- | -------- |
| 認証       | Clerk    |
| 課金       | polar.sh |
| メール送信 | Resend   |

---

## 5. 主要な設計判断（Decision）

### 5.1 配信方式：音声オンリーHLS

- スマホ（特にiOS Safari）互換を優先し、**HLS + AAC**を採用
- クライアントは `<audio>` で再生（DOM最小）

### 5.2 途切れにくさ優先（遅延許容）

- セグメント長は **4〜6秒**（デフォルト4秒）
- live playlistのリストサイズは **10〜20**（デフォルト15）

### 5.3 Cloudflare R2 + CDNでegressを吸収

- 視聴者は `hls.<domain>`（R2のカスタムドメイン + CDN）から取得
- ローカルPCは視聴者トラフィックを受けない

### 5.4 `index.m3u8` を唯一の入口にして上書き切替

- 配信中：`index.m3u8` は **live相当**の内容
- 配信終了後：`index.m3u8` を **vod相当**の内容に差し替え

### 5.5 "完成したセグメント"だけを検知してPUT

- ffmpegの `hls_flags=temp_file` で一時ファイル経由
- chokidar で `add` イベントを検知（renameされた完成ファイル）

### 5.6 アップロード順序を厳守

- **必ず** `segment/init` を先にPUT → その後 `index.m3u8` をPUT

### 5.7 Hono RPC による型安全なAPI呼び出し

- サーバー側で `AppType` をエクスポート
- クライアント側で `hc<AppType>` を使用
- **エンドツーエンドの型安全性**を実現
- TanStack Query と組み合わせてキャッシュ・再検証を管理

### 5.8 パッケージ構成の統合

- **apps/admin**: ローカル完結（server + client）を1パッケージに
- **apps/web**: Cloudflare向け（Pages client + Workers API）を1パッケージに
- 関連コードの近接性向上、型共有の容易化

### 5.9 アーカイブ閲覧期限（2段階）

| ユーザー種別 | アクセス可能範囲             |
| ------------ | ---------------------------- |
| 匿名 / 無料  | 配信終了から **7日間**       |
| 課金ユーザー | **全アーカイブ**（期限なし） |

### 5.10 UIデザイン方針

- **ミニマル**：必要最小限の要素、余白を活かす
- **Tailwind CSS v4**：CSS-first config、Lightning CSS
- **shadcn/ui**：必要なコンポーネントのみ追加、カスタマイズ容易

---

## 6. システム構成

### 6.1 アーキテクチャ図

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Cloudflare Edge                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │   Pages      │  │   Workers    │  │     R2       │  │     D1      │ │
│  │  (React)     │  │   (Hono)     │  │   (HLS)      │  │  (SQLite)   │ │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘  └─────────────┘ │
│         │                 │                                             │
│         │  Hono RPC (hc)  │                                             │
│         └────────────────►│                                             │
│                    apps/web                                             │
└─────────────────────────────────────────────────────────────────────────┘
         │                  │
         ▼                  ▼
┌─────────────────┐  ┌─────────────────┐
│     Clerk       │  │    polar.sh     │
│   (認証)        │  │   (課金)        │
└─────────────────┘  └─────────────────┘
                              ▲
                              │ HTTPS
                              │
┌─────────────────────────────┴───────────────────────────────────────────┐
│                         Local PC (Admin)                                │
│  ┌──────────────────────────────────────────────────┐                   │
│  │                  apps/admin                       │                   │
│  │  ┌──────────────┐  Hono RPC  ┌──────────────┐    │                   │
│  │  │    client    │───────────►│    server    │◄── ffmpeg              │
│  │  │   (React)    │    (hc)    │   (Hono)     │    │                   │
│  │  └──────────────┘            └──────────────┘    │                   │
│  └──────────────────────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.2 コンポーネント一覧

1. **apps/admin（ローカル専用）**
   - `server/`: Node.js + Hono、ffmpeg管理、R2アップロード、**AppType エクスポート**
   - `client/`: React + Vite、**Hono RPC + TanStack Query**

2. **apps/web（Cloudflare）**
   - `worker/`: Cloudflare Workers + Hono、Public API、**AppType エクスポート**
   - `client/`: React + Vite（Pages）、**Hono RPC + TanStack Query**

3. **ffmpeg（ローカルPC）**
   - 音声入力（DR-05XP）→ AAC → HLS生成（live + vod）

4. **Cloudflare R2 + CDN**
   - HLS成果物の保存・配信

5. **Cloudflare D1 + Drizzle**
   - 配信メタデータ、メール購読者、ユーザー課金状態、トラックリスト

---

## 7. monorepo 構成

```
listen/
├── pnpm-workspace.yaml
├── package.json
├── oxlint.json
├── eslint.config.js
├── tsconfig.base.json
│
├── apps/
│   ├── admin/                      # ローカル管理（server + client）
│   │   ├── client/
│   │   │   ├── src/
│   │   │   │   ├── main.tsx
│   │   │   │   ├── routes/
│   │   │   │   │   ├── __root.tsx
│   │   │   │   │   ├── index.tsx
│   │   │   │   │   ├── rec.$id.tsx
│   │   │   │   │   └── tracks.$id.tsx
│   │   │   │   ├── components/
│   │   │   │   │   ├── ui/         # shadcn/ui
│   │   │   │   │   └── ...
│   │   │   │   └── lib/
│   │   │   │       ├── client.ts   # Hono RPC client
│   │   │   │       ├── queries.ts  # TanStack Query hooks
│   │   │   │       └── utils.ts
│   │   │   ├── index.html
│   │   │   └── vite.config.ts
│   │   │
│   │   ├── server/
│   │   │   ├── src/
│   │   │   │   ├── index.ts        # エントリー + AppType export
│   │   │   │   ├── routes/
│   │   │   │   │   ├── sessions.ts
│   │   │   │   │   ├── tracks.ts
│   │   │   │   │   └── health.ts
│   │   │   │   ├── services/
│   │   │   │   │   ├── ffmpeg.ts
│   │   │   │   │   ├── watcher.ts
│   │   │   │   │   ├── uploader.ts
│   │   │   │   │   └── db.ts
│   │   │   │   └── lib/
│   │   │   │       └── env.ts
│   │   │   └── tsconfig.json
│   │   │
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── web/                        # Cloudflare（client + worker）
│       ├── client/
│       │   ├── src/
│       │   │   ├── main.tsx
│       │   │   ├── routes/
│       │   │   │   ├── __root.tsx
│       │   │   │   ├── index.tsx
│       │   │   │   ├── s.$id.tsx
│       │   │   │   ├── archive.tsx
│       │   │   │   ├── subscribe.tsx
│       │   │   │   └── settings.tsx
│       │   │   ├── components/
│       │   │   │   ├── ui/         # shadcn/ui
│       │   │   │   ├── Player.tsx
│       │   │   │   ├── TrackList.tsx
│       │   │   │   └── ...
│       │   │   └── lib/
│       │   │       ├── client.ts   # Hono RPC client
│       │   │       ├── queries.ts  # TanStack Query hooks
│       │   │       └── clerk.ts
│       │   ├── public/
│       │   │   └── _redirects
│       │   ├── index.html
│       │   └── vite.config.ts
│       │
│       ├── worker/
│       │   ├── src/
│       │   │   ├── index.ts        # エントリー + AppType export
│       │   │   ├── routes/
│       │   │   │   ├── sessions.ts
│       │   │   │   ├── tracks.ts
│       │   │   │   ├── subscribe.ts
│       │   │   │   ├── billing.ts
│       │   │   │   └── me.ts
│       │   │   ├── middleware/
│       │   │   │   └── auth.ts
│       │   │   └── lib/
│       │   │       └── db.ts
│       │   ├── wrangler.toml
│       │   └── tsconfig.json
│       │
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   ├── shared/                     # 共有型定義・バリデーション
│   │   ├── src/
│   │   │   ├── types.ts
│   │   │   ├── schemas.ts          # Valibot schemas
│   │   │   ├── constants.ts
│   │   │   └── index.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── db/                         # Drizzle スキーマ・マイグレーション
│       ├── src/
│       │   ├── schema.ts           # Drizzle schema
│       │   ├── relations.ts
│       │   └── index.ts
│       ├── drizzle/
│       │   └── 0000_initial.sql
│       ├── drizzle.config.ts
│       ├── tsconfig.json
│       └── package.json
│
├── data/                           # runtime data (gitignored)
├── .env.example
└── README.md
```

---

## 8. Hono RPC + TanStack Query アーキテクチャ

### 8.1 概要

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Type Flow                                      │
│                                                                         │
│  Server (Hono)              Client (React)                              │
│  ┌─────────────────┐        ┌─────────────────────────────────────────┐ │
│  │ const app =     │        │ import type { AppType } from 'server'   │ │
│  │   new Hono()    │        │                                         │ │
│  │   .get(...)     │───────►│ const client = hc<AppType>(baseUrl)     │ │
│  │   .post(...)    │  Type  │                                         │ │
│  │                 │        │ // 完全な型推論                          │ │
│  │ export type     │        │ const res = await client.sessions.$get()│ │
│  │   AppType =     │        │ const data = await res.json()           │ │
│  │   typeof app    │        │ // data の型が自動推論される             │ │
│  └─────────────────┘        └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

### 8.2 メリット

1. **エンドツーエンドの型安全性**: APIレスポンスの型がサーバーからクライアントまで自動で伝播
2. **型定義の重複排除**: 手動でレスポンス型を定義する必要がない
3. **リファクタリング安全性**: サーバー側の変更がクライアント側でコンパイルエラーとして検出される
4. **IDE補完**: パス、クエリパラメータ、レスポンスすべてで補完が効く

---

## 9. Admin Server 実装（Hono RPC）

### 9.1 エントリーポイント + AppType エクスポート（apps/admin/server/src/index.ts）

```typescript
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { sessionsRoutes } from "./routes/sessions";
import { tracksRoutes } from "./routes/tracks";
import { healthRoutes } from "./routes/health";
import { env } from "./lib/env";

// ベースアプリ
const app = new Hono().use("*", logger()).use(
  "*",
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
  }),
);

// ルートをチェーンで接続（型推論のため）
const routes = app
  .route("/api/sessions", sessionsRoutes)
  .route("/api/tracks", tracksRoutes)
  .route("/health", healthRoutes);

// AppType をエクスポート（クライアントで使用）
export type AppType = typeof routes;

// サーバー起動
console.log(`Admin server running at http://localhost:${env.PORT}`);
serve({ fetch: routes.fetch, port: env.PORT });
```

### 9.2 セッションルート（apps/admin/server/src/routes/sessions.ts）

```typescript
import { Hono } from "hono";
import { vValidator } from "@hono/valibot-validator";
import * as v from "valibot";
import path from "node:path";
import fs from "node:fs/promises";
import { SessionIdSchema } from "@listen/shared";
import { startFfmpeg, stopFfmpeg, isRunning } from "../services/ffmpeg";
import { startWatcher, stopWatcher } from "../services/watcher";
import { flushQueue } from "../services/uploader";
import { db } from "../services/db";
import { env } from "../lib/env";

// ルートを定義（チェーンで型を保持）
export const sessionsRoutes = new Hono()
  // POST /api/sessions - 新規作成
  .post("/", async (c) => {
    const now = new Date();
    const id = now.toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });

    const sessionDir = path.join(env.DATA_DIR, id);
    await fs.mkdir(sessionDir, { recursive: true });

    const session = await db.createSession(id);

    return c.json({
      id,
      title: session?.title ?? null,
      state: session?.state ?? "scheduled",
    });
  })

  // GET /api/sessions/:id - 取得
  .get("/:id", vValidator("param", v.object({ id: SessionIdSchema })), async (c) => {
    const { id } = c.req.valid("param");
    const session = await db.getSession(id);

    if (!session) {
      return c.json({ error: "Not found" }, 404);
    }

    return c.json({
      id: session.id,
      title: session.title,
      state: session.state,
      scheduledAt: session.scheduledAt,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      durationSeconds: session.durationSeconds,
      running: isRunning(),
    });
  })

  // POST /api/sessions/:id/start - 開始
  .post("/:id/start", vValidator("param", v.object({ id: SessionIdSchema })), async (c) => {
    const { id } = c.req.valid("param");

    if (isRunning()) {
      return c.json({ error: "Already running" }, 409);
    }

    const sessionDir = path.join(env.DATA_DIR, id);
    await fs.mkdir(sessionDir, { recursive: true });

    startFfmpeg({ sessionId: id, dataDir: env.DATA_DIR });
    startWatcher(sessionDir, id);
    await db.startSession(id);

    return c.json({ success: true });
  })

  // POST /api/sessions/:id/stop - 停止
  .post("/:id/stop", vValidator("param", v.object({ id: SessionIdSchema })), async (c) => {
    const { id } = c.req.valid("param");
    const session = await db.getSession(id);

    await stopFfmpeg();
    await stopWatcher();
    await flushQueue();

    // vod.m3u8 を index.m3u8 としてアップロード
    const vodPath = path.join(env.DATA_DIR, id, "vod.m3u8");
    try {
      const vodContent = await fs.readFile(vodPath, "utf-8");
      const finalContent = vodContent.includes("#EXT-X-ENDLIST")
        ? vodContent
        : `${vodContent}\n#EXT-X-ENDLIST\n`;

      const indexPath = path.join(env.DATA_DIR, id, "index.m3u8");
      await fs.writeFile(indexPath, finalContent);
    } catch {
      // VODファイルがない場合は無視
    }

    await flushQueue();

    const durationSeconds = session?.startedAt
      ? Math.floor(Date.now() / 1000) - session.startedAt
      : 0;

    await db.endSession(id, durationSeconds);

    return c.json({ success: true });
  })

  // PUT /api/sessions/:id/schedule - スケジュール設定
  .put(
    "/:id/schedule",
    vValidator("param", v.object({ id: SessionIdSchema })),
    vValidator(
      "json",
      v.object({
        scheduledAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
        title: v.optional(v.nullable(v.string())),
      }),
    ),
    async (c) => {
      const { id } = c.req.valid("param");
      const { scheduledAt, title } = c.req.valid("json");

      await db.updateSession(id, { scheduledAt, title });

      return c.json({ success: true });
    },
  );
```

### 9.3 トラックルート（apps/admin/server/src/routes/tracks.ts）

```typescript
import { Hono } from "hono";
import { vValidator } from "@hono/valibot-validator";
import * as v from "valibot";
import { SessionIdSchema, CreateTrackSchema, UpdateTrackSchema } from "@listen/shared";
import { db } from "../services/db";

export const tracksRoutes = new Hono()
  // GET /api/tracks/:sessionId - 一覧取得
  .get("/:sessionId", vValidator("param", v.object({ sessionId: SessionIdSchema })), async (c) => {
    const { sessionId } = c.req.valid("param");
    const tracks = await db.getTracks(sessionId);

    return c.json({
      sessionId,
      tracks: tracks.map((t) => ({
        id: t.id,
        position: t.position,
        timestampSeconds: t.timestampSeconds,
        artist: t.artist,
        title: t.title,
        label: t.label,
      })),
    });
  })

  // POST /api/tracks/:sessionId - 作成
  .post(
    "/:sessionId",
    vValidator("param", v.object({ sessionId: SessionIdSchema })),
    vValidator("json", CreateTrackSchema),
    async (c) => {
      const { sessionId } = c.req.valid("param");
      const data = c.req.valid("json");

      const [track] = await db.createTrack({ ...data, sessionId });

      return c.json(
        {
          id: track.id,
          position: track.position,
          timestampSeconds: track.timestampSeconds,
          artist: track.artist,
          title: track.title,
          label: track.label,
        },
        201,
      );
    },
  )

  // PUT /api/tracks/:sessionId/:trackId - 更新
  .put(
    "/:sessionId/:trackId",
    vValidator(
      "param",
      v.object({
        sessionId: SessionIdSchema,
        trackId: v.pipe(v.string(), v.transform(Number)),
      }),
    ),
    vValidator("json", UpdateTrackSchema),
    async (c) => {
      const { trackId } = c.req.valid("param");
      const data = c.req.valid("json");

      const [track] = await db.updateTrack(trackId, data);

      return c.json({
        id: track.id,
        position: track.position,
        timestampSeconds: track.timestampSeconds,
        artist: track.artist,
        title: track.title,
        label: track.label,
      });
    },
  )

  // DELETE /api/tracks/:sessionId/:trackId - 削除
  .delete(
    "/:sessionId/:trackId",
    vValidator(
      "param",
      v.object({
        sessionId: SessionIdSchema,
        trackId: v.pipe(v.string(), v.transform(Number)),
      }),
    ),
    async (c) => {
      const { trackId } = c.req.valid("param");
      await db.deleteTrack(trackId);

      return c.json({ success: true });
    },
  );
```

---

## 10. Admin Client 実装（Hono RPC + TanStack Query）

### 10.1 Hono RPC クライアント（apps/admin/client/src/lib/client.ts）

```typescript
import { hc } from "hono/client";
import type { AppType } from "../../server/src";

// Hono RPC クライアント作成
const baseUrl = import.meta.env.VITE_API_BASE || "http://localhost:8080";

export const client = hc<AppType>(baseUrl);

// 型ヘルパー（レスポンス型を取得）
export type InferResponseType<T> = T extends () => Promise<Response>
  ? Awaited<ReturnType<Awaited<ReturnType<T>>["json"]>>
  : never;
```

### 10.2 TanStack Query フック（apps/admin/client/src/lib/queries.ts）

```typescript
import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";
import { client, type InferResponseType } from "./client";

// ============================================================
// Session Queries
// ============================================================

// セッション取得
export function useSession(id: string) {
  return useQuery({
    queryKey: ["session", id],
    queryFn: async () => {
      const res = await client.api.sessions[":id"].$get({ param: { id } });
      if (!res.ok) {
        throw new Error("Failed to fetch session");
      }
      return res.json();
    },
    refetchInterval: 2000, // 2秒ごとにポーリング
  });
}

// セッション型（推論）
export type Session = InferResponseType<(typeof client.api.sessions)[":id"]["$get"]>;

// セッション作成
export function useCreateSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await client.api.sessions.$post();
      if (!res.ok) {
        throw new Error("Failed to create session");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      return data;
    },
  });
}

// セッション開始
export function useStartSession(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await client.api.sessions[":id"].start.$post({
        param: { id },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error("error" in error ? error.error : "Failed to start");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session", id] });
    },
  });
}

// セッション停止
export function useStopSession(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await client.api.sessions[":id"].stop.$post({
        param: { id },
      });
      if (!res.ok) {
        throw new Error("Failed to stop");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session", id] });
    },
  });
}

// スケジュール更新
export function useUpdateSchedule(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { scheduledAt: number; title?: string | null }) => {
      const res = await client.api.sessions[":id"].schedule.$put({
        param: { id },
        json: data,
      });
      if (!res.ok) {
        throw new Error("Failed to update schedule");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session", id] });
    },
  });
}

// ============================================================
// Track Queries
// ============================================================

// トラック一覧取得
export function useTracks(sessionId: string) {
  return useQuery({
    queryKey: ["tracks", sessionId],
    queryFn: async () => {
      const res = await client.api.tracks[":sessionId"].$get({
        param: { sessionId },
      });
      if (!res.ok) {
        throw new Error("Failed to fetch tracks");
      }
      return res.json();
    },
  });
}

// トラック型（推論）
export type TracksResponse = InferResponseType<(typeof client.api.tracks)[":sessionId"]["$get"]>;

// トラック作成
export function useCreateTrack(sessionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      position: number;
      timestampSeconds: number;
      artist: string | null;
      title: string;
      label: string | null;
    }) => {
      const res = await client.api.tracks[":sessionId"].$post({
        param: { sessionId },
        json: data,
      });
      if (!res.ok) {
        throw new Error("Failed to create track");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracks", sessionId] });
    },
  });
}

// トラック更新
export function useUpdateTrack(sessionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      trackId,
      data,
    }: {
      trackId: number;
      data: Partial<{
        position: number;
        timestampSeconds: number;
        artist: string | null;
        title: string;
        label: string | null;
      }>;
    }) => {
      const res = await client.api.tracks[":sessionId"][":trackId"].$put({
        param: { sessionId, trackId: String(trackId) },
        json: data,
      });
      if (!res.ok) {
        throw new Error("Failed to update track");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracks", sessionId] });
    },
  });
}

// トラック削除
export function useDeleteTrack(sessionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (trackId: number) => {
      const res = await client.api.tracks[":sessionId"][":trackId"].$delete({
        param: { sessionId, trackId: String(trackId) },
      });
      if (!res.ok) {
        throw new Error("Failed to delete track");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracks", sessionId] });
    },
  });
}
```

### 10.3 配信管理画面（apps/admin/client/src/routes/rec.$id.tsx）

```tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSession, useStartSession, useStopSession } from "@/lib/queries";

export const Route = createFileRoute("/rec/$id")({
  component: RecordingPage,
});

function RecordingPage() {
  const { id } = Route.useParams();

  // Hono RPC + TanStack Query
  const { data: session, isLoading, error } = useSession(id);
  const startMutation = useStartSession(id);
  const stopMutation = useStopSession(id);

  if (isLoading) {
    return <div className="text-zinc-400">Loading...</div>;
  }

  if (error || !session || "error" in session) {
    return <div className="text-red-400">Session not found</div>;
  }

  const listenerUrl = `${import.meta.env.VITE_PUBLIC_URL}/s/${id}`;
  const hlsUrl = `${import.meta.env.VITE_HLS_BASE}/hls/${id}/index.m3u8`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Recording: {id}</h1>
        <Badge variant={session.state === "live" ? "destructive" : "secondary"} className="text-sm">
          {session.state}
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader>
            <CardTitle className="text-zinc-100">Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-zinc-400">State</span>
              <span className="font-medium">{session.state}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Running</span>
              <span className="font-medium">{session.running ? "Yes" : "No"}</span>
            </div>
            {session.title && (
              <div className="flex justify-between">
                <span className="text-zinc-400">Title</span>
                <span className="font-medium">{session.title}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader>
            <CardTitle className="text-zinc-100">URLs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <span className="text-sm text-zinc-400">Listener URL</span>
              <a
                href={listenerUrl}
                target="_blank"
                rel="noreferrer"
                className="block truncate text-blue-400 hover:underline"
              >
                {listenerUrl}
              </a>
            </div>
            <div>
              <span className="text-sm text-zinc-400">HLS URL</span>
              <code className="block truncate rounded bg-zinc-800 p-2 text-xs text-zinc-300">
                {hlsUrl}
              </code>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-4">
        {session.running ? (
          <Button
            variant="destructive"
            size="lg"
            onClick={() => stopMutation.mutate()}
            disabled={stopMutation.isPending}
          >
            {stopMutation.isPending ? "Stopping..." : "⏹ Stop"}
          </Button>
        ) : (
          <Button
            size="lg"
            onClick={() => startMutation.mutate()}
            disabled={startMutation.isPending || session.state === "ended"}
          >
            {startMutation.isPending ? "Starting..." : "▶ Start"}
          </Button>
        )}

        <Button variant="outline" asChild>
          <Link to="/tracks/$id" params={{ id }}>
            Edit Tracklist →
          </Link>
        </Button>
      </div>

      {startMutation.error && <p className="text-sm text-red-400">{startMutation.error.message}</p>}
      {stopMutation.error && <p className="text-sm text-red-400">{stopMutation.error.message}</p>}
    </div>
  );
}
```

### 10.4 トラックリスト編集画面（apps/admin/client/src/routes/tracks.$id.tsx）

```tsx
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Trash2, Plus, ArrowLeft } from "lucide-react";
import { useTracks, useCreateTrack, useUpdateTrack, useDeleteTrack } from "@/lib/queries";

export const Route = createFileRoute("/tracks/$id")({
  component: TracksPage,
});

function TracksPage() {
  const { id } = Route.useParams();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data, isLoading } = useTracks(id);
  const createMutation = useCreateTrack(id);
  const deleteMutation = useDeleteTrack(id);

  const [form, setForm] = useState({
    timestampMinutes: 0,
    timestampSeconds: 0,
    artist: "",
    title: "",
    label: "",
  });

  const handleSubmit = () => {
    const timestampSeconds = form.timestampMinutes * 60 + form.timestampSeconds;
    const nextPosition = (data?.tracks.length ?? 0) + 1;

    createMutation.mutate(
      {
        position: nextPosition,
        timestampSeconds,
        artist: form.artist || null,
        title: form.title,
        label: form.label || null,
      },
      {
        onSuccess: () => {
          setIsDialogOpen(false);
          setForm({
            timestampMinutes: 0,
            timestampSeconds: 0,
            artist: "",
            title: "",
            label: "",
          });
        },
      },
    );
  };

  if (isLoading) {
    return <div className="text-zinc-400">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/rec/$id" params={{ id }}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Tracklist: {id}</h1>
      </div>

      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-zinc-100">Tracks</CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1 h-4 w-4" />
                Add Track
              </Button>
            </DialogTrigger>
            <DialogContent className="border-zinc-800 bg-zinc-900">
              <DialogHeader>
                <DialogTitle>Add Track</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <Label>Minutes</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.timestampMinutes}
                      onChange={(e) =>
                        setForm({ ...form, timestampMinutes: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className="flex-1">
                    <Label>Seconds</Label>
                    <Input
                      type="number"
                      min={0}
                      max={59}
                      value={form.timestampSeconds}
                      onChange={(e) =>
                        setForm({ ...form, timestampSeconds: Number(e.target.value) })
                      }
                    />
                  </div>
                </div>
                <div>
                  <Label>Artist</Label>
                  <Input
                    value={form.artist}
                    onChange={(e) => setForm({ ...form, artist: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Title *</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Label</Label>
                  <Input
                    value={form.label}
                    onChange={(e) => setForm({ ...form, label: e.target.value })}
                  />
                </div>
                <Button
                  onClick={handleSubmit}
                  disabled={!form.title || createMutation.isPending}
                  className="w-full"
                >
                  {createMutation.isPending ? "Adding..." : "Add Track"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {data?.tracks.length === 0 ? (
            <p className="py-8 text-center text-zinc-400">No tracks yet</p>
          ) : (
            <ul className="divide-y divide-zinc-800">
              {data?.tracks.map((track) => (
                <li key={track.id} className="flex items-center gap-4 py-3">
                  <span className="w-12 font-mono text-sm text-zinc-400">
                    {formatTimestamp(track.timestampSeconds)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate">
                      {track.artist && <span className="text-zinc-400">{track.artist} - </span>}
                      {track.title}
                    </p>
                    {track.label && <p className="text-sm text-zinc-500">[{track.label}]</p>}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMutation.mutate(track.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-zinc-400 hover:text-red-400" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
```

---

## 11. Web Worker 実装（Hono RPC）

### 11.1 エントリーポイント + AppType エクスポート（apps/web/worker/src/index.ts）

```typescript
import { Hono } from "hono";
import { cors } from "hono/cors";
import { sessionsRoutes } from "./routes/sessions";
import { tracksRoutes } from "./routes/tracks";
import { subscribeRoutes } from "./routes/subscribe";
import { billingRoutes } from "./routes/billing";
import { meRoutes } from "./routes/me";
import { createDb } from "./lib/db";
import type { Env, Variables } from "./types";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use("*", cors());

// DB インスタンスをコンテキストに設定
app.use("*", async (c, next) => {
  c.set("db", createDb(c.env.DB));
  await next();
});

// ルートをチェーンで接続（型推論のため）
const routes = app
  .route("/sessions", sessionsRoutes)
  .route("/tracks", tracksRoutes)
  .route("/subscribe", subscribeRoutes)
  .route("/billing", billingRoutes)
  .route("/me", meRoutes);

// AppType をエクスポート（クライアントで使用）
export type AppType = typeof routes;

export default app;
```

### 11.2 セッションルート（apps/web/worker/src/routes/sessions.ts）

```typescript
import { Hono } from "hono";
import { vValidator } from "@hono/valibot-validator";
import { eq, and, gt } from "drizzle-orm";
import * as v from "valibot";
import { sessions } from "@listen/db";
import { SessionIdSchema } from "@listen/shared";
import { authMiddleware } from "../middleware/auth";
import type { Env, Variables } from "../types";

export const sessionsRoutes = new Hono<{ Bindings: Env; Variables: Variables }>()
  // GET /sessions/live
  .get("/live", async (c) => {
    const db = c.get("db");
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.state, "live"),
    });

    return c.json({ session: session ?? null });
  })

  // GET /sessions/archive
  .get("/archive", authMiddleware({ required: false }), async (c) => {
    const db = c.get("db");
    const profile = c.get("profile");
    const isPremium = profile?.isPremium === true;
    const now = Math.floor(Date.now() / 1000);

    let result: (typeof sessions.$inferSelect)[];
    let totalCount: number;

    if (isPremium) {
      result = await db.query.sessions.findMany({
        where: eq(sessions.state, "ended"),
        orderBy: (sessions, { desc }) => [desc(sessions.endedAt)],
      });
      totalCount = result.length;
    } else {
      result = await db.query.sessions.findMany({
        where: and(eq(sessions.state, "ended"), gt(sessions.expiresAt, now)),
        orderBy: (sessions, { desc }) => [desc(sessions.endedAt)],
      });

      const allEnded = await db.query.sessions.findMany({
        where: eq(sessions.state, "ended"),
      });
      totalCount = allEnded.length;
    }

    return c.json({
      sessions: result.map((s) => ({
        id: s.id,
        title: s.title,
        state: s.state,
        endedAt: s.endedAt,
        expiresAt: s.expiresAt,
        durationSeconds: s.durationSeconds,
        isExpired: s.expiresAt ? s.expiresAt <= now : false,
      })),
      hasMoreArchives: !isPremium && totalCount > result.length,
      premiumArchiveCount: totalCount,
    });
  })

  // GET /sessions/:id
  .get(
    "/:id",
    vValidator("param", v.object({ id: SessionIdSchema })),
    authMiddleware({ required: false }),
    async (c) => {
      const { id } = c.req.valid("param");
      const db = c.get("db");
      const profile = c.get("profile");
      const isPremium = profile?.isPremium === true;

      const session = await db.query.sessions.findFirst({
        where: eq(sessions.id, id),
      });

      if (!session) {
        return c.json({ error: "Not found" }, 404);
      }

      const now = Math.floor(Date.now() / 1000);

      let canWatch = false;
      let reason: "expired" | null = null;

      if (session.state === "live") {
        canWatch = true;
      } else if (session.expiresAt && session.expiresAt > now) {
        canWatch = true;
      } else if (isPremium) {
        canWatch = true;
      } else {
        reason = "expired";
      }

      return c.json({
        id: session.id,
        title: session.title,
        state: session.state,
        scheduledAt: session.scheduledAt,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        expiresAt: session.expiresAt,
        durationSeconds: session.durationSeconds,
        canWatch,
        reason,
        upgradeUrl: canWatch ? null : "/settings",
      });
    },
  );
```

### 11.3 Me ルート（apps/web/worker/src/routes/me.ts）

```typescript
import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";
import type { Env, Variables } from "../types";

export const meRoutes = new Hono<{ Bindings: Env; Variables: Variables }>().get(
  "/",
  authMiddleware({ required: false }),
  async (c) => {
    const user = c.get("user");
    const profile = c.get("profile");

    return c.json({
      user: user ? { id: user.id, email: user.email } : null,
      profile: profile
        ? {
            isPremium: profile.isPremium,
            premiumExpiresAt: profile.premiumExpiresAt,
          }
        : null,
    });
  },
);
```

---

## 12. Web Client 実装（Hono RPC + TanStack Query）

### 12.1 Hono RPC クライアント（apps/web/client/src/lib/client.ts）

```typescript
import { hc } from "hono/client";
import type { AppType } from "../../worker/src";

const baseUrl = import.meta.env.VITE_API_BASE || "";

// 認証トークン付きクライアント作成関数
export function createClient(getToken?: () => Promise<string | null>) {
  return hc<AppType>(baseUrl, {
    fetch: async (input, init) => {
      const headers = new Headers(init?.headers);

      // Clerk トークンを取得して付与
      if (getToken) {
        const token = await getToken();
        if (token) {
          headers.set("Authorization", `Bearer ${token}`);
        }
      }

      return fetch(input, { ...init, headers });
    },
  });
}

// 認証なしクライアント（初期表示用）
export const publicClient = hc<AppType>(baseUrl);

// 型ヘルパー
export type Client = ReturnType<typeof createClient>;
export type InferResponseType<T> = T extends () => Promise<Response>
  ? Awaited<ReturnType<Awaited<ReturnType<T>>["json"]>>
  : never;
```

### 12.2 TanStack Query フック（apps/web/client/src/lib/queries.ts）

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-react";
import { createClient, publicClient, type InferResponseType } from "./client";

// 認証付きクライアントを取得するフック
function useClient() {
  const { getToken } = useAuth();
  return createClient(getToken);
}

// ============================================================
// Session Queries
// ============================================================

// ライブセッション取得
export function useLiveSession() {
  return useQuery({
    queryKey: ["session", "live"],
    queryFn: async () => {
      const res = await publicClient.sessions.live.$get();
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    refetchInterval: 10000, // 10秒ごと
  });
}

// セッション取得（認証オプション）
export function useSession(id: string) {
  const client = useClient();

  return useQuery({
    queryKey: ["session", id],
    queryFn: async () => {
      const res = await client.sessions[":id"].$get({ param: { id } });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });
}

export type SessionResponse = InferResponseType<
  ReturnType<typeof createClient>["sessions"][":id"]["$get"]
>;

// アーカイブ一覧取得
export function useArchive() {
  const client = useClient();

  return useQuery({
    queryKey: ["archive"],
    queryFn: async () => {
      const res = await client.sessions.archive.$get();
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });
}

export type ArchiveResponse = InferResponseType<
  ReturnType<typeof createClient>["sessions"]["archive"]["$get"]
>;

// ============================================================
// Track Queries
// ============================================================

// トラックリスト取得（プレミアム限定）
export function useTracks(sessionId: string, enabled = true) {
  const client = useClient();

  return useQuery({
    queryKey: ["tracks", sessionId],
    queryFn: async () => {
      const res = await client.tracks[":sessionId"].$get({
        param: { sessionId },
      });
      if (!res.ok) {
        if (res.status === 403) {
          throw new Error("Premium required");
        }
        throw new Error("Failed to fetch");
      }
      return res.json();
    },
    enabled,
  });
}

export type TracksResponse = InferResponseType<
  ReturnType<typeof createClient>["tracks"][":sessionId"]["$get"]
>;

// ============================================================
// User Queries
// ============================================================

// 現在のユーザー情報取得
export function useMe() {
  const client = useClient();
  const { isSignedIn } = useAuth();

  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await client.me.$get();
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: isSignedIn,
  });
}

export type MeResponse = InferResponseType<ReturnType<typeof createClient>["me"]["$get"]>;

// ============================================================
// Subscribe Mutations
// ============================================================

export function useSubscribe() {
  return useMutation({
    mutationFn: async (data: {
      email: string;
      notifyLive?: boolean;
      notifyScheduled?: boolean;
    }) => {
      const res = await publicClient.subscribe.$post({ json: data });
      if (!res.ok) {
        const error = await res.json();
        throw new Error("error" in error ? error.error : "Failed to subscribe");
      }
      return res.json();
    },
  });
}

// ============================================================
// Billing Mutations
// ============================================================

export function useCreateCheckout() {
  const client = useClient();

  return useMutation({
    mutationFn: async () => {
      const res = await client.billing.checkout.$post();
      if (!res.ok) throw new Error("Failed to create checkout");
      return res.json();
    },
  });
}
```

### 12.3 セッション視聴ページ（apps/web/client/src/routes/s.$id.tsx）

```tsx
import { useState, useCallback } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@clerk/clerk-react";
import { Player } from "@/components/Player";
import { TrackList } from "@/components/TrackList";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock } from "lucide-react";
import { useSession, useTracks, useMe } from "@/lib/queries";

export const Route = createFileRoute("/s/$id")({
  component: SessionPage,
});

function SessionPage() {
  const { id } = Route.useParams();
  const { isSignedIn } = useAuth();
  const [currentTime, setCurrentTime] = useState(0);

  // Hono RPC + TanStack Query（型安全）
  const { data: session, isLoading: sessionLoading } = useSession(id);
  const { data: me } = useMe();

  const isPremium = me?.profile?.isPremium ?? false;
  const canWatch = session && "canWatch" in session ? session.canWatch : false;

  const { data: tracks } = useTracks(id, isPremium && canWatch);

  const handleSeek = useCallback((time: number) => {
    setCurrentTime(time);
    // Player の audioRef を使ってシーク（ref経由で実装）
  }, []);

  if (sessionLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!session || "error" in session) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-destructive">Session not found</div>
      </div>
    );
  }

  // 期限切れ（非課金）
  if (!canWatch && session.reason === "expired") {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <Card className="bg-muted/30 border-border">
          <CardHeader className="text-center">
            <Lock className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
            <CardTitle>Archive Expired</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-muted-foreground">
              The free viewing period for this archive has ended.
            </p>
            <div className="space-y-2 text-sm">
              <p className="font-medium">Premium members get:</p>
              <ul className="text-muted-foreground space-y-1">
                <li>✓ Access to all past archives</li>
                <li>✓ Tracklist with seek functionality</li>
              </ul>
            </div>
            <Button asChild className="w-full">
              <Link to="/settings">Upgrade to Premium</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{session.title || `Session ${id}`}</h1>
          <p className="text-muted-foreground">{id}</p>
        </div>
        <Badge variant={session.state === "live" ? "destructive" : "secondary"}>
          {session.state === "live" ? "● LIVE" : "Archive"}
        </Badge>
      </div>

      <Player
        sessionId={id}
        hlsBase={import.meta.env.VITE_HLS_BASE}
        onTimeUpdate={setCurrentTime}
      />

      {/* トラックリスト（プレミアム限定） */}
      {isPremium && tracks?.tracks ? (
        <TrackList tracks={tracks.tracks} currentTime={currentTime} onSeek={handleSeek} />
      ) : (
        <Card className="bg-muted/20 border-border">
          <CardContent className="py-6 text-center">
            <Lock className="text-muted-foreground mx-auto mb-2 h-8 w-8" />
            <p className="text-muted-foreground text-sm">
              Tracklist is available for premium members
            </p>
            {!isSignedIn && (
              <Button variant="link" asChild className="mt-2">
                <Link to="/sign-in">Sign in to upgrade</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

### 12.4 アーカイブ一覧ページ（apps/web/client/src/routes/archive.tsx）

```tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useArchive, useMe } from "@/lib/queries";

export const Route = createFileRoute("/archive")({
  component: ArchivePage,
});

function ArchivePage() {
  // Hono RPC + TanStack Query（型安全）
  const { data, isLoading } = useArchive();
  const { data: me } = useMe();

  const isPremium = me?.profile?.isPremium ?? false;

  if (isLoading) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Archive</h1>
        {data?.hasMoreArchives && (
          <Badge variant="secondary">
            +{data.premiumArchiveCount - data.sessions.length} more with Premium
          </Badge>
        )}
      </div>

      {data?.sessions.length === 0 ? (
        <p className="text-muted-foreground">No archives available</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data?.sessions.map((session) => (
            <Card
              key={session.id}
              className="bg-muted/20 border-border hover:bg-muted/30 transition-colors"
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{session.title || session.id}</CardTitle>
                  {session.isExpired && !isPremium && (
                    <Badge variant="outline" className="text-xs">
                      Expired
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-3 text-sm">
                  {session.durationSeconds
                    ? formatDuration(session.durationSeconds)
                    : "Duration unknown"}
                </p>
                <Button asChild variant="secondary" size="sm" className="w-full">
                  <Link to="/s/$id" params={{ id: session.id }}>
                    {session.isExpired && !isPremium ? "View Details" : "Listen"}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {data?.hasMoreArchives && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-6 text-center">
            <p className="text-muted-foreground mb-3 text-sm">
              Upgrade to Premium to access all {data.premiumArchiveCount} archives
            </p>
            <Button asChild>
              <Link to="/settings">Upgrade Now</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) {
    return `${h}h ${m}m`;
  }
  return `${m} min`;
}
```

---

## 13. 設定（環境変数）

### 13.1 Admin（apps/admin/.env）

```env
# Server
PORT=8080
DATA_DIR=../../data

# ffmpeg
FFMPEG_INPUT_FMT=alsa
FFMPEG_INPUT=hw:1,0
FFMPEG_BITRATE=192k
HLS_TIME=4
HLS_LIST_SIZE=15
HLS_FORMAT=cmaf

# R2
R2_ENDPOINT=https://xxx.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET=dj-hls

# D1 (HTTP API)
CF_API_TOKEN=xxx
CF_ACCOUNT_ID=xxx
D1_DATABASE_ID=xxx

# Client
VITE_API_BASE=http://localhost:8080
VITE_PUBLIC_URL=https://listen.example.com
VITE_HLS_BASE=https://hls.example.com
```

### 13.2 Web Worker（apps/web/worker/wrangler.toml）

```toml
name = "listen-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[vars]
PUBLIC_URL = "https://listen.example.com"

[[d1_databases]]
binding = "DB"
database_name = "dj-livestream"
database_id = "xxx"

[[r2_buckets]]
binding = "R2"
bucket_name = "dj-hls"
```

Secrets（`wrangler secret put`）:

- `CLERK_SECRET_KEY`
- `POLAR_ACCESS_TOKEN`
- `POLAR_WEBHOOK_SECRET`
- `POLAR_PRODUCT_ID`
- `RESEND_API_KEY`

### 13.3 Web Client（apps/web/client/.env）

```env
VITE_API_BASE=https://api.example.com
VITE_HLS_BASE=https://hls.example.com
VITE_CLERK_PUBLISHABLE_KEY=pk_xxx
```

---

## 14. 開発・デプロイ

### 14.1 開発

```bash
# 依存関係インストール
pnpm install

# 全体を並列起動
pnpm dev

# 個別起動
pnpm dev:admin     # Admin (server:8080 + client:5173)
pnpm dev:web       # Web (client:5174 + worker:8787)

# Lint & Format
pnpm lint
pnpm lint:fix
pnpm format
pnpm format:check

# 型チェック
pnpm typecheck
```

### 14.2 ビルド・デプロイ

```bash
# 全体ビルド
pnpm build

# DB マイグレーション
pnpm db:generate   # SQL 生成
pnpm db:migrate    # D1 適用

# Web デプロイ
pnpm deploy:web    # Worker + Pages
```

---

## 15. 今後の拡張案

- ABR（64/128/192k）
- visitor logging
- アーカイブ単一ファイル（m4a）生成
- トラックリスト自動検出（Shazam API等）
- R2 Infrequent Access
- 複数課金プラン
- コメント・チャット機能
- PWA 対応

---

## 付録A：Hono RPC の型推論詳細

### A.1 基本的な使い方

```typescript
// サーバー側（型をエクスポート）
const app = new Hono()
  .get("/users", (c) => c.json({ users: [{ id: 1, name: "Alice" }] }))
  .get("/users/:id", (c) => {
    const id = c.req.param("id");
    return c.json({ id: Number(id), name: "Alice" });
  })
  .post("/users", async (c) => {
    const body = await c.req.json<{ name: string }>();
    return c.json({ id: 2, name: body.name }, 201);
  });

export type AppType = typeof app;

// クライアント側（型を利用）
import { hc } from "hono/client";
import type { AppType } from "./server";

const client = hc<AppType>("http://localhost:8080");

// 完全な型推論
const res1 = await client.users.$get();
const users = await res1.json(); // { users: { id: number; name: string }[] }

const res2 = await client.users[":id"].$get({ param: { id: "1" } });
const user = await res2.json(); // { id: number; name: string }

const res3 = await client.users.$post({ json: { name: "Bob" } });
const newUser = await res3.json(); // { id: number; name: string }
```

### A.2 Valibot との組み合わせ

```typescript
import { vValidator } from "@hono/valibot-validator";
import * as v from "valibot";

const CreateUserSchema = v.object({
  name: v.pipe(v.string(), v.minLength(1)),
  email: v.pipe(v.string(), v.email()),
});

const app = new Hono().post("/users", vValidator("json", CreateUserSchema), async (c) => {
  const data = c.req.valid("json"); // { name: string; email: string }
  return c.json({ id: 1, ...data });
});

// クライアント側も型安全
const res = await client.users.$post({
  json: { name: "Alice", email: "alice@example.com" },
});
```

### A.3 エラーハンドリング

```typescript
// 共通エラー型を定義
type ApiError = { error: string };

// Union 型でレスポンスを処理
const res = await client.sessions[":id"].$get({ param: { id } });

if (!res.ok) {
  const error = (await res.json()) as ApiError;
  throw new Error(error.error);
}

const session = await res.json(); // 成功時の型
```

---

## 付録B：各パッケージの package.json 例

### apps/admin/package.json

```json
{
  "name": "@listen/admin",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "concurrently \"pnpm run dev:server\" \"pnpm run dev:client\"",
    "dev:server": "tsx watch server/src/index.ts",
    "dev:client": "vite --config client/vite.config.ts",
    "build": "pnpm run build:server && pnpm run build:client",
    "build:server": "tsup server/src/index.ts --format esm --dts",
    "build:client": "vite build --config client/vite.config.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@aws-sdk/client-s3": "^3.600.0",
    "@hono/node-server": "^1.12.0",
    "@hono/valibot-validator": "^0.3.0",
    "@listen/db": "workspace:*",
    "@listen/shared": "workspace:*",
    "@tanstack/react-query": "^5.50.0",
    "@tanstack/react-router": "^1.45.0",
    "chokidar": "^3.6.0",
    "drizzle-orm": "^0.33.0",
    "execa": "^9.3.0",
    "hono": "^4.5.0",
    "lucide-react": "^0.400.0",
    "p-queue": "^8.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "valibot": "^0.37.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "concurrently": "^8.2.0",
    "tailwindcss": "^4.0.0",
    "tsup": "^8.2.0",
    "tsx": "^4.16.0",
    "vite": "^5.4.0"
  }
}
```

### apps/web/package.json

```json
{
  "name": "@listen/web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "concurrently \"pnpm run dev:worker\" \"pnpm run dev:client\"",
    "dev:worker": "wrangler dev --config worker/wrangler.toml",
    "dev:client": "vite --config client/vite.config.ts",
    "build": "pnpm run build:worker && pnpm run build:client",
    "build:worker": "wrangler deploy --dry-run --config worker/wrangler.toml",
    "build:client": "vite build --config client/vite.config.ts",
    "deploy": "wrangler deploy --config worker/wrangler.toml && wrangler pages deploy client/dist",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@clerk/backend": "^1.5.0",
    "@clerk/clerk-react": "^5.3.0",
    "@hono/valibot-validator": "^0.3.0",
    "@listen/db": "workspace:*",
    "@listen/shared": "workspace:*",
    "@tanstack/react-query": "^5.50.0",
    "@tanstack/react-router": "^1.45.0",
    "drizzle-orm": "^0.33.0",
    "hls.js": "^1.5.0",
    "hono": "^4.5.0",
    "lucide-react": "^0.400.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "valibot": "^0.37.0"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20240620.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "concurrently": "^8.2.0",
    "tailwindcss": "^4.0.0",
    "vite": "^5.4.0",
    "wrangler": "^3.60.0"
  }
}
```
