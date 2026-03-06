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

## Crane Duplicate Key Fix Plan (2026-03-04)
- [x] Trace Crane Status UI render path (`apps/mobile`) and confirm all sibling key sites.
- [x] Trace server data path (`/api/cranes/live` + parser/selector) and confirm whether duplicate `craneId` rows are accidental or structurally valid.
- [x] Apply minimal root-cause fix:
  - [x] normalize/dedupe accidental duplicate crane rows at server response boundary.
  - [x] make mobile render key strategy stable and collision-safe for legally repeated crane IDs.
- [x] Add dev-only duplicate key detector guard for crane list rendering.
- [x] Add deterministic regression coverage for duplicate-row normalization/key behavior.
- [x] Run validation (`npm run typecheck` and relevant tests), then document root cause/files/tests/risks.

## Crane Duplicate Key Fix Review
- Root cause:
  - `/api/cranes/live` returned latest `gwct_work_status` rows with duplicated `craneId` (`GC181~GC190` repeated per vessel table) because parser path (`parseGwctWorkStatus` using selector `gwctSelectors.workStatus.table`) emits per-table rows.
  - mobile Crane Status list keyed by `item.craneId`, so duplicated server rows created React sibling key collision (`'.$GC181'`).
- Fix:
  - Added server-side live-row normalization (`normalizeCraneLiveRows`) and applied it to `/api/cranes/live`.
  - Added mobile composite render key + dev-only duplicate detector logging.
  - Added regression tests for crane live normalization behavior.
- Validation:
  - `npm run typecheck` ✅
  - `npm test` ✅ (mobile test script placeholder, server 22/22 passing including new normalization tests)
- Residual risk:
  - If upstream work-status semantics require true multi-row-per-crane presentation in future UI, current `/api/cranes/live` normalization will collapse to one row per crane by design.

## Yeosu Suspension Monitor Upgrade Plan (2026-03-04)
- [x] Trace and update forecast parser to extract both `배선팀근무` and `대기호출자`.
- [x] Add robust text normalization + combined signal classifier:
  - [x] suspend keyword/pattern coverage (KOR/ENG variants).
  - [x] normal/resume indicator coverage.
  - [x] ambiguous case marker for semantic state carry-over.
- [x] Update shared weather schema/event payload contract with debug fields needed by mobile (`dispatchTeamText`, `standbyCallText`, `matchedKeywords`, `normalizedReason`).
- [x] Refactor weather diff rules:
  - [x] alert only on `NORMAL -> SUSPENDED` and `SUSPENDED -> NORMAL`.
  - [x] keep `TEXT_CHANGED` as history event only when semantic state unchanged.
- [x] Ensure notification delivery (push/SSE/foreground) is transition-only for weather; no sound/push for `TEXT_CHANGED`.
- [x] Add iOS tri-tone style sound policy helper with Expo Go / unavailable fallback to default.
- [x] Update mobile weather/events UI labels and rendering for new standby/debug payload fields.
- [x] Add regression tests for required sample texts and transition dedupe behavior.
- [x] Run `npm run typecheck` and relevant tests; document review summary and residual risks.

## Yeosu Suspension Monitor Upgrade Review
- Root cause:
  - Forecast parsing was effectively single-signal (`배선팀근무`) 중심이라, `대기호출자`에 나타나는 정상/복구 신호를 반영하지 못했고 문구 변화와 상태 전환이 분리되지 않았습니다.
  - Weather 이벤트 `TEXT_CHANGED`도 일반 알림 경로를 타서 transition-only 알림 정책을 보장하지 못했습니다.
- Fix:
  - Parser:
    - `배선팀근무` + `대기호출자`를 동시 추출하고 텍스트 정규화(공백/기호 정리, 영문 대문자화) 후 결합 신호 분류.
    - suspend 우선, normal 다음, 둘 다 없으면 `UNKNOWN` semantic.
  - Diff/알림:
    - semantic 전환 기준으로 `NORMAL -> SUSPENDED`만 `ALL_SUSPENDED`, `SUSPENDED -> NORMAL`만 `RESUMED`.
    - semantic 동일 시 `TEXT_CHANGED` 히스토리만 생성.
    - `TEXT_CHANGED`는 push/SSE dispatch 제외하여 소리/푸시/foreground 알림 차단.
  - Shared 타입:
    - weather snapshot/event payload debug 필드 확장 (`standbyCallText`, `semanticState`, `normalizedReason` 등).
  - Mobile:
    - Weather 화면 라벨/표시를 배선팀+대기호출자 기반으로 갱신.
    - Alerts 탭에서 weather payload debug 필드 표시.
    - iOS tri-tone 경로 상수 연동 + Expo Go/실패 시 default fallback.
- Validation:
  - `npm run typecheck` ✅
  - `npm test` ✅ (mobile tests not configured, server 27/27)
  - Focused regression:
    - `npm --workspace @gwct/server run test -- --run tests/weather-parser.test.ts tests/weather-diff.test.ts tests/notification-policy.test.ts tests/integration-alert.test.ts` ✅
- Residual risk:
  - Prisma `WeatherNoticeSnapshot` 테이블에는 전용 `standbyCallText` 컬럼이 없어 `dutyText` 컬럼을 재사용해 저장합니다.
  - iOS custom sound binary가 아직 repo에 없으므로 기본 동작은 fallback(`default`)이며, 실제 커스텀 적용은 추후 사운드 파일 추가/빌드 배포가 필요합니다.

## YT Unit Monitor Redesign Plan (2026-03-04)
- [x] Reconfirm current GWCT equipment parser fields and YT monitor/event/mobile API usage paths (server/shared/mobile) and lock minimal-impact change points.
- [x] Extend shared domain/event schema for YT unit snapshot + YT unit status change payload while preserving existing event/deeplink flow.
- [x] Implement server-side YT unit snapshot normalization from existing equipment rows and persist it in latest equipment snapshot for API/mobile reuse.
- [x] Redesign YT count state machine in diff engine to satisfy strict transition rules (baseline no alert, unchanged count no event, under-threshold downward alerts, recovery at `>= threshold`).
- [x] Add per-YT transition detector (`active/stopped/logged_out`) with stable key + fingerprint and emit `yt_unit_status_changed` only on required transitions/reason changes.
- [x] Wire monitor service/API updates (`/api/yt/live`) so count summary and unit list are consistent and no duplicate re-alert on identical states.
- [x] Update mobile YT Count and Events UI/filter/labels to render new YT unit states and payload details.
- [x] Align sound/dedupe policy across SSE/local/push path to avoid duplicate user-visible alerts when the same event arrives on multiple channels.
- [x] Add table-driven regression tests for required count/unit scenarios and run validation (`npm run typecheck` + relevant tests).

## YT Unit Monitor Redesign Review
- Root cause:
  - Existing YT monitor pipeline only tracked aggregate count state (`NORMAL/LOW`) and had no per-YT snapshot key/fingerprint layer, so unit-level transitions (중단/로그아웃/복귀/사유변경) were not representable.
  - Count transition function depended on coarse state only, so it could not enforce “under-threshold additional drop only” rule and “unchanged count no event” deterministically.
  - `/api/yt/live` exposed count snapshot only, so YT Count UI and event detail UI could not display current per-unit status.
- Fix:
  - Added YT unit snapshot normalization (`ytNo`, `driverName`, `loginTime`, `hkName`, `stopReason`, `semanticState`, `fingerprint`) from existing equipment rows.
  - Reworked YT count state machine to compare `previousCount -> currentCount` with explicit baseline/no-change/downward/recovery rules.
  - Added generic unit transition event `yt_unit_status_changed` with `transitionKind` + debug payload fields.
  - Extended equipment latest snapshot + `/api/yt/live` response to include `units`, `ytCount`, `ytKnown`, `capturedAt`.
  - Updated mobile YT screen to show sorted per-unit status list and Alerts screen to render YT unit transition payload.
  - Added shared alert sound resolver and eventId-based secondary dedupe across SSE/local/push.
- Validation:
  - `npm run typecheck` ✅
  - `npm test` ✅ (server 31/31 including new `yt-monitor.test.ts`; mobile test script placeholder)
  - `npm run lint` ✅ (workspace lint scripts are placeholders)
- Residual risk:
  - If GWCT page ever omits a YT row entirely (not blank login but missing row), the next re-appearance can be treated as fresh baseline for that unit because persistence is scrape-snapshot based.
  - iOS custom tri-tone file is still optional; when binary is unavailable in app bundle, policy intentionally falls back to `default`.

## Common Semantic Dedupe Plan (2026-03-04)
- [x] Audit server event generation path and remove timestamp/cooldown-based suppression from emit pipeline.
- [x] Enforce semantic-state unchanged => no-event policy for all active monitors (ETA/GC remaining/GC staff/YT count/Yeosu).
- [x] Keep dedupe behavior as state-based (allow re-alert after real state transition and return), not permanent one-time suppression.
- [x] Harden client secondary dedupe so the same event arriving via SSE and push is displayed once (eventId deterministic guard).
- [x] Add semantic no-event regression tests and rerun validation (`typecheck`, `test`, `lint`).

## Common Semantic Dedupe Review
- Server dedupe layer:
  - Removed `AlertEvent` lookup + cooldown gate from `MonitorService.emitEvents`; event creation now relies on monitor-level semantic diff and batch semantic fingerprint set (`source:type:dedupeKey`) to prevent same-batch duplicates.
  - Updated weather diff to emit only semantic transitions (`NORMAL <-> SUSPENDED`); same semantic now emits no event.
- Client dedupe layer:
  - Added `eventId` secondary dedupe guard in mobile notification handler (`rememberAlertEvent` map with TTL) so SSE/local and push paths do not double-show the same alert.
  - Included `eventId` in server push payload and SSE-scheduled local notification payload for consistent cross-channel keying.
- Monitor audit result:
  - GWCT ETA: unchanged ETA/window state => no event.
  - GC remaining: unchanged subtotal state => no event.
  - GC staff change: unchanged operator/HK/login/stop state => no event.
  - YT count: unchanged count or non-semantic move => no event.
  - Yeosu pilotage: unchanged semantic state => no event.
- Validation:
  - `npm run typecheck` ✅
  - `npm test` ✅ (server 32/32)
  - `npm run lint` ✅ (workspace lint scripts remain placeholders)

## GWCT ETA Monitor Improvement Plan (2026-03-04)
- [x] Audit current ETA compare path (`detectGwctEtaChangedEvents`), payload contract, and vessel mobile UI render path.
- [x] Add shared ETA change formatter/helper so server event message and mobile display can stay consistent.
- [x] Tighten ETA change rule to emit `gwct_eta_changed` only when normalized ETA comparison is semantically different and both previous/current ETA are present.
- [x] Expand ETA payload fields (`previousEta`, `currentEta`, `deltaMinutes`, `direction`, `crossedDate`, `humanMessage`) and keep compatible vessel metadata.
- [x] Improve vessel live endpoint to attach latest meaningful ETA change (per vessel, one item) for direct card rendering.
- [x] Update mobile vessel screen to show ETA change message under vessel card with direction color (`earlier=red`, `later=blue`) and readable contrast.
- [x] Add regression tests for same-day earlier/later, next-day rollover, missing previous ETA fallback, and identical normalized ETA no-event.
- [x] Run validation (`npm run typecheck`, `npm test`, `npm run lint`) and document results.

## GWCT ETA Monitor Improvement Review
- Root cause:
  - Existing ETA event payload was minimal (`etaBefore/etaAfter`) and message formatting lived inside server diff logic, so UI and notification wording drifted and date rollover semantics were not explicit.
  - Missing-ETA transitions were treated as changes, making direction/delta semantics ambiguous.
- Fix:
  - Added shared ETA formatter (`summarizeGwctEtaChange`) in `packages/shared` and used it in server ETA diff.
  - `gwct_eta_changed` now emits only when normalized ETA truly differs and both sides are present.
  - Payload now includes:
    - `previousEta`
    - `currentEta`
    - `deltaMinutes`
    - `direction`
    - `crossedDate`
    - `humanMessage`
  - `/api/vessels/live` now includes per-vessel `latestEtaChange` (latest meaningful 1건) built from recent alerts.
  - Mobile vessel cards now show ETA change message immediately below the vessel row with direction-based colors.
- Validation:
  - `npm run typecheck` ✅
  - `npm test` ✅ (server 36/36, includes new ETA monitor tests)
  - `npm run lint` ✅ (workspace lint scripts are placeholders)
- Residual risk:
  - `/api/vessels/live` enriches ETA change by scanning recent alerts (`limit=500`), so extremely high event volume may require a dedicated indexed query endpoint later.

## Home Summary Aggregation Fix Plan (2026-03-04)
- [x] Audit `/api/dashboard/summary` and home screen consumer to identify why counts inflate and verify whether aggregation is historical or snapshot-based.
- [x] Redefine summary metrics with explicit semantics:
  - [x] tracked vessel count from ETA watch window (`min(trackingCount, actualCurrentWatchWindowLength)`).
  - [x] working crane count for GC181~GC190 only with explicit working rule.
  - [x] support equipment login count for `LEASE/REPAIR/RS/TC` only with valid `driverName + loginTime`.
- [x] Implement server summary aggregation helper and wire route to latest snapshot/config-based computation.
- [x] Update shared summary schema and mobile home UI to consume clarified field names and deterministic metric formatter.
- [x] Add tests:
  - [x] summary aggregator unit tests.
  - [x] deterministic formatter test for home metric rendering text.
- [x] Run validation (`npm run typecheck`, `npm test`, `npm run lint`) and record results.

## Home Summary Aggregation Fix Review
- Root cause:
  - Previous summary used cumulative DB row counts (`count(*)`) for vessel/crane/equipment, so values grew over time and no longer represented current operation status.
  - Equipment login count included all equipment rows with non-null operator, mixing GC/YT and historical records.
- Fix:
  - Added dashboard aggregation helper (`services/dashboard/summary.ts`) and switched `/api/dashboard/summary` to latest snapshot/config based counts.
  - Clarified payload fields:
    - `trackedVesselCount`
    - `workingCraneCount`
    - `supportEquipmentLoginCount`
  - Home UI now renders these fields with deterministic formatter (`formatDashboardMetric`) to avoid ambiguous number rendering.
- Validation:
  - `npm run typecheck` ✅
  - `npm test` ✅ (server 40/40; mobile tests not configured)
  - `npm run lint` ✅ (workspace lint scripts remain placeholders)

## Event Log Clear Feature Plan (2026-03-04)
- [x] Audit event history storage/API/mobile event source and define clear scope (delete only history, keep monitor baselines/state/config/device settings).
- [x] Add server-side event history clear repository method + API endpoint (`DELETE /api/events`) and broadcast lightweight SSE sync event (`events_cleared`).
- [x] Ensure clear target includes recent event source used by mobile while excluding snapshots/state machine baselines/thresholds/configs.
- [x] Update mobile Events screen with destructive clear button, confirm modal, loading state, success/fail feedback, and immediate list emptying.
- [x] Add mobile-side secondary sync handling for `events_cleared` SSE to keep multiple clients consistent.
- [x] Add regression tests:
  - [x] history populated -> clear -> empty
  - [x] clear 후 baseline/state 보존으로 same current state 즉시 재알람 없음
  - [x] clear 후 refresh에서도 empty 유지 확인
- [x] Run validation (`npm run typecheck`, `npm test`, `npm run lint`) and document review.

## Event Log Clear Feature Review
- Added server event-history clear scope at repository layer (`clearEventHistory`) to delete only event log tables (`alertEvent`, `vesselScheduleChangeEvent`, `equipmentLoginEvent`, `weatherAlertEvent`, `notificationLog`).
- Added REST endpoint `DELETE /api/events` returning deleted counts and `clearedAt`, and broadcasting SSE `events_cleared` for multi-client sync.
- Mobile Events screen now includes destructive full-clear action with confirm dialog, loading indicator, success/fail feedback, and immediate local list emptying.
- Mobile Events screen listens to SSE `events_cleared` and clears visible list so concurrently open clients stay in sync until next poll.
- Validation:
  - `npm run typecheck` ✅
  - `npm test` ✅ (server 42/42, mobile tests not configured)
  - `npm run lint` ✅ (workspace lint scripts are placeholders)

## Expo Go Shared Module Resolution Plan (2026-03-04)
- [x] Reproduce the Expo/Metro failure and identify the exact import resolution mismatch.
- [x] Fix `packages/shared` internal exports/imports so Expo Go can resolve modules without breaking server/runtime consumers.
- [x] Re-run `npm run typecheck` and `npx expo export --platform ios --clear` to verify bundle/runtime readiness.
- [x] Document root cause, changed files, and remaining runtime risks.

## Expo Go Shared Module Resolution Review
- Root cause: `@gwct/shared` default entry (`src/index.ts`) used NodeNext-style internal imports with explicit `.js` suffix (`./schemas/domain.js`, `./events/index.js`). Expo Metro resolves TS source directly in monorepo and could not map those `.js` suffix paths to existing TS files, causing runtime bundle failure.
- Fix strategy: keep existing Node/server path unchanged, and add a mobile-only entry path:
  - `react-native` conditional export to `src/index.native.ts`
  - `react-native` top-level field to the same native entry
  - native entry files use extensionless internal imports that Metro resolves correctly.
- Shared package typecheck compatibility:
  - `packages/shared/tsconfig.json` now overrides `module`/`moduleResolution` to `ESNext` + `Bundler` so both `.js` (Node entry) and extensionless (native entry) imports typecheck cleanly.
- Validation:
  - `npx expo export --platform ios --output-dir dist-test --clear` ✅ (bundle success)
  - `npm run typecheck` ✅
  - `npm test` ✅ (server 42/42, mobile tests not configured)
  - `npm run lint` ✅ (workspace lint scripts are placeholders)

## 15min Retention Cleanup Plan (2026-03-05)
- [x] Audit real DB/file accumulation paths and classify retention policy (delete/keep N/protect).
- [x] Add retention config/env (`CLEANUP_*`, `RAW_SNAPSHOT_PERSIST`, `DB_COMPACTION_MODE`) with sane defaults.
- [x] Implement repository cleanup primitives:
  - [x] transient TTL deletion (`rawSnapshot`, `scrapeRun`, `parseError`, `notificationLog`)
  - [x] append-only snapshot trimming (keep latest seenAt groups per source)
  - [x] compaction hooks (incremental/full)
- [x] Implement `DataRetentionService` + `CleanupScheduler` (15min interval, overlap guard, metrics logging, FS transient artifact cleanup).
- [x] Integrate runtime startup/shutdown and add manual admin endpoint (`POST /api/admin/cleanup/run`, debug token protected).
- [x] Improve raw snapshot persistence policy (`off | errors_only | all`) in monitor flow without breaking parser/event behavior.
- [x] Add regression tests for cleanup retention/guards/filesystem/compaction path and fixture protection.
- [x] Run validation (`npm run typecheck`, targeted + full tests) and capture before/after DB row/file-size evidence.
- [x] Document results (policy table, safety guarantees, remaining risks).

## 15min Retention Cleanup Review
- Real accumulation root cause:
  - `RawSnapshot.html` append-only growth was dominant (pre-cleanup total raw HTML bytes `215,427,807`, DB file `273,924,096` bytes).
  - append-only snapshot history tables (`VesselScheduleItem`, `CraneStatus`, `EquipmentLoginStatus`, `YTCountSnapshot`, `WeatherNoticeSnapshot`) grew continuously per scrape.
  - transient debug-history tables (`ScrapeRun`, `ParseError`, `NotificationLog`, `RawSnapshot`) grew without TTL.
  - filesystem under `apps/server/data/latest` is overwrite-based and not primary growth source.
- Retention policy implemented:
  - TTL delete (`TRANSIENT_RETENTION_MINUTES`, default 15m): `RawSnapshot`, `ParseError`, `NotificationLog`, `ScrapeRun`.
  - keep latest 2 seenAt groups per source: `VesselScheduleItem`, `CraneStatus`, `EquipmentLoginStatus`, `YTCountSnapshot`, `WeatherNoticeSnapshot`.
  - preserve: `AlertEvent`/event history, monitor settings/baselines, device settings/tokens, latest JSON snapshot files.
  - raw snapshot persistence mode added: `RAW_SNAPSHOT_PERSIST=off|errors_only|all` (default `errors_only`).
- Runtime integration:
  - `DataRetentionService.runCleanupOnce` + `CleanupScheduler` wired at server startup/shutdown.
  - overlap guard for scheduler and service in-flight protection.
  - admin endpoint: `POST /api/admin/cleanup/run` (debug token), optional `{ "fullVacuum": true }`.
- SQLite compaction:
  - default scheduled mode: incremental vacuum (`DB_COMPACTION_MODE=incremental`, `DB_INCREMENTAL_VACUUM_PAGES=256`).
  - full `VACUUM` is manual-only via admin endpoint/request option to avoid 15m lock risk.
  - verified reclaim path:
    - pre-cleanup DB size: `273,924,096` bytes
    - after manual full vacuum: `786,432` bytes
    - reclaimed: `273,137,664` bytes
- Validation:
  - `npm run typecheck` ✅
  - `npm test` ✅ (server `48/48`, mobile tests not configured)
  - added tests:
    - `tests/cleanup-service.test.ts`
    - `tests/cleanup-scheduler.test.ts`
    - `tests/cleanup-route.test.ts`

## GC Helper Parsing Plan (2026-03-06)
- [x] Inspect current GWCT equipment parser and confirm helper detection currently depends on `HK` prefix.
- [x] Update the plan log and capture the user correction in `tasks/lessons.md`.
- [x] Fix parser semantics so GC operator cell maps first line to driver and second non-empty line to helper regardless of `HK` prefix.
- [x] Add regression coverage for a GC row whose helper line is a plain name.
- [x] Run targeted verification and record the review.

## GC Helper Parsing Review
- Root cause:
  - `parseOperatorCellHtml()` only promoted a secondary line to `helperName` when that line matched `/HK/i`.
  - On the live GWCT equipment page, GC 기사란 semantics are positional, not prefix-based: top line is the driver and the lower line is the under-man/helper even when it is just a plain name.
- Fix:
  - Updated the parser to keep `operatorName` as the first non-empty line and `helperName` as the first non-empty subsequent line, with the single-line `HK...` helper-only fallback preserved.
  - Added a regression test for `GC182` with `박종철<br>이홍권`.
- Validation:
  - `npm.cmd --workspace @gwct/server run typecheck` ✅
  - `npm.cmd --workspace @gwct/server run test -- --run tests/equipment-focus.test.ts` ✅

## Cabin/Under Terminology Plan (2026-03-06)
- [x] Inspect current user-facing uses of `기사`/`HK` across server event text and mobile UI.
- [x] Record the terminology correction in `tasks/lessons.md`.
- [x] Update user-facing strings to `Cabin`/`Under` without changing internal field names or event types.
- [x] Run targeted verification and record the review.

## Cabin/Under Terminology Review
- Scope:
  - Updated server GC/equipment event titles and messages.
  - Updated mobile Equipment, YT, Alerts, Settings, Monitor Menu, and Equipment Monitor screen labels/subtitles.
- Compatibility:
  - Internal names such as `driverName`, `hkName`, and `gcStaff` remain unchanged for API and state compatibility.
- Validation:
  - `npm.cmd run typecheck` ✅
  - `npm.cmd --workspace @gwct/server run test -- --run tests/equipment-focus.test.ts tests/semantic-dedupe.test.ts` ✅

## GC Scheduled State Plan (2026-03-06)
- [x] Inspect current GC remaining, equipment latest, dashboard summary, and Crane Status UI paths.
- [x] Record the domain correction in `tasks/lessons.md`.
- [x] Implement a shared server-side GC work-state derivation: `active` vs `scheduled` vs `idle` vs `unknown`.
- [x] Update `/api/cranes/live` and dashboard summary to use the same GC work-state logic.
- [x] Update the mobile Crane Status UI to show `작업 예정` distinctly.
- [x] Run targeted verification and record the review.

## GC Scheduled State Review
- Rule implemented:
  - `remainingSubtotal > 0` and Cabin/Under/login present => `active` (`작업중`)
  - `remainingSubtotal > 0` and Cabin/Under/login all absent => `scheduled` (`작업 예정`)
  - `remainingSubtotal <= 0` => `idle`
  - subtotal unavailable => `unknown`
- Scope:
  - Added server GC work-state helper and applied it to `/api/cranes/live`.
  - Updated dashboard `workingCraneCount` to count only actively staffed GC rows, not scheduled rows.
  - Updated mobile Crane Status cards to display the derived state badge and scheduled-note text.
- Validation:
  - `npm.cmd run typecheck` ✅
  - `npm.cmd --workspace @gwct/server run test -- --run tests/gc-work-state.test.ts tests/dashboard-summary.test.ts tests/crane-live-rows.test.ts` ✅

## Home Equipment Card Removal Plan (2026-03-06)
- [x] Confirm the user wants to remove only the home-screen `장비 현황` card shown in the screenshot.
- [x] Record the clarified scope in `tasks/lessons.md`.
- [x] Remove the home-screen `장비 현황` card while keeping the underlying screen/feature intact.
- [x] Run mobile typecheck and record the result.

## Home Equipment Card Removal Review
- Scope:
  - Remove only the `장비 현황` card from the home screen.
  - Keep the Equipment route and related monitoring functionality intact.
- Validation:
  - `npm.cmd --workspace @gwct/mobile run typecheck` ✅

## Crane Status Ordering Plan (2026-03-06)
- [x] Inspect the current Crane Status screen ordering and badge label mapping.
- [x] Record the new UI-priority rule in `tasks/lessons.md`.
- [x] Reorder crane cards by operational priority: `작업중` -> `작업 예정` -> `작업 안함`, with GC number ascending inside each group.
- [x] Collapse the former `상태 미확인` badge text into `작업 안함` for the Crane Status screen.
- [x] Run mobile typecheck and record the review.

## Crane Status Ordering Review
- Scope:
  - Reordered the Crane Status list on the mobile screen by operational priority instead of raw GC number order.
  - Collapsed both `idle` and `unknown` into the single user-facing label `작업 안함`.
- Behavior:
  - Card order is now `작업중` -> `작업 예정` -> `작업 안함`.
  - Within each group, cranes remain sorted by GC number ascending.
  - `작업 안함` uses one consistent badge style regardless of whether the backend state is `idle` or `unknown`.
- Validation:
  - `npm.cmd --workspace @gwct/mobile run typecheck` ✅

## GC Cabin/Under Status Screen Plan (2026-03-06)
- [x] Inspect the existing equipment screen and confirm it already uses `/api/equipment/latest` GC rows.
- [x] Re-scope the mobile `equipment` screen to a dedicated GC Cabin/Under status view with clear stop-state presentation.
- [x] Re-add a home entry card for the focused GC Cabin/Under screen without restoring the old duplicated equipment summary.
- [x] Run mobile typecheck and record the review.

## GC Cabin/Under Status Screen Review
- Data path:
  - Reused the existing `/api/equipment/latest` payload and `gcStates` array.
  - No server schema or endpoint changes were needed.
- UI changes:
  - Converted the `equipment` route into a dedicated GC Cabin/Under status screen for GC180~190.
  - Added explicit state badges derived from existing fields: `중단` when `stopReason` exists, `탑승중` when crew/login data exists without a stop reason, otherwise `미탑승`.
  - Moved stop reason into a separate highlighted panel so stopped cranes are visually obvious.
  - Re-added a focused home entry card for the screen instead of restoring the old mixed equipment summary.
- Validation:
  - `npm.cmd --workspace @gwct/mobile run typecheck` ✅

## GC Cabin/Under Compact Layout Plan (2026-03-06)
- [x] Inspect the current GC Cabin/Under card density and confirm the layout is too tall for phone-sized scanning.
- [x] Record the compact mobile layout rule in `tasks/lessons.md`.
- [x] Refactor each GC card into dense inline rows for Cabin, Under, login time, and stop reason while keeping stop reasons visually distinct.
- [x] Run mobile typecheck and record the review.

## GC Cabin/Under Compact Layout Review
- Layout changes:
  - Replaced the tall stacked field blocks with dense one-line rows: `Cabin`, `Under`, `로그인`, `중단사유`.
  - Shrunk card padding, header spacing, badge size, and typography so more GC cards fit on one screen.
  - Reduced the top summary from a large card to a compact status strip.
  - Kept stopped rows visually obvious by highlighting only the `중단사유` row instead of using a large separate panel.
- Validation:
  - `npm.cmd --workspace @gwct/mobile run typecheck` ✅

## GC Cabin/Under Status Refinement Plan (2026-03-06)
- [x] Record the refined screen-only filtering, iconography, and sorting rules in `tasks/todo.md` and `tasks/lessons.md`.
- [x] Exclude GC180 from the live GC Cabin/Under screen, compress the layout further into two inline rows, and replace text-only badges with shape-based status marks.
- [x] Sort visible GCs as `탑승중 -> 중단 -> 미탑승`, keeping GC number ascending inside each group, but preserve plain numeric order when every visible GC is `미탑승`.
- [x] Run mobile typecheck and record the review.

## GC Cabin/Under Status Refinement Review
- Scope:
  - Applied the new rules only to the mobile `GC Cabin/Under 현황` screen.
  - Conservatively left server-side GC monitoring/event logic unchanged.
- Behavior:
  - Excludes `GC180` from the live list and summary so the screen now covers `GC181~190`.
  - Uses explicit status marks:
    - `탑승중`: blue circle
    - `중단`: red triangle
    - `미탑승`: gray square
  - Compresses each GC card into two inline rows:
    - `Cabin <name>   Under <name>`
    - `로그인 <time>   중단사유 <reason>`
  - Sorts visible GCs by `탑승중 -> 중단 -> 미탑승`, with GC number ascending inside each group.
  - Falls back to plain numeric order when every visible GC is `미탑승`.
- Validation:
  - `npm.cmd --workspace @gwct/mobile run typecheck` ✅

## GC Cabin/Under Icon-Only Layout Plan (2026-03-06)
- [x] Record the latest icon-only and alignment correction in `tasks/todo.md` and `tasks/lessons.md`.
- [x] Remove visible status text from the summary and each GC row, enlarge the icons, and tighten the two-column alignment so `Under` and `중단사유` share the same vertical start.
- [x] Give the second column more usable width for stop reasons while keeping the first column compact for login time.
- [x] Run mobile typecheck and record the review.

## GC Cabin/Under Icon-Only Layout Review
- Display changes:
  - Removed visible status text from the top summary and GC row indicators.
  - The top summary now uses only enlarged shape icons plus counts:
    - blue circle = `작업중`
    - red triangle = `중단`
    - gray square = `작업 안함`
  - The GC row header now shows only a larger shape icon on the right with no status text.
- Layout changes:
  - Kept the compact two-row layout, but fixed the column alignment so `Under` and `중단사유` start at the same horizontal position.
  - Shrunk the left column to fit login time and gave the right column more remaining width for longer stop reasons.
- Validation:
  - `npm.cmd --workspace @gwct/mobile run typecheck` ✅

## GC Cabin/Under Replacement Verification Plan (2026-03-06)
- [x] Record a verification-only plan without changing implementation files.
- [x] Inspect the GC equipment diff logic and existing regression tests for Cabin/Under name replacement events.
- [x] Run targeted verification for Cabin/Under replacement handling and record the result.

## GC Cabin/Under Replacement Verification Review
- Implementation check:
  - `detectGcEquipmentFocusEvents()` emits `gc_driver_changed` when Cabin changes and `gc_hk_changed` when Under changes.
  - The event titles/messages are explicit (`GC188 Cabin A -> B`, `GC188 Under A -> B`).
- Verification:
  - Existing regression test `tests/equipment-focus.test.ts` passed and explicitly asserts both `gc_driver_changed` and `gc_hk_changed`.
  - Additional inline verification with ASCII names produced:
    - `gc_driver_changed`
    - `gc_hk_changed`
    - `gc_login_time_changed`
  - This confirms a same-GC operator/helper replacement is treated as a change event, not as a logout/login pair.
- Note:
  - The inline shell verification with Korean literals was not reliable because of shell stdin encoding, so the deterministic result is the UTF-8 test file plus the ASCII direct invocation.

## Crew Change Wording Plan (2026-03-06)
- [x] Inspect current GC and YT change-event message generation and confirm YT driver replacement is not yet emitted.
- [x] Record the wording correction in `tasks/lessons.md`.
- [x] Update GC Cabin/Under change messages to use `교대` wording and extend YT unit status transitions to emit a driver replacement event with the same wording style.
- [x] Run targeted server tests and typecheck, then record the review.

## Crew Change Wording Review
- Root cause:
  - GC Cabin/Under personnel replacement alerts were emitted, but the user-facing wording stayed at `변경`.
  - YT per-unit monitoring did not emit any event when the same YT stayed logged in and only the driver name changed, because the logic only covered semantic-state transitions and stopped-reason changes.
- Changes:
  - GC `gc_driver_changed` and `gc_hk_changed` now use `교대` titles/messages.
  - YT `yt_unit_status_changed` gained a `driver_changed` transition kind and now emits `YT23 A -> B 교대` when the same YT number keeps running with a different driver.
  - YT driver replacement alerts use a specific title: `YT 기사 교대 (YT23)`.
- Validation:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/equipment-focus.test.ts tests/yt-monitor.test.ts tests/semantic-dedupe.test.ts` ✅
  - `npm.cmd run typecheck` ✅

## GC Right-Column Alignment Plan (2026-03-06)
- [x] Inspect the current `Under` / `중단사유` offset and record the alignment correction in `tasks/todo.md` and `tasks/lessons.md`.
- [x] Remove the extra left inset from the lower-right `중단사유` field so it shares the same horizontal start as the upper-right `Under` field.
- [x] Run mobile typecheck and record the review.

## GC Right-Column Alignment Review
- Root cause:
  - The lower-right `중단사유` field had additional horizontal padding that the upper-right `Under` field did not, so the two rows started at different horizontal positions.
- Fix:
  - Removed the extra left inset from the `중단사유` container while preserving its compact highlight styling.
- Validation:
  - `npm.cmd --workspace @gwct/mobile run typecheck` ✅

## Home Return Button Plan (2026-03-06)
- [x] Inspect the root stack header configuration and identify the top-level screens currently showing the default `< (tabs)` back control.
- [x] Record the navigation correction in `tasks/todo.md` and `tasks/lessons.md`.
- [x] Replace the default back title on home-entry screens with a circular `<` home-return button while preserving normal back behavior on deeper sub-screens.
- [x] Run mobile typecheck and record the review.

## Home Return Button Review
- Scope:
  - Replaced the default `< (tabs)` back control only on screens entered directly from the home cards:
    - `vessels`
    - `cranes`
    - `equipment`
    - `yt`
    - `weather`
    - `monitor`
  - Left deeper monitor sub-screens on normal stack back behavior.
- Implementation:
  - Added a reusable circular header button component that calls `router.replace("/(tabs)")`.
  - Hid the default back control on those home-entry screens and supplied the custom left header button instead.
- Validation:
  - `npm.cmd --workspace @gwct/mobile run typecheck` ✅

## Home Return Button Simplification Plan (2026-03-06)
- [x] Inspect the current `HomeHeaderButton` styling and record the visual correction in `tasks/todo.md` and `tasks/lessons.md`.
- [x] Simplify the button to a single-circle outline so it no longer looks like a circle inside another circle.
- [x] Run mobile typecheck and record the review.

## Home Return Button Simplification Review
- Fix:
  - Removed the filled-circle plus contrasting-border look and changed the control to a single circular outline with `<` inside.
- Validation:
  - `npm.cmd --workspace @gwct/mobile run typecheck` ✅

## Home Return Glyph Rollback Plan (2026-03-06)
- [x] Inspect the current `HomeHeaderButton` glyph and record the rollback scope in `tasks/todo.md` and `tasks/lessons.md`.
- [x] Restore the inner back glyph to the prior native-looking chevron while keeping the simplified circular button.
- [x] Run mobile typecheck and record the verification.

## Home Return Glyph Rollback Review
- Fix:
  - Kept the single-circle home-return button, but replaced the ASCII `<` with a native-looking chevron glyph.
- Validation:
  - `npm.cmd --workspace @gwct/mobile run typecheck` ✅

## Header Back Full Rollback Plan (2026-03-06)
- [x] Record the correction that the user wants the full original default back button restored, not another partial style tweak.
- [x] Remove the custom home-return button wiring and restore the original default `< (tabs)` stack back behavior on the top-level screens.
- [x] Run mobile typecheck and record the rollback review.

## Header Back Full Rollback Review
- Fix:
  - Removed the custom circular home-return button entirely.
  - Restored the original Expo stack header back behavior, so the top-level screens are back to the default `< (tabs)` control.
- Validation:
  - `npm.cmd --workspace @gwct/mobile run typecheck` ✅

## Home YT Widget Typography Plan (2026-03-06)
- [x] Inspect the home screen YT summary card implementation and record the requested typography adjustment in `tasks/todo.md` and `tasks/lessons.md`.
- [x] Increase the `YT` label and count typography so the card uses its available whitespace more effectively without changing the card layout or summary logic.
- [x] Run mobile typecheck and record the review.

## Home YT Widget Typography Review
- Root cause:
  - The home YT summary card had a relatively large fixed footprint, but the `YT` label and count stayed undersized, leaving too much empty space and weakening the visual hierarchy.
- Fix:
  - Increased the `YT` label typography and the numeric count size in the home card.
  - Slightly rebalanced the card padding so the larger text uses the card space cleanly without changing the surrounding layout.
- Validation:
  - `npm.cmd --workspace @gwct/mobile run typecheck` ✅

## Home YT Widget Rollback Plan (2026-03-06)
- [x] Revert only the last home YT typography tweak in `apps/mobile/app/(tabs)/index.tsx` back to its previous values.
- [x] Record the rollback request in `tasks/todo.md` and `tasks/lessons.md`.
- [x] Run mobile typecheck and record the rollback review.

## Home YT Widget Rollback Review
- Fix:
  - Restored the home `YT` card padding and typography to the pre-change values.
  - No other home cards or summary logic were changed.
- Validation:
  - `npm.cmd --workspace @gwct/mobile run typecheck` ✅

## iOS Status Bar Color Lock Plan (2026-03-06)
- [x] Inspect the mobile root layout, modal screen, and Expo app config to identify why iOS status bar content flips to white in system dark mode.
- [x] Force the app to stay on light interface style and keep all app-owned status bars on dark content so the top iPhone time/signal/battery glyphs remain black.
- [x] Run mobile typecheck and record the review.

## iOS Status Bar Color Lock Review
- Root cause:
  - `apps/mobile/app.json` used `userInterfaceStyle: "automatic"`, so iOS still treated the app as dark-mode eligible and could render the status bar glyphs in white when the system theme was dark.
  - The modal screen also explicitly requested a light status bar on iOS, which conflicted with the desired always-black status bar rule.
- Fix:
  - Changed Expo app config to `userInterfaceStyle: "light"` so the app always presents itself as a light-interface app.
  - Standardized the modal screen status bar to `dark` so app-owned screens no longer opt into white status bar content.
- Validation:
  - `npm.cmd --workspace @gwct/mobile run typecheck` ✅
  - `npx expo config --type public --json` -> `"userInterfaceStyle":"light"` ✅

## Mobile Settings Tab Rework Plan (2026-03-06)
- [x] Inspect the current bottom-tab settings screen plus the existing device registration, notification, and theme-related code paths in `apps/mobile`, `apps/server`, and `packages/shared`.
- [x] Add persisted device-level settings support for `alertsEnabled`, `bannerEnabled`, and `themeMode` without resetting saved values on app startup.
- [x] Replace the duplicate monitor-status settings tab with a real settings screen for alarm on/off, banner on/off, and theme mode (`system`, `dark`, `light`) wired to live app behavior.
- [x] Apply the new theme preference to the mobile shell and primary home/settings surfaces so the mode switch has visible effect.
- [x] Run the relevant verification (`server` tests for device settings persistence + mobile typecheck) and record the review.

## Mobile Settings Tab Rework Review
- Root cause:
  - The bottom-right settings tab only duplicated monitor status/navigation and did not control any real app-level behavior.
  - Device alert preferences were not durable because app startup registration overwrote `alertsEnabled` back to `true`.
- Fix:
  - Added persisted device settings fields for `alertsEnabled`, `bannerEnabled`, and `themeMode` in shared/server types and the device registration storage path.
  - Changed device registration so existing saved preferences survive app startup re-registration.
  - Replaced the old settings tab with a real settings screen for:
    - alarm on/off
    - foreground banner on/off
    - theme mode (`system`, `dark`, `light`)
  - Added a mobile app preferences provider that:
    - syncs device settings with the server
    - drives local notification presentation rules
    - applies the selected theme to the app shell and primary home/settings surfaces
- Validation:
  - `npm.cmd --workspace @gwct/server run prisma:push` ✅
  - `npm.cmd --workspace @gwct/server run test -- --run tests/device-settings-api.test.ts` ✅
  - `npm.cmd --workspace @gwct/server run typecheck` ✅
  - `npm.cmd --workspace @gwct/mobile run typecheck` ✅
  - `npm.cmd run typecheck` ✅
- Follow-up note:
  - `npm.cmd --workspace @gwct/server run prisma:generate` hit a Windows `EPERM` rename lock on `node_modules/.prisma/client/query_engine-windows.dll.node`. The schema push succeeded and TypeScript verification passed, but the Prisma engine binary refresh should be re-run after closing the process that currently holds that DLL.

## Background Banner Suppression Follow-up (2026-03-06)
- [x] Inspect the server push dispatch path and Expo notification constraints for background presentation behavior.
- [x] Route `bannerEnabled=false` devices to a headless background push payload instead of a normal notification message.
- [x] Enable iOS background remote notification entitlement in Expo config.
- [x] Add server tests for normal-vs-headless Expo payload generation and rerun verification.

## Background Banner Suppression Review
- Root cause:
  - The earlier `Banner` toggle only affected the in-app foreground notification handler. Server push dispatch still sent normal notification messages with `title/body`, so iOS/Android would keep showing OS banners while the app was backgrounded or terminated.
- Fix:
  - Added `bannerEnabled` to the push recipient model and passed it from the device registration rows into the notification provider.
  - Changed the Expo push provider so:
    - `bannerEnabled=true` keeps sending the existing normal push payload with `title`, `body`, and `sound`.
    - `bannerEnabled=false` sends a headless background payload with only `data` and, on iOS, `_contentAvailable: true`.
  - Enabled `enableBackgroundRemoteNotifications` in [app.json](C:/coding/gwct/apps/mobile/app.json) so iOS builds include the required `remote-notification` background mode for headless remote notifications.
- Validation:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/device-settings-api.test.ts tests/expo-provider.test.ts` ✅
  - `npm.cmd run typecheck` ✅
  - `npx expo config --type public --json` includes `["expo-notifications",{"enableBackgroundRemoteNotifications":true}]` ✅
- Constraint:
  - Expo headless background notifications intentionally omit presentational fields. That means `Banner off` now suppresses background/terminated OS banners consistently, but those headless pushes also do not carry sound or other visible presentation by default.

## Vessel Schedule H-Page Alignment Plan (2026-03-07)
- [x] Inspect the current schedule parser, ETA change formatter, `/api/vessels/live` route, mobile `Vessel Schedule` screen, and the live `m=H&s=A` page structure/colors.
- [x] Return explicit watch-window order, row color, and KST ETA/ETD display fields from the server so the mobile screen no longer relies on raw ISO strings or implicit DB row order.
- [x] Update ETA change messaging so crossed-date delays include both the relative day label and the exact hour/minute delta.
- [x] Refresh the mobile `Vessel Schedule` UI to match the live yellow/cyan row cues and the corrected ETA/ETD rendering.
- [x] Run relevant parser/ETA regression tests plus typecheck and record the review.

## Vessel Schedule H-Page Alignment Review
- Root cause:
  - The live `m=H&s=A` page really does use the watch window starting at the first yellow row and then continuing into cyan rows, but the mobile screen was not rendering any of that row-color context.
  - The parser was already extracting `입항 일시` and `출항 일시` from the correct live columns, but the mobile screen displayed raw ISO UTC strings. That made values like `2026-03-06T05:00:00.000Z` look wrong next to the H-page row `2026/03/06 14:00`.
  - `/api/vessels/live` also relied on implicit DB row order instead of an explicit watch-window index, so the UI did not have a guaranteed `1..11` presentation order tied to the H-page rows.
- Fix:
  - Added a server-side vessel live-row builder that returns:
    - explicit `watchIndex`
    - `rowColor`
    - `etaDisplay`
    - `etdDisplay`
    - latest ETA change details with display-formatted previous/current ETA
  - Sorted vessel live rows by the parsed watch-window index and capped the response to 11 rows.
  - Updated shared ETA messaging so crossed-date delays now include both the relative day label and the exact duration, for example:
    - `내일로 0시간 50분 더 늦게 입항 예정입니다.`
  - Refreshed the mobile `Vessel Schedule` screen so yellow rows use a soft yellow card tone, cyan rows use a soft sky-blue tone, and ETA/ETD render in the exact `YYYY/MM/DD HH:mm` format expected from the H-page.
- Validation:
  - Live `m=H&s=A` page confirmed via browser inspection:
    - `bg_on` rows -> `rgb(254, 220, 143)` (yellow)
    - `bg_yet` rows -> `rgb(167, 238, 255)` (cyan)
    - Example row `SAWASDEE SIRIUS` shows `ETA 2026/03/06 14:00`, `ETD 2026/03/07 02:00`
  - `npm.cmd --workspace @gwct/server run test -- --run tests/schedule-focus.test.ts tests/gwct-eta-monitor.test.ts tests/vessels-live-rows.test.ts` ✅
  - `npm.cmd --workspace @gwct/server run typecheck` ✅
  - `npm.cmd --workspace @gwct/mobile run typecheck` ✅
  - `npm.cmd run typecheck` ✅

## Monitoring Menu Card Refresh Plan (2026-03-07)
- [x] Inspect the current monitoring menu screen and reusable mobile card styles.
- [x] Replace the plain stacked monitor entries with distinct, tappable card-style items while keeping the same routes.
- [x] Preserve theme support and keep the layout compact enough for phone screens.
- [x] Run mobile typecheck and record the review.

## Monitoring Menu Card Refresh Review
- Root cause:
  - The monitoring menu technically reused navigation items, but the entries read like bare stacked text because the screen lacked distinct per-item card hierarchy and tap affordances.
  - The intro card and the monitor links also used nearly the same visual weight, so the actionable items did not stand out from the surrounding copy.
- Fix:
  - Reworked [monitor.tsx](C:/coding/gwct/apps/mobile/app/monitor.tsx) into a dedicated card list with one card per monitor route.
  - Each card now has:
    - a distinct icon badge
    - stronger card border/shadow separation
    - larger title/subtitle hierarchy
    - a trailing chevron and small action pill so it reads as a tappable destination
  - Kept all existing routes and monitor behavior unchanged; this is a UI-only refresh.
- Validation:
  - `npm.cmd --workspace @gwct/mobile run typecheck` ✅


## Crane Scheduled Note Removal Plan (2026-03-07)
- [x] Inspect the crane status screen and confirm where the scheduled-state explanatory copy is rendered.
- [x] Remove the scheduled explanatory copy while keeping the backend state badge and sorting behavior intact.
- [x] Run mobile typecheck and record the review.

## Crane Scheduled Note Removal Review
- Root cause:
  - The `작업 예정` card already exposes the resolved backend state through its badge, so repeating the full reasoning sentence inside every card added noise and made the list taller without adding new operator value.
- Fix:
  - Removed the scheduled-state explanatory sentence from [cranes.tsx](C:/coding/gwct/apps/mobile/app/cranes.tsx).
  - Kept the existing `작업 예정` badge, sort order, and backend-derived state logic unchanged.
  - Restored the file to clean UTF-8 source while applying the change so TypeScript parsing remains stable.
- Validation:
  - `npm.cmd --workspace @gwct/mobile run typecheck` ✅


## Crane Status F-Page Alignment Plan (2026-03-07)
- [x] Inspect the current crane parser, GC latest snapshot, `/api/cranes/live`, and mobile crane UI to trace where GC189/190 got incorrect remaining values.
- [x] Verify the live `m=F&s=A` table structure and confirm whether the work-status parser is misreading per-GC discharge/load columns.
- [x] Fix the parser/API so empty GC rows stay empty and same GC numbers can appear as separate vessel rows when multiple vessels still have remaining work.
- [x] Add regression tests for blank trailing GC columns and multi-vessel same-GC live rows.
- [x] Run relevant tests/typecheck and record the review.

## Crane Status F-Page Alignment Review
- Root cause:
  - The `gwct_work_status` parser was reading per-GC body cells using the first header-row index even though each `G/C nnn` header spans two body columns. That shifted later GC values to the right, so empty trailing columns like `GC189/GC190` inherited earlier cranes' remaining values.
  - `/api/cranes/live` also collapsed the screen to one row per GC, so if multiple vessels legitimately retained the same GC number with remaining work, only one vessel row could survive.
- Live verification:
  - Browser inspection of the current `http://www.gwct.co.kr:8080/dashboard/?m=F&s=A` confirmed the table uses a `G/C nnn` header row plus a second `작업 구분 / 양하 / 적하` row.
  - Running the fixed parser against the live page now yields:
    - `GC187 POS GUANGZHOU = 42 / 73 / 115`
    - `GC188 POS GUANGZHOU = 51 / 98 / 149`
    - `GC189 = null`
    - `GC190 = null`
- Fix:
  - Updated [gwct.ts](C:/coding/gwct/apps/server/src/parsers/gwct.ts) so per-GC discharge/load cells are addressed as `1 + gcIndex * 2` and `2 + gcIndex * 2`.
  - Updated [workState.ts](C:/coding/gwct/apps/server/src/services/gc/workState.ts) so `/api/cranes/live`:
    - no longer revives empty `GC189/GC190` from misaligned work-status rows
    - emits separate rows when multiple vessels still have remaining work for the same GC number
  - Updated [cranes.tsx](C:/coding/gwct/apps/mobile/app/cranes.tsx) to sort same-GC rows by vessel name after state/GC ordering.
  - Updated [craneKeys.ts](C:/coding/gwct/apps/mobile/lib/craneKeys.ts) so the dev duplicate detector no longer treats `same GC + different vessel` as an error by itself.
- Conservative assumption:
  - Equipment crew state exists only at physical GC level, not per-vessel level. When multiple vessel rows share one GC, the live API applies the same GC-level `active/scheduled` state to each row because the source data does not identify which vessel currently has the crew aboard.
- Validation:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/gwct-work-status-parser.test.ts tests/gc-work-state.test.ts tests/crane-live-rows.test.ts` ✅
  - `npm.cmd --workspace @gwct/server run typecheck` ✅
  - `npm.cmd --workspace @gwct/mobile run typecheck` ✅
  - `npm.cmd --workspace @gwct/server exec -- tsx` live parser/API spot checks for current `m=F&s=A` ✅


## Yeosu Pilotage Monitor Audit Plan (2026-03-07)
- [x] Inspect the current server Yeosu forecast/notice parser, semantic state logic, shared payload schema, and mobile weather UI.
- [x] Verify the live YS Pilot site structure and look for additional official notice routes relevant to port-closing or pilotage suspension.
- [x] Tighten the server/shared detection path if any suspension keywords, fallback notice sources, or debug payload fields are missing.
- [x] Refresh the mobile Yeosu Pilotage UI so the forecast content is easier to scan.
- [x] Run relevant tests/typecheck and record the review.

## Yeosu Pilotage Monitor Audit Review
- Current-state audit:
  - The existing forecast parser already read both `배선팀근무` and `대기호출자`, and the semantic transition logic already prevented repeat alerts while the same suspended/normal state continued.
  - The missing parts were elsewhere:
    - board fallback only used `공지사항`, not `새소식`
    - board parsing stopped at the first row and could miss a lower suspension headline under unrelated pinned notices
    - board evidence was not stored with full `standbyCallText/semanticState/normalizedReason`
    - live/mobile weather API could not show the same debug reason that the parser used
- Live verification:
  - Confirmed the live forecast status page still exposes `대기호출자` and `배선팀근무` as the operational signal fields.
  - Confirmed the official board menu exposes both:
    - `http://www.yspilot.co.kr/boards/lists/notice`
    - `http://www.yspilot.co.kr/boards/lists/news`
  - Live parser check on 2026-03-07 KST returned current forecast state `NORMAL` from:
    - `배선팀근무 = ■김현후.염규일■조영훈.김희훈■홍상철.윤지환`
    - `대기호출자 = ■1대기:LJ.LH`
- Fix:
  - Added `ys_news` as an official secondary source in shared schema, server env, source schedule, and parser routing.
  - Rebuilt the YS parser so:
    - forecast still combines `배선팀근무 + 대기호출자`
    - suspend keywords cover broader variants such as `전면 도선 중단`, `도선업무 중단`, `도선 불가`, `기상 불량`, `PORT CLOSED`, `HARBOR CLOSED`, `입출항 통제`
    - normal/resume keywords include `도선 재개`, `업무 재개`, `정상 운영`, `정상 배선`, `PORT OPEN`
  - Reworked board parsing to scan recent visible rows instead of only the first board row, then choose the first recent actionable suspension/resume headline.
  - Added a conservative stale-board guard:
    - only board rows posted within 2 days are allowed to affect suspension semantics
    - if no recent actionable row exists, the board headline is shown for reference but does not force `SUSPENDED`
  - Added a shared effective-state helper so forecast + notice + news are merged with one rule set for both monitor service and API/UI.
  - Persisted the missing weather snapshot fields in DB:
    - `standbyCallText`
    - `semanticState`
    - `normalizedReason`
  - Updated the mobile weather screen to show:
    - resolved current state
    - `배선팀근무`
    - `대기호출자`
    - normalized reason
    - matched keyword chips
    - separate `공지사항` / `새소식` evidence cards
- Conservative assumption:
  - Board list headlines are secondary insurance only, not a perpetual source of truth. To avoid historical notice titles keeping the port closed forever, only recent board rows (within 2 days) can influence the current semantic state.
- Validation:
  - `npm.cmd --workspace @gwct/server run prisma:push` ✅
  - `npm.cmd --workspace @gwct/server run prisma:generate` ✅
  - backfilled existing `WeatherNoticeSnapshot.semanticState/standbyCallText` rows in SQLite ✅
  - `npm.cmd --workspace @gwct/server run test -- --run tests/weather-parser.test.ts tests/weather-diff.test.ts tests/yeosu-effective-state.test.ts` ✅
  - `npm.cmd --workspace @gwct/server run test` ✅
  - `npm.cmd --workspace @gwct/server run typecheck` ✅
  - `npm.cmd --workspace @gwct/mobile run typecheck` ✅
  - `npm.cmd run typecheck` ✅
  - live fetch + parser verification against current official `forecast/status`, `공지사항`, `새소식` pages ✅

## Monitoring Menu Spacing Polish Plan (2026-03-07)
- [x] Inspect the current monitoring menu card layout and identify the right-side chevron plus cramped vertical rhythm.
- [ ] Remove the right-side chevron and rebalance icon/title/subtitle/pill spacing to use the screen height better.
- [ ] Run mobile typecheck and record the review.

## Monitoring Menu Spacing Polish Review
- Root cause:
  - The monitoring cards still carried a right-side chevron even though the whole card already reads as a tap target, so the extra affordance added visual noise.
  - The icon, title, subtitle, and action pill were stacked too tightly near the top of each card, while the screen had spare vertical room below, making the overall composition feel top-heavy.
- Fix:
  - Removed the right-side chevron from [monitor.tsx](C:/coding/gwct/apps/mobile/app/monitor.tsx).
  - Rebalanced the vertical rhythm by increasing:
    - screen/card list spacing
    - hero card padding/gap
    - monitor card min height and padding
    - icon badge size
    - subtitle line height
    - footer pill spacing
  - Added a small `cardBody` wrapper so title/subtitle sit in a more centered vertical block instead of hugging the icon row.
- Validation:
  - `npm.cmd --workspace @gwct/mobile run typecheck` ✅

## Monitoring Menu First-Screen Rebalance Review
- Root cause:
  - The previous spacing pass improved breathing room, but the top `Monitoring Menu` hero consumed too much height relative to the actual action cards.
  - That pushed the last visible `Open Settings` pill slightly below the first-screen fold, which looked clipped even though the screen was scrollable.
- Fix:
  - Tightened only the top-heavy parts in [monitor.tsx](C:/coding/gwct/apps/mobile/app/monitor.tsx):
    - reduced overall content gap and bottom padding
    - reduced hero card vertical padding and internal gap
    - tightened hero subtitle line height and hint row spacing
    - slightly reduced card list gap and monitor card min height
    - slightly tightened title/subtitle/footer spacing inside monitor cards
  - Kept the card-style structure, icon size, and chevron removal from the previous pass.
- Validation:
  - `npm.cmd --workspace @gwct/mobile run typecheck` ✅

## Monitoring Menu Icon-Title Micro Spacing Review
- Root cause:
  - After the first-screen rebalance, the icon block and the monitor title were still reading slightly too tight vertically even though the overall card height was now acceptable.
- Fix:
  - In [monitor.tsx](C:/coding/gwct/apps/mobile/app/monitor.tsx), added a very small separation between the icon row and the text block:
    - `monitorCardTop.marginBottom = 2`
    - `cardBody.marginTop = 2`
  - Kept the rest of the first-screen fit unchanged so the last `Open Settings` pill still has room.
- Validation:
  - `npm.cmd --workspace @gwct/mobile run typecheck` ✅

## Settings Header Light-Background Plan (2026-03-07)
- [x] Inspect the settings tab header source and confirm it inherits the shared blue tab header.
- [x] Override only the settings tab header so it uses the light screen background with dark title text.
- [x] Run mobile typecheck and record the review.

## Settings Header Light-Background Review
- Root cause:
  - The `Settings` tab was inheriting the shared tab-header style from [apps/mobile/app/(tabs)/_layout.tsx](/c:/coding/gwct/apps/mobile/app/(tabs)/_layout.tsx), which sets a blue accent background and light title tint for every tab header by default.
  - That made the settings screen top area visually inconsistent with its own light page background and reduced the contrast benefit of the app's dark status-bar content.
- Fix:
  - Overrode only the `settings` tab header options in [apps/mobile/app/(tabs)/_layout.tsx](/c:/coding/gwct/apps/mobile/app/(tabs)/_layout.tsx) to use:
    - `colors.screenBackground` as the header background
    - `colors.primaryText` for the title tint/style
    - `headerShadowVisible: false` so the top area reads as one continuous light surface
- Validation:
  - `npm.cmd --workspace @gwct/mobile run typecheck` ✅
