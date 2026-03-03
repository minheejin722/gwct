# GWCT MVP Todo

## Plan
- [x] Confirm live page accessibility and DOM reality for GWCT/YS Pilot.
- [x] Lock architecture decisions for npm-only + SQLite-first stack.
- [x] Scaffold npm workspace monorepo (`apps/server`, `apps/mobile`, `packages/shared`).
- [x] Implement shared schemas/events package.
- [x] Implement Fastify server + Prisma SQLite models + env/logging.
- [x] Implement Playwright scraper, adapters, parser diagnostics, fixture mode.
- [x] Implement diff/event engine with dedupe/cooldown.
- [x] Implement notification providers (Expo + Noop) + SSE fanout.
- [x] Implement API endpoints and debug endpoints.
- [x] Implement Expo mobile app screens and SSE/push integration.
- [x] Add scripts: `dev`, `dev:server`, `mobile`, `test`, `scrape:once`, `replay:fixtures`.
- [x] Add unit/parser/integration tests.
- [x] Write docs and README including deployment/manual push steps.
- [x] Verify by running install, typecheck, tests, scrape/replay commands.

## Review
- Implemented npm-only monorepo with server/mobile/shared packages.
- Implemented DOM-first parsers for GWCT and YS with selector centralization.
- Implemented weather suspension logic centered on `배선팀근무`, including `All Pilotage Suspended` variants.
- Verified commands:
  - `npm run typecheck` ✅
  - `npm test` ✅ (server tests 6/6)
  - `npm --workspace @gwct/server run scrape:once` ✅ (fixture mode)
  - `npm --workspace @gwct/server run replay:fixtures` ✅ (generated synthetic alerts)

## GC Remaining Subtotal Plan (2026-03-01)
- [x] Verify live `m=F&s=A` DOM and lock parser anchors for GC181~190.
- [x] Implement robust `gwct_gc_remaining` parser outputs for discharge/load subtotals only.
- [x] Wire monitor flow: latest snapshot file dump + GC183~188 summary log + missing combo warnings.
- [x] Implement threshold-crossing event logic (`gc_remaining_low`) with global+GC override support.
- [x] Add GC config/latest APIs (`/api/gc/latest`, `/api/gc/thresholds` GET/POST) with JSON-file storage.
- [x] Add/update fixtures and tests for parser + threshold crossing behavior.
- [x] Update README with GC subtotal monitor details and threshold API usage examples.
- [x] Run `typecheck`, `test`, and fixture replay/scrape validation.

## GC Remaining Review
- Verified live HTML structure from `http://www.gwct.co.kr:8080/dashboard/?m=F&s=A` and anchored parser to `G/C 181~190` + `작업 구분` + `잔량`.
- Confirmed latest dump output: `apps/server/data/latest/gwct_gc_remaining.json` with `gc/workType/remainingSubtotal` for 181~190.
- Confirmed summary log line prints GC183~188 as `D/L` compact format each scrape.
- Confirmed threshold file flow: `apps/server/data/config/gc_thresholds.json` persisted via `GET/POST /api/gc/thresholds`.
- Confirmed crossing-only event behavior with fixture replay: `gc_remaining_low` emitted exactly on `> threshold -> <= threshold` transition.

## Schedule11 ETA Focus Plan (2026-03-01)
- [x] Limit schedule monitoring to `gwct_schedule_list` (`m=H&s=A`) and disable `gwct_schedule_chart` scraping.
- [x] Implement row color classification (`green/yellow/cyan/unknown`) with class-first and color-distance fallback.
- [x] Rebuild schedule parser to select watch window: first yellow row -> non-green 11 rows (fallback first non-green).
- [x] Extract and persist only `모선항차/선박명/입항일시` watch window snapshot to `data/latest/gwct_schedule_list_focus.json`.
- [x] Add ETA-only diff/event rule (`gwct_eta_changed`) with baseline-first behavior and no window-entry alert by default.
- [x] Add schedule summary/debug logs (`[SCHEDULE11] ...` + row color classification details).
- [x] Add/update fixtures and tests for watch-window selection and ETA-change-only event emission.
- [x] Validate with `typecheck`, `test`, and fixture replay.

## Schedule11 ETA Focus Review
- Verified live `m=H&s=A` HTML has `bg_closed/bg_on/bg_yet` row classes; parser now tracks 11-row watch window from first yellow row.
- Removed `gwct_schedule_chart` from active source schedule, so run loops no longer scrape/monitor `m=I&s=A`.
- Confirmed latest focus dump path: `apps/server/data/latest/gwct_schedule_list_focus.json`.
- Confirmed replay emits only one schedule event on ETA change (`gwct_eta_changed`) instead of broad vessel-change bursts.
- Confirmed summary log format includes `[SCHEDULE11] ...` and contains max 11 watch rows.

## Equipment Focus Plan (2026-03-01)
- [x] Update GWCT equipment parser for placeholder-aware normalization and YT login counting by non-empty driver name.
- [x] Normalize GC equipment IDs (`GC180~GC190`) and prepare focus model (`driverName`, `hkName`, `loginTime`, `stopReason`).
- [x] Add JSON stores:
  - `apps/server/data/config/equipment_rules.json` (ytThresholdLow/ytThresholdRecover + persisted YT state)
  - `apps/server/data/latest/gwct_equipment_status_focus.json` (ytCount + GC180~190 latest)
- [x] Implement YT hysteresis events (`yt_count_low`, `yt_count_recovered`) with baseline-first state machine.
- [x] Implement GC180~GC190 change events:
  - `gc_driver_login/logout/changed`
  - `gc_hk_login/logout/changed`
  - `gc_stop_reason_set/cleared/changed`
  - `gc_login_time_changed`
- [x] Wire monitor service to persist equipment latest snapshot and print `[EQUIP] ...` summary log.
- [x] Add API endpoints:
  - `GET /api/equipment/latest`
  - `GET /api/equipment/config`
  - `POST /api/equipment/config`
- [x] Add/adjust tests and fixtures for parser + event transitions.
- [x] Update README with equipment focus monitor behavior and API usage.
- [x] Run `npm run typecheck`, `npm test`, `npm run replay:fixtures`, `npm run scrape:once`.

## Equipment Focus Review
- `gwct_equipment_status` parser now treats placeholders (`-`, `—`, `N/A`, `NA`) as null and counts YT login by non-empty driver only.
- Added equipment config store (`apps/server/data/config/equipment_rules.json`) with `ytThresholdLow/ytThresholdRecover` and persisted YT state (`NORMAL/LOW`).
- Added equipment latest dump (`apps/server/data/latest/gwct_equipment_status_focus.json`) containing `ytCount` and GC180~GC190 driver/hk/login/stop snapshot.
- Added YT hysteresis events:
  - `yt_count_low` on `NORMAL -> LOW` (`ytCount <= low`)
  - `yt_count_recovered` on `LOW -> NORMAL` (`ytCount >= recover`)
- Added GC focus events for GC180~GC190:
  - `gc_driver_login/logout/changed`
  - `gc_hk_login/logout/changed`
  - `gc_stop_reason_set/cleared/changed`
  - `gc_login_time_changed`
- Added equipment APIs:
  - `GET /api/equipment/latest`
  - `GET /api/equipment/config`
  - `POST /api/equipment/config`
- Validation:
  - `npm run typecheck` ✅
  - `npm test` ✅ (server tests 18/18)
- `npm run replay:fixtures` ✅ (`equipment focus summary` logs and GC change events emitted)
- `npm run scrape:once` ✅ (live `m=D&s=A` scrape, `[EQUIP]` summary, latest/config files updated)

## Mobile Equipment UI Plan (2026-03-01)
- [x] Add server alias API `GET /api/events` for mobile event log compatibility.
- [x] Extend mobile API config with `equipment/latest`, `equipment/config`, `events` endpoints.
- [x] Upgrade `useEndpoint` hook to support polling intervals while keeping previous data on fetch failure.
- [x] Rebuild Equipment screen:
  - 20~30s polling + pull-to-refresh
  - YT count/status header + capturedAt
  - GC180~190 list with stopReason highlight
  - network fail banner (`서버 연결 실패, 재시도중…`)
- [x] Rebuild Settings screen:
  - load from `GET /api/equipment/config`
  - low/recover numeric input + +/- step controls
  - POST save + validation (`recover >= low`)
- [x] Rebuild Events screen:
  - `GET /api/events?limit=200` with 10~20s polling + pull-to-refresh
  - display time/type/summary
  - filter: `all / yt / stopReason / loginChange`
- [x] Update README and mobile `.env.example` for iPhone LAN testing (`http://192.168.35.73:4000`).
- [x] Verify with `npm run typecheck`, `npm test`, and API inject checks.

## Mobile Equipment UI Review
- Added `/api/events` route alias (same payload format as `/api/alerts`) for mobile event polling.
- Mobile screens now use `EXPO_PUBLIC_API_BASE_URL` with new endpoints:
  - `GET /api/equipment/latest`
  - `GET /api/equipment/config`
  - `POST /api/equipment/config`
  - `GET /api/events?limit=200`
- Equipment screen now shows YT count/status and GC180~190 detail list with emphasized stop reason and last capture time.
- Settings screen now edits `ytThresholdLow/ytThresholdRecover` with step controls and save validation.
- Events tab now polls `/api/events` and supports type filters (`all`, `yt`, `stopReason`, `loginChange`).
- Verified:
  - `npm run typecheck` ✅
  - `npm test` ✅ (server tests 18/18)
  - `GET /api/events?limit=5` via Fastify inject ✅ (HTTP 200)

## Expo SDK De-dupe Plan (2026-03-02)
- [x] Verify root/server/shared package manifests for accidental `expo`, `expo-*`, `react`, `react-dom`, `react-native` direct dependencies.
- [x] Keep Expo/React Native dependency ownership only in `apps/mobile` (SDK 54 set).
- [x] Remove root install artifacts (`node_modules`, `package-lock.json`) and reinstall from root.
- [x] Validate dependency graph and ensure SDK 55 entries are absent.
- [x] Run `apps/mobile` `expo-doctor` and confirm full pass.

## Expo SDK De-dupe Review
- Root `package.json` has no direct Expo/React Native runtime dependencies.
- `apps/server` and `packages/shared` have no Expo/React Native runtime dependencies.
- Reinstalled from clean root install artifacts:
  - removed `node_modules`
  - removed `package-lock.json`
  - ran `npm install`
- Validation:
  - `npm ls expo react react-dom react-native --workspaces --depth=0` shows only `@gwct/mobile` SDK 54 set (`expo@54.0.33`, `react@19.1.0`, `react-native@0.81.5`)
  - `npx expo-doctor` in `apps/mobile` => `17/17 checks passed`

## GC Remaining WARN Noise Plan (2026-03-02)
- [x] Reconfirm why `gc remaining parse missing gc/workType` is emitted and distinguish real parse failures vs valid blank values.
- [x] Refine warn criteria so partial null combinations do not emit noisy WARN.
- [x] Keep diagnostic visibility via lowered-level log or structured counters.
- [x] Verify behavior with tests/typecheck and capture review notes.

## GC Remaining WARN Noise Review
- Root cause: monitor snapshot persistence logged WARN whenever any `GC181~190` discharge/load subtotal was `null`, even when the page legitimately had blank values for some GC/workType.
- Parser/diagnostics update:
  - `parseGwctGcRemaining` now emits diagnostics only for structural/severe failures:
    - no candidate Gantry Crane table found
    - table structure did not match expected GC remaining layout
    - matched structure but extracted subtotal values were all unavailable
  - partial null subtotals are no longer treated as parser errors.
- Monitor logging update:
  - WARN only when all subtotal pairs are unavailable (`availableSubtotalCount === 0`).
  - partial missing pairs are logged at DEBUG with `missingCount` and `missingSample`.
- Validation:
  - `npm --workspace @gwct/server run test` ✅ (20/20)
  - `npm --workspace @gwct/server run test -- --run tests/gc-parser.test.ts` ✅ (4/4)
  - `npm run typecheck` ❌ (pre-existing `@gwct/mobile` JSX/type issues; server/shared typecheck pass)

## Final QA Plan (2026-03-02)
- [x] Re-run full workspace validation (`npm test`, workspace typechecks, Expo doctor) to capture current baseline.
- [x] Execute runtime smoke checks for server flows (`scrape:once`, `replay:fixtures`) and confirm key logs/snapshots/APIs.
- [x] Investigate and fix any failing checks discovered during final QA.
- [x] Re-run all relevant checks after fixes and document final pass/fail with residual risks.

## Final QA Review
- Fixed mobile build/type issues discovered during QA:
  - Added Expo type entry file: `apps/mobile/expo-env.d.ts`.
  - Updated mobile `tsconfig` include to also load `*.d.ts`.
  - Pinned `@types/react` to `19.1.10` in `apps/mobile/package.json` to avoid JSX incompatibility drift.
  - Updated `components/Themed.tsx` to use `ComponentProps<typeof ...>` instead of `DefaultText['props']` style.
  - Updated `components/useColorScheme.ts` null handling (`coreScheme ?? 'light'`).
  - Updated `lib/push.ts` permission logic to use iOS/Android fields available in current notifications typings.
- Added server robustness fallback:
  - `Repository.saveParseError` now retries without `runId` when a concurrent DB reset causes FK error (`P2003`), instead of failing the whole scrape flow.
- Validation rerun results:
  - `npm test` ✅ (server 20/20)
  - `npm run typecheck` ✅ (mobile/server/shared all pass)
  - `apps/mobile`: `npx expo-doctor` ✅ (`17/17`)
  - `npm --workspace @gwct/server run replay:fixtures` ✅
  - `npm --workspace @gwct/server run scrape:once` ✅ (sequential run)
  - Server API smoke via Fastify inject ✅:
    - `/api/equipment/latest` 200
    - `/api/equipment/config` 200
    - `/api/gc/latest` 200
    - `/api/gc/thresholds` 200
    - `/api/events?limit=5` 200
    - `/api/dashboard/summary` 200
- Note:
  - `scrape:once` and `replay:fixtures` are still recommended to run sequentially in QA, but parse-error persistence now degrades gracefully under concurrent reset race.

## User-Configurable Monitoring Refactor Plan (2026-03-02)
- [x] Re-scan repo structure and lock minimal-impact refactor points (monitor service, diff engine, API routes, mobile screens).
- [x] Add persistent monitor settings store (JSON) with defaults (all disabled), validation, and state fields needed for dedupe/state machines.
- [x] Add/extend server APIs for monitor config/status and latest monitor previews while preserving existing endpoints.
- [ ] Wire monitor settings into server event pipeline:
  - [x] GWCT ETA: configurable tracking count `N` (1~11), enabled-only emit.
  - [x] GC remaining: per-GC enabled + threshold on `(양하+적하)` subtotal crossing.
  - [x] Equipment: YT enabled threshold low/recovered state machine; GC staff change events enabled gate.
  - [x] YS pilotage: enabled gate with persisted last raw text/state/changedAt.
- [x] Keep snapshot/diagnostics persistence active even when monitor feature is disabled.
- [ ] Update mobile app UX:
  - [x] Add monitoring menu entry points.
  - [x] Add four detailed monitor screens with current value preview + numeric input + stepper + Confirm/Cancel.
  - [x] Keep pull-to-refresh/polling and stale-data-on-fetch-failure behavior.
- [x] Ensure SSE/push/local notification flow only for enabled features (no user-visible events when disabled).
- [x] Update/add tests for new config gating and threshold/state transitions.
- [x] Update README/docs with new monitor config APIs, storage paths, and validation behavior.

## User-Configurable Monitoring Refactor Review
- Added monitor settings store:
  - `apps/server/src/services/monitorConfig/store.ts`
  - persisted JSON: `apps/server/data/config/monitor_settings.json`
  - default: all monitor features disabled.
- Server event pipeline now gates emission by monitor settings:
  - GWCT ETA (`trackingCount` 1~11 + enabled gate)
  - GC subtotal (`GC181~190` per-GC enabled/threshold, subtotal crossing)
  - Equipment YT (`enabled`, single-threshold NORMAL/LOW machine)
  - Equipment GC staff changes (`enabled`)
  - YS pilotage transitions (`enabled`)
  - snapshots/diagnostics keep updating even when disabled.
- API expanded:
  - monitor config/status: `/api/monitors/*`
  - schedule focus latest: `/api/schedule/focus/latest`
  - legacy compatibility: `/api/gc/thresholds`, `/api/equipment/config` kept.
- Mobile app updated:
  - monitoring menu + 4 detailed configuration screens
  - Confirm=save+enable, Cancel=disable
  - numeric input + stepper for ETA N / GC thresholds / YT threshold
  - stale data retained on fetch failure
  - root layout now registers device token and schedules local foreground alert from SSE (dedupe by last event id).
- Validation:
  - `npm run typecheck` ✅
  - `npm test` ✅
  - `npm --workspace @gwct/server run replay:fixtures` ✅
  - `npm --workspace @gwct/server run scrape:once` (fixture mode) ✅
  - API inject smoke for `/api/monitors/*`, `/api/schedule/focus/latest`, `/api/gc/latest`, `/api/equipment/latest` ✅
  - `apps/mobile`: `npx expo-doctor` ✅ (`17/17`)

## Final iPhone Readiness QA Plan (2026-03-02)
- [x] Re-run full automated validation (`typecheck`, `tests`, fixture replay, fixture scrape, expo-doctor).
- [x] Run API smoke checks for monitor config/status + latest endpoints using Fastify inject.
- [x] Perform code review focused on iPhone 운영 리스크:
  - [x] notification registration / foreground local-notification dedupe
  - [x] monitor enable/disable gating consistency
  - [x] config persistence/defaults and backward compatibility
- [x] Fix any discovered issues and re-run relevant checks.
- [x] Document findings by severity with file/line references and residual risks.

## Final iPhone Readiness QA Review
- High severity fixed:
  - Mobile monitor screens had mojibake text corruption in newly added files; rewrote screens using UTF-8-safe ASCII labels:
    - `apps/mobile/app/monitor.tsx`
    - `apps/mobile/app/monitor-gwct-eta.tsx`
    - `apps/mobile/app/monitor-gc-remaining.tsx`
    - `apps/mobile/app/monitor-equipment.tsx`
    - `apps/mobile/app/monitor-yeosu.tsx`
- Medium severity fixed:
  - Foreground local SSE notification default was off, causing no local in-app alert in common dev setups without Expo push:
    - `apps/mobile/app/_layout.tsx`
  - Added explicit env guidance:
    - `apps/mobile/.env.example`
    - `README.md`
- Validation rerun:
  - `npm run typecheck` ✅
  - `npm test` ✅ (server 20/20)
  - `npm --workspace @gwct/server run replay:fixtures` ✅
  - `MODE=fixture npm --workspace @gwct/server run scrape:once` ✅
  - `apps/mobile`: `npx expo-doctor` ✅ (`17/17`)
  - Fastify inject API smoke ✅:
    - `GET /api/monitors/config` 200
    - `GET /api/monitors/status` 200
    - `GET /api/schedule/focus/latest` 200
    - `GET /api/gc/latest` 200
    - `GET /api/equipment/latest` 200
    - `GET /api/events?limit=5` 200
    - `POST /api/monitors/gwct-eta` 200
    - `POST /api/monitors/gc-remaining` 200
    - `POST /api/monitors/equipment` 200
    - `POST /api/monitors/yeosu` 200
    - `POST /api/monitors/config` reset 200
- Residual risks:
  - Mobile has no automated UI/integration tests yet (`mobile tests not configured`), so screen-level regressions still require manual Expo Go validation.
  - Live network quality on iPhone depends on same-LAN routing and firewall rules even when app/build checks pass.

## iPhone Runtime Error Fix Plan (2026-03-02)
- [x] Reproduce and classify iPhone red-screen errors from Expo Go screenshots.
- [x] Fix Babel module resolution failures for Expo Router entry build path.
- [x] Verify Expo bundle success with a real iOS bundle build (`expo export`).
- [x] Re-run mobile/server checks and document residual risks.

## iPhone Runtime Error Fix Review
- Root cause 1:
  - Mobile Babel stack was under-declared in workspace context, causing Metro to fail with missing Babel transform modules at runtime (`@babel/plugin-transform-parameters`).
- Root cause 2:
  - Additional Expo Router / reanimated transitive modules were missing in the mobile install tree, causing chained runtime failures.
- Fixes applied:
  - Added mobile Babel deps:
    - `@babel/core`
    - `babel-preset-expo`
    - `@babel/plugin-transform-template-literals`
  - Added explicit Babel config:
    - `apps/mobile/babel.config.js` with `babel-preset-expo`, `expoRouterBabelPlugin`, `react-native-reanimated/plugin`.
  - Rebuilt install artifacts:
    - removed root `node_modules` and `package-lock.json`
    - `npm install`
    - `npm --workspace @gwct/server run prisma:generate`
  - Added missing mobile runtime deps observed from live bundle failure chain (Expo Router/Expo stack) via workspace install.
- Validation:
  - `npx expo export --platform ios --output-dir dist-test --clear` ✅ (iOS bundle completed)
  - `npm --workspace @gwct/mobile run typecheck` ✅
  - `npx expo-doctor` (`apps/mobile`) ✅ (`17/17`)
  - `npm run typecheck` ✅
  - `npm test` ✅ (server `20/20`)
