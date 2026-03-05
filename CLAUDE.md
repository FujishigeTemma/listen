# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DJ audio livestream & archive platform. Local admin captures audio via ffmpeg, uploads HLS segments to Cloudflare R2, and listeners access streams through a Cloudflare Workers-powered web app. Japanese UI.

## Commands

```sh
pnpm install              # Install all dependencies
pnpm dev                  # Run all apps in parallel (admin + web)
pnpm dev:web              # Run web app only (port 8787)
pnpm dev:admin            # Run admin app only (server:8080, client:5173)
pnpm dev:email            # Run mailer worker locally

pnpm lint                 # oxlint with type-check and type-aware linting + autofix
pnpm format               # oxfmt formatter
pnpm typecheck            # Type-check all packages (uses tsgo). If pnpm lint passes, no need to run this separately.
pnpm knip                 # Dead code detection with autofix

pnpm db:generate          # Generate Drizzle migration from schema changes
pnpm db:migrate           # Apply migrations

pnpm deploy:web           # Deploy web worker to Cloudflare
pnpm deploy:email         # Deploy mailer worker to Cloudflare
```

## Architecture

**Monorepo** (pnpm workspace) with `apps/*` and `packages/*`.

### Apps

- **`apps/web`** — Listener-facing SPA. Cloudflare Workers (Hono) serves the API; Vite + React + TanStack Router for the client. Uses `@cloudflare/vite-plugin` for integrated dev. D1 database is accessed via Drizzle ORM. Auth via Clerk, billing via Polar.
- **`apps/admin`** — Admin dashboard runs on local machine. Hono on Node.js (server) + Vite + React (client). Manages recording sessions, HLS segments, R2 uploads. Accesses D1 remotely via Cloudflare REST API. Audio processing with ffmpeg.
- **`apps/mailer`** — Cloudflare Worker with Cron triggers and Queue consumer. Sends notification emails via Resend when sessions go live or are scheduled.

### Packages

- **`packages/db`** — Drizzle ORM schema and relations for Cloudflare D1 (SQLite). Shared by all apps.
- **`packages/shared`** — Small shared utilities (timestamp formatting, token generation).

### Key Patterns

- **Type-safe API calls**: Hono RPC — server exports `AppType`, client uses `hc<AppType>()` for end-to-end typed HTTP calls.
- **Client routing**: TanStack Router with file-based routes (`apps/*/client/src/routes/`). Route tree is auto-generated (`routeTree.gen.ts` — do not edit).
- **Validation**: Valibot everywhere (API request validation via `@hono/valibot-validator`, shared schemas).
- **Database**: Cloudflare D1 (SQLite) via Drizzle ORM. Schema lives in `packages/db/src/schema.ts`. Timestamps are stored as integer (unix seconds).
- **Dependency catalog**: Shared dependency versions are pinned in `pnpm-workspace.yaml` under `catalog:`.

## Conventions

- **Linter config (`/.oxlintrc.json`)**: First line says "Modifications by LLM are strongly prohibited." Do not modify this file.
- **Formatter**: oxfmt handles import sorting (group: type imports first, then builtins/external, then internal). Do not manually sort imports.
- **Named exports only** — no default exports (except where framework requires it like route components or worker entry).
- **Namespace imports** allowed only for `valibot` and `@listen/db` (configured in oxlint).
- **Date/time operations**: Always use `dayjs`. Never use raw `Date` or other libraries.
- **Type checking**: Uses `tsgo` (native TypeScript preview compiler), not `tsc`.
