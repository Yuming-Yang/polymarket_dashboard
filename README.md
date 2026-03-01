# Polymarket Dashboard

Production-ready modular analytics dashboard built with Next.js App Router.

- Module 1: `/top-volume` (top events/markets by volume)
- Module 2: `/breaking` (largest absolute price movers over selectable windows)
- Module 3: `/macro` (Economy/Finance monitor with CLOB-based 1d/1w changes + AI summary)

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

`POLYMARKET_CLOB_BASE_URL=https://clob.polymarket.com`

`OPENAI_API_KEY=...`

`OPENAI_MODEL=...`

`OPENAI_MACRO_SUMMARY_PROMPT=...`

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

`GET /api/polymarket/macro`

Query params:

- `limit=50` (max `50`)
- `refresh=1` (optional cache bypass)

The route returns a normalized payload (`MacroResponse`) with:

- `items`: top Economy/Finance markets by `24h` volume
- `groups`: deterministic macro bucket summaries
- `stats`: KPI metrics, including CLOB coverage rates

`POST /api/polymarket/macro/summary`

Body:

- `snapshotAt`
- `items` (max `50`, current displayed snapshot)
- `groups`
- `stats`

The route returns `MacroSummaryResponse` with:

- `takeaway`
- `topRecentChanges`
- `groupHighlights`
- `watchItems`

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

This project deploys directly to Vercel without extra backend services.

- Build command: `pnpm build`
- Output: Next.js default
- Runtime API calls are proxied through Next.js route handlers (`/app/api/*`)

## Project Structure

```text
app/
  (shell)/
    layout.tsx
    providers.tsx
    top-volume/page.tsx
    breaking/page.tsx
    macro/page.tsx
  api/polymarket/top-volume/route.ts
  api/polymarket/breaking/route.ts
  api/polymarket/macro/route.ts
  api/polymarket/macro/summary/route.ts
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
  macro/*
  ErrorState.tsx
  Skeletons.tsx
  ui/*

lib/
  format.ts
  polymarket/
    breaking.ts
    client.ts
    schemas.ts
    types.ts
    normalize.ts
    filter.ts
    macro/*
    volume.ts
  query/
    keys.ts
    useTopVolume.ts
    useMacro.ts
    useMacroSummary.ts

tests/
  api/
  components/
  polymarket/
```

## Adding Module 2 (Copy Pattern)

1. Create route handler under `app/api/polymarket/<module>/route.ts`.
2. Add domain logic in `lib/polymarket/*` (or a module-specific subfolder) with Zod validation + normalization.
3. Add query key + hook in `lib/query`.
4. Add page at `app/(shell)/<module>/page.tsx` using the same controls/query/render pattern.
5. Reuse shared UI building blocks (`PageHeader`, `ErrorState`, `Skeletons`, `ui/*`).
6. Add focused unit tests and route tests mirroring Module 1.
