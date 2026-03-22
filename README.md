# Polymarket Dashboard

Production-ready modular analytics dashboard built with Next.js App Router.

- Module 1: `/top-volume` (top events/markets by volume)
- Module 2: `/breaking` (largest absolute price movers over selectable windows)
- Module 3: `/insider` (suspicious trade detection with cron + Supabase)

## Tech Stack

- Next.js App Router + TypeScript
- Tailwind CSS + shadcn/ui-style component primitives
- TanStack Query for caching/polling/retry
- Zod runtime validation for upstream payloads
- Vercel-compatible route handlers under `/app/api/*`

## Local Development

1. Install dependencies:

```bash
pnpm install
```

If `pnpm` is not available, use `npm install`.

2. Create env file:

```bash
cp .env.example .env.local
```

`.env.example` is a template only; Next.js reads runtime values from `.env.local`.

3. Start app:

```bash
pnpm dev
```

4. Open [http://localhost:3000/top-volume](http://localhost:3000/top-volume).

## Scripts

- `pnpm dev` - local dev server
- `pnpm build` - production build
- `pnpm start` - run production build
- `pnpm lint` - run ESLint
- `pnpm test` - run Vitest test suite
- `pnpm typecheck` - TypeScript validation
- `pnpm format` / `pnpm format:check` - Prettier

## Environment

`POLYMARKET_GAMMA_BASE_URL=https://gamma-api.polymarket.com`

`POLYMARKET_DATA_API_BASE_URL=https://data-api.polymarket.com`

`POLYMARKET_WALLET_DENYLIST=0xabc...,0xdef...` (optional)

`NEXT_PUBLIC_SUPABASE_URL=...`

`SUPABASE_SERVICE_KEY=...`

`CRON_SECRET=...`

## Module 1 API Contract

`GET /api/polymarket/top-volume`

Query params:

- `entity=markets|events` (default `markets`)
- `window=24h|total` (default `24h`)
- `limit=10`
- `includeTags=a,b`
- `excludeTags=c,d`
- `refresh=1` (optional cache bypass)

The route returns a normalized payload (`TopVolumeResponse`) with `TopVolumeItem[]`.

## Module 2 API Contract

`GET /api/polymarket/breaking`

Query params:

- `window=1h|24h|7d` (default `24h`)
- `limit=20`
- `includeTags=a,b`
- `excludeTags=c,d`
- `refresh=1` (optional cache bypass)

The route returns a normalized payload (`BreakingResponse`) with `BreakingItem[]`.

## Module 3 API Contract

`GET /api/insider/alerts`

Query params:

- `minScore=6`
- `limit=50`
- `marketId=<optional>`

The route returns a normalized payload with `lastScannedAt`, summary counts, and insider alert items.

`GET /api/insider/wallet/[address]`

Returns wallet-level aggregate stats plus all saved alerts for that wallet.

`GET /api/cron/insider-scan`

- requires `Authorization: Bearer <CRON_SECRET>`
- fetches recent trades, updates wallet history, settles resolved trades, and stores alerts in Supabase

## Notebook Parity Map

Source notebook: `polymarket_top_events.ipynb`

- `fetch_events(order, limit)` -> `lib/polymarket/client.ts::fetchEvents`
  - uses `/events` with `active=true`, `closed=false`, `include_tag=true`, `ascending=false`
  - order mapping: `24h -> volume24hr`, `total -> volume`
- `fetch_markets(order, limit)` -> `lib/polymarket/client.ts::fetchMarkets`
  - uses `/markets` with same defaults
  - order mapping: `24h -> volume24hr`, `total -> volumeNum`
- `keep_tags` / `exclude_tags` -> `lib/polymarket/filter.ts::applyTagFilters`
  - notebook set-intersection semantics
  - intentional UX extension: case-insensitive + trimmed matching
- volume extraction and display selection -> `lib/polymarket/volume.ts`
- field normalization -> `lib/polymarket/normalize.ts`
- section 5 movers (`oneDayPriceChange`, abs sort, broad market fetch) -> `app/api/polymarket/breaking/route.ts` + `lib/polymarket/breaking.ts`

## Vercel Deployment

This project deploys to Vercel and uses Supabase for insider alert persistence.

- Build command: `pnpm build`
- Output: Next.js default
- Runtime API calls are proxied through Next.js route handlers (`/app/api/*`)
- Insider scanning is triggered by a Vercel Cron Job calling `/api/cron/insider-scan`

## Project Structure

```text
app/
  (shell)/
    layout.tsx
    providers.tsx
    top-volume/page.tsx
    breaking/page.tsx
    insider/page.tsx
  api/cron/insider-scan/route.ts
  api/insider/alerts/route.ts
  api/insider/wallet/[address]/route.ts
  api/polymarket/top-volume/route.ts
  api/polymarket/breaking/route.ts
  layout.tsx
  page.tsx

components/
  Nav.tsx
  PageHeader.tsx
  TopVolumeControls.tsx
  TopVolumeTable.tsx
  TopVolumeCards.tsx
  BreakingControls.tsx
  BreakingTable.tsx
  BreakingCards.tsx
  InsiderPageClient.tsx
  InsiderAlertCard.tsx
  ErrorState.tsx
  Skeletons.tsx
  ui/*

lib/
  format.ts
  insider/
    clob.ts
    denylist.ts
    schemas.ts
    scorer.ts
    supabase.ts
    types.ts
  polymarket/
    breaking.ts
    client.ts
    schemas.ts
    types.ts
    normalize.ts
    filter.ts
    volume.ts
  query/
    keys.ts
    useTopVolume.ts
    useBreaking.ts
    useInsiderAlerts.ts

tests/
  api/
  components/
  insider/
  polymarket/
```

## Adding Module 2 (Copy Pattern)

1. Create route handler under `app/api/polymarket/<module>/route.ts`.
2. Add domain logic in `lib/polymarket/*` (or a module-specific subfolder) with Zod validation + normalization.
3. Add query key + hook in `lib/query`.
4. Add page at `app/(shell)/<module>/page.tsx` using the same controls/query/render pattern.
5. Reuse shared UI building blocks (`PageHeader`, `ErrorState`, `Skeletons`, `ui/*`).
6. Add focused unit tests and route tests mirroring Module 1.
