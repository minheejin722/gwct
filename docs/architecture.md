# Architecture

## Components
- `apps/server`
  - Fastify API + SSE endpoint.
  - Monitor worker (scheduler + one-shot CLI).
  - Playwright HTML fetcher (live) + filesystem fixtures (fixture mode).
  - Parser layer per source.
  - Diff/event engine.
  - Notification service (provider interface).
  - Prisma persistence on SQLite.
- `apps/mobile`
  - Expo Router app with iPhone-first screens.
  - REST polling for screen data.
  - SSE stream listener for foreground updates.
  - Expo push token registration and settings patch.
- `packages/shared`
  - Common Zod schemas/types and event->deep-link mapping.

## Data Flow
1. Scheduler triggers source scrape (`gwct_*` every 30s, `ys_*` every 60s, jitter applied).
2. Fetcher loads page via Playwright (or fixture file).
3. Parser converts DOM into normalized domain snapshots.
4. Snapshots persisted (`RawSnapshot`, typed snapshot tables).
5. Diff engine compares current vs previous snapshot and creates candidate events.
6. Dedupe/cooldown checks against `AlertEvent` history.
7. Emitted alerts are stored and dispatched via push provider + SSE broadcast.
8. Mobile app consumes REST + SSE and renders operational state.

## Storage Strategy
- Default: SQLite (`apps/server/data/dev.db`) for local no-dependency setup.
- Persistence abstraction is in repository layer to allow PostgreSQL swap later.

## Weather Alert Specific Rule
- Primary signal: YS `/forecast` (`/forecast/status` equivalent structure) row where label is `배선팀근무`.
- Detect `ALL_SUSPENDED` when text contains variants of:
  - `전체 도선 중단`
  - `All Pilotage Suspended`
  - including malformed parenthesis forms.
- Notice board (`/boards/lists/notice`) is secondary support only.

## Resilience
- Retries + exponential backoff for live fetch failures.
- Parse diagnostics recorded per source/parser.
- Fixture mode allows local replay without live-site dependency.
