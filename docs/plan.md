# GWCT Alert MVP Plan

## Objective
- Build a runnable npm-only monorepo that monitors GWCT + YS Pilot pages via Playwright DOM parsing and pushes operational alerts to a mobile app.

## Scope
- Included: server worker/API/SSE/notification, Expo app scaffolding + screens, fixtures/tests/docs.
- Excluded: production APNs direct integration, auth bypass, OCR-first scraping.

## Priority Execution
1. Vessel schedule end-to-end alert flow.
2. Crane threshold alerts.
3. Equipment login/operator-change alerts.
4. YT logged-in count threshold alerts.
5. YS suspension alerts using `배선팀근무` as primary signal.

## Implemented Checklist
- [x] npm workspace monorepo (`apps/server`, `apps/mobile`, `packages/shared`).
- [x] Shared Zod schemas + events package.
- [x] Fastify server + Prisma(SQLite) schema for required models.
- [x] Playwright fetcher with retry/backoff/jitter + fixture mode.
- [x] Source adapters/parsers for GWCT(H/I/F/D) + YS(forecast/notice).
- [x] Parser diagnostics + raw snapshot persistence.
- [x] Diff/event engine with dedupe/cooldown and before/after values.
- [x] Expo/Noop notification provider abstraction.
- [x] SSE stream for live foreground updates.
- [x] REST/debug/admin endpoints.
- [x] Expo mobile screens for dashboard/vessels/cranes/equipment/yt/weather/alerts/settings.
- [x] Tests: diff/threshold/weather parser/integration.
- [x] Commands: `dev`, `dev:server`, `mobile`, `test`, `scrape:once`, `replay:fixtures`.

## Validation Snapshot
- `npm run typecheck` passed.
- `npm test` passed (server tests 6/6).
- `npm --workspace @gwct/server run scrape:once` passed in fixture mode.
- `npm --workspace @gwct/server run replay:fixtures` generated synthetic alerts including `ALL_SUSPENDED`.
