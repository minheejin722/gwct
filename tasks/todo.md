# GWCT MVP Todo

## YT Driver Peek Edit Plan (2026-03-11)
- [x] Re-check the `YT Driver` identity block and the existing YT Master registration update API.
- [x] Add a long-press peek/pop-style number edit popup on the top-right driver identity block so only the YT number can be changed in place.
- [x] Run targeted mobile verification and record the result.

## YT Driver Peek Edit Review (2026-03-11)
- Updated `apps/mobile/app/yt-master-call.tsx` so the top-right `YT ?? / ??` block in the driver view now opens a small number-edit popup on long press.
- Reused the existing `saveYtMasterCallRegistration(...)` path to update only the current driver device's YT number while preserving the saved name.
- The popup is a small top-right overlay instead of a full settings navigation flow, so operators can adjust the number in place.
- If there is already a pending call, the popup now makes it explicit that the changed YT number applies from the next call onward.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - `npx expo export --platform ios --output-dir dist-test --clear` in `apps/mobile`
## YT Master Header Alignment Plan (2026-03-11)
- [x] Re-check the current `YT Master` top header block in `?? ??` and compare it to the already-tightened `YT Driver` header layout.
- [x] Remove the extra top-left brand block from the master view and move `MASTER-N / ??` into the same top row as the large `YT Master` title.
- [x] Remove the visible `(??)` suffix and run targeted mobile verification.

## YT Master Header Alignment Review (2026-03-11)
- Updated `apps/mobile/app/yt-master-call.tsx` so the master view now uses the same compact top row pattern as the driver view.
- Removed the top-left cube icon and `YT Master` brand block from the master screen.
- Moved the right-side identity block to the same top row as the large `YT Master` title and kept it as:
  - first line: `MASTER-N`
  - second line: operator name
- Removed the visible `(??)` suffix from the large master title so the screen header now matches the driver's structure more closely.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`
## YT Master Push Notification Upgrade Plan (2026-03-11)
- [x] Re-check the current GWCT push pipeline and the YT Master Call SSE-only path to lock the minimal no-design-change implementation.
- [x] Add targeted push delivery for YT Master call creation and approval/rejection so driver/master devices can receive OS-level notifications while backgrounded or terminated.
- [x] Add the minimum mobile notification-response routing needed so tapping a YT Master push opens the existing `반장 호출` screen without redesigning any UI.
- [x] Run targeted verification, then record the final review with concrete limits/risks.

## YT Master Push Notification Upgrade Review (2026-03-11)
- Kept the existing `반장 호출` UI and layouts intact; this change upgrades notification delivery and notification-tap routing rather than redesigning the screen itself.
- Added targeted push delivery for YT Master events:
  - new driver call creation now pushes to the currently registered master device ids
  - approval/rejection now pushes directly to the owning driver device id
- Extended the shared deep-link target enum with `yt-master-call` so YT Master notifications can open the existing call screen from an OS notification tap.
- Added mobile notification-response routing in `apps/mobile/app/_layout.tsx` so tapping a delivered push opens `/yt-master-call` without changing the screen design.
- Removed the old YT Master SSE-to-local-notification duplication path so approval/rejection no longer depends only on an in-app SSE connection when push is available.
- Added server route coverage for the targeted push path and reset the persisted YT Master test store before each route test to avoid live-state leakage into recipients.
- Verification:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/yt-master-call-api.test.ts tests/expo-provider.test.ts`
  - `npm.cmd --workspace @gwct/server run typecheck`
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - `npx expo export --platform ios --output-dir dist-test --clear` in `apps/mobile`

## YT Master Foreground Alert And Auto-Open Fix Plan (2026-03-11)
- [x] Re-check why YT Master approval alerts were not visibly arriving and why the app stayed on unrelated screens while already open.
- [x] Add the minimum server/mobile flags and foreground fallback handling so YT Master notifications can force a banner and auto-open the existing `반장 호출` screen while the app is already running.
- [x] Preserve the no-redesign UI scope, rerun verification, and document the remaining runtime limitation.

## YT Master Foreground Alert And Auto-Open Fix Review (2026-03-11)
- Added `forcePresentation` and `autoOpen` notification payload hints to the targeted YT Master push path so the existing Expo notification handler can treat YT call events as urgent and routable.
- Expanded the YT Master SSE broadcasts so new master-call creation now includes enough targeting metadata (`masterDeviceIds`, `title`, `message`, `eventId`) for an in-app fallback when the server push provider is disabled.
- Reworked `apps/mobile/app/_layout.tsx` so:
  - foreground YT Master notifications auto-open `/yt-master-call` even if the user is currently on another screen
  - YT Master SSE events schedule forced local notifications and trigger the same route opening path for the relevant driver/master device only
  - notification taps still route into the existing `반장 호출` screen
- This restores visible approval/rejection alerts during local development too, where `EXPO_PUSH_ENABLED=false` means OS push is not actually leaving the server.
- Remaining limit:
  - if the app is backgrounded or terminated and the server still has `EXPO_PUSH_ENABLED=false`, SSE fallback cannot wake the app; that case still needs real Expo push enabled on the deployed server.
- Verification:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/yt-master-call-api.test.ts tests/expo-provider.test.ts`
  - `npm.cmd --workspace @gwct/server run typecheck`
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - `npx expo export --platform ios --output-dir dist-test --clear` in `apps/mobile`

## Yeosu Scrape Interval Change Plan (2026-03-11)
- [x] Confirm the current Yeosu Pilotage scrape interval source and the running server process using port `4000`.
- [x] Change the active Yeosu scrape interval from `10000ms` to `60000ms` in the local server config and repo defaults/examples.
- [x] Restart the local server and verify the updated `60초` cadence is the running value.

## Yeosu Scrape Interval Change Review (2026-03-11)
- Changed `YS_INTERVAL_MS` from `10000` to `60000` in:
  - `apps/server/.env`
  - `apps/server/.env.example`
  - `apps/server/src/config/env.ts`
- Restarted the local server on port `4000` so the new Yeosu cadence took effect immediately.
- Runtime verification:
  - `ys_forecast` scrape started at `2026-03-11 10:15:38 KST`
  - next `ys_forecast` scrape started at `2026-03-11 10:16:38 KST`
  - this confirms the running interval is now about `60초`
- Verification:
  - `npm.cmd --workspace @gwct/server run typecheck`

## Home GWCT Label Correction Plan (2026-03-11)
- [x] Identify the exact home GWCT widget label rendering `예선 상태`.
- [x] Update the visible label to `도선 상태` without changing the underlying behavior or status color logic.
- [x] Run quick mobile verification and document the result.

## Home GWCT Label Correction Review (2026-03-11)
- Updated the home `GWCT` widget label in `apps/mobile/app/(tabs)/index.tsx` from `예선 상태` to `도선 상태`.
- Kept the existing status value (`근무` / `중단`) and color logic unchanged; this was a terminology-only correction.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## YT Master Call Driver Header And Loader Tightening Plan (2026-03-11)
- [x] Re-check the user's follow-up corrections to the pending loader and driver header layout.
- [x] Remove the extra pending helper sentence, remove the driver's top-left brand block, move the driver identity to the title row, and simplify the loader center so the faint inner circle disappears while the hourglass grows slightly.
- [x] Run targeted mobile verification and document the result.

## YT Master Call Driver Header And Loader Tightening Review (2026-03-11)
- Removed the pending helper copy `반장 연결을 기다리고 있습니다.` so the waiting card stays cleaner and shorter.
- Removed the top-left cube icon + `YT Master` brand row from the `YT Driver` screen only, then moved `YT 번호 / 기사 이름` onto the same top row as the `YT Driver` title to reclaim vertical space and pull the whole layout upward.
- Kept the outer orbiting dot loader exactly as the waiting signal, removed the faint inner circular badge background, and increased the center hourglass size so the icon stays clearer without introducing extra visual bulk.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - `npx expo export --platform ios --output-dir dist-test --clear` in `apps/mobile`

## YT Master Call Pending Loader Redesign Plan (2026-03-11)
- [x] Re-check the first pending-hourglass animation against the user's screenshot-driven correction and confirm the desired direction is a standard circular loading ring, not a spinning center icon.
- [x] Replace the previous spinning-hourglass treatment with a static center plus orbiting circular loading dots and adjust the pending card layout to support the new visual hierarchy.
- [x] Run targeted mobile verification and document the redesign result.

## YT Master Call Pending Loader Redesign Review (2026-03-11)
- Replaced the first spinning-hourglass version with a more standard waiting loader in `apps/mobile/app/yt-master-call.tsx`.
- The pending card now uses:
  - a static centered hourglass badge
  - a surrounding ring of fading blue dots
  - continuous ring rotation to communicate active waiting without spinning the center icon itself
- Expanded the pending card so the loader reads as the primary visual and added a short subline (`반장 연결을 기다리고 있습니다.`) under `호출 대기 중...`.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - `npx expo export --platform ios --output-dir dist-test --clear` in `apps/mobile`

## YT Master Call Pending Hourglass Animation Plan (2026-03-11)
- [x] Re-check the current `호출 대기 중` UI in `YT Master Call` and confirm that the waiting state still uses a static hourglass icon.
- [x] Add a looping motion treatment so the pending hourglass visibly reads as an active waiting/loading state.
- [x] Run targeted mobile verification and document the result.

## YT Master Call Pending Hourglass Animation Review (2026-03-11)
- Added a dedicated pending-hourglass animation in `apps/mobile/app/yt-master-call.tsx` using `react-native-reanimated`.
- The `호출 대기 중...` card now shows a continuously rotating `timer-sand` icon while the call remains pending, which makes the waiting/loading state read more clearly at a glance.
- Kept the scope local to the driver's pending card so approved/rejected states and the rest of the YT Master Call UI remain unchanged.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - `npx expo export --platform ios --output-dir dist-test --clear` in `apps/mobile`

## YT Master Call Master Rejection Runtime Test (2026-03-11)
- [x] Re-check the live store and identify the actual pending `YT-591 / 이송택 / 화장실` call after the user reported it was just sent.
- [x] Register a dedicated test `YT Master` device as `송일권` because no active master registration was present in server state at the time of the test.
- [x] Reject the pending call as `송일권` and verify the driver and master live states reflect the rejection.

## YT Master Call Master Rejection Runtime Test Review (2026-03-11)
- Found pending call `yt_master_call_03911a05-cc61-4cdd-a8e3-bd24cf73476e` for `YT-591 / 이송택 / 화장실`.
- At the moment of handling, the server had no active master registration, so I registered test master device `codex-master-song-ilgwon-20260311` as `송일권 / MASTER-1` and used that role to process the call.
- Rejected the call through `POST /api/yt-master-call/calls/:callId/decision` with `status: "rejected"`.
- Verified:
  - the driver's `currentCall.status` is now `rejected`
  - `resolvedByName` is `송일권`
  - master `pendingCount` is now `0`

## YT Master Call Second Live Runtime Test (2026-03-11)
- [x] Register a second dedicated test `YT Driver` device for `YT-591 / 이송택`.
- [x] Create a live `트랙터 점검` call for that driver and verify it appears as pending.
- [x] Confirm the new call is visible in master `송일권`'s queue together with the earlier pending test call.

## YT Master Call Second Live Runtime Test Review (2026-03-11)
- Registered test driver device `codex-driver-inspection-20260311-591` as `이송택 / YT-591`.
- Created pending call `yt_master_call_93d4c4e8-d601-46bb-9636-95fd0e04b71d` with `reasonCode: "tractor_inspection"` and `reasonLabel: "트랙터 점검"`.
- Verified the call in both:
  - the driver's `currentCall`
  - master `송일권`'s live `queue`
- Current master queue state after the second call:
  - earlier pending `화장실` call for `YT-998`
  - new pending `트랙터 점검` call for `YT-591 / 이송택`
  - `pendingCount: 2`

## YT Master Call Live Runtime Test (2026-03-11)
- [x] Verify the local server is currently serving the YT Master Call live API and confirm the active master assignment before sending a test call.
- [x] Register a dedicated test `YT Driver` device and create a live call with the `화장실` reason.
- [x] Verify that the pending call appears in the registered driver's live state and in master `송일권`'s queue.

## YT Master Call Live Runtime Test Review (2026-03-11)
- Confirmed the local server was reachable at `http://127.0.0.1:4000` and already had `송일권` registered as `MASTER-1`.
- Registered test driver device `codex-driver-restroom-20260311-1` with `YT-998`, then created a call with `reasonCode: "restroom"`.
- Verified the created pending call `yt_master_call_d8d21060-4436-4229-9b1c-7a8bab61a2ce` in both:
  - the driver's `currentCall`
  - master `송일권`'s `queue`
- Current live result:
  - `reasonLabel: "화장실"`
  - `status: "pending"`
  - `pendingCount: 1`

## YT Master Call Keyboard Scroll Re-fix Plan (2026-03-11)
- [x] Re-check the failed on-device keyboard behavior against the current `YT Master Call` settings screen structure and identify why the first focus-scroll approach did not visibly move the form.
- [x] Replace the fragile responder-based scroll path with explicit keyboard-aware insets and measured overlap-based input scrolling.
- [x] Run targeted mobile verification and record the corrected review.

## YT Master Call Keyboard Scroll Re-fix Review (2026-03-11)
- Root cause: the screen still used a plain `ScrollView` with no real keyboard inset handling, and the first fix relied only on `scrollResponderScrollNativeHandleToKeyboard`, which did not produce a visible scroll on the actual iPhone layout shown by the user.
- Reworked `apps/mobile/app/yt-master-call-settings.tsx` so the settings form now:
  - enables `automaticallyAdjustKeyboardInsets`
  - tracks the live keyboard frame and current scroll offset
  - measures the focused field wrapper in window coordinates
  - scrolls by the exact overlap amount needed to keep the active field above the keyboard with breathing room
- Applied the same measured scroll path to both the driver `YT 번호` field and the shared `이름` field, so both `YT Driver` and `YT Master` registration cases follow the same keyboard-avoidance logic.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - `npx expo export --platform ios --output-dir dist-test --clear` in `apps/mobile`

## YT Master Call Keyboard Scroll Plan (2026-03-11)
- [x] Re-check the current `YT Master Call` settings form structure and confirm why the lower registration inputs can sit under the iPhone keyboard.
- [x] Add focused-input scroll handling so the active `YT 번호` / `이름` field is moved above the keyboard while typing.
- [x] Run targeted mobile verification and document the result.

## YT Master Call Keyboard Scroll Review (2026-03-11)
- Added focused-input keyboard scroll handling in `apps/mobile/app/yt-master-call-settings.tsx` so the active `YT 번호` / `이름` field is pushed above the on-screen keyboard instead of staying hidden under it.
- Used the `ScrollView` native keyboard scroll responder with a small delayed focus hook and extra offset, which keeps the change local to this screen without changing the broader layout structure.
- Added `keyboardShouldPersistTaps="handled"` on the settings `ScrollView` so the save/clear controls remain tappable while the keyboard is open.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - `npx expo export --platform ios --output-dir dist-test --clear` in `apps/mobile`

## YT Master Call Plan (2026-03-11)
- [x] Re-scan the current Home card, Settings hero card, root stack routes, and existing device/SSE infrastructure to lock the minimal-impact insertion points for the new YT Master Call feature.
- [x] Add a dedicated persisted YT Master Call store for:
  - [x] per-device role registration (`none | driver | master`)
  - [x] driver profile (`YT 번호`, `이름`)
  - [x] master profile (`이름`, assigned slot `MASTER-1 | MASTER-2`)
  - [x] call queue/history with `pending | approved | rejected` status and timestamps
- [x] Add server APIs for:
  - [x] current-device role/profile lookup
  - [x] role registration/update with a strict two-master global cap
  - [x] role clear/reset for the current device
  - [x] driver call creation with one active pending call per driver guard
  - [x] master call list retrieval ordered by call time
  - [x] master approve/reject actions
- [x] Broadcast YT Master Call SSE events so role changes, new calls, and approval/rejection state changes reach the app immediately.
- [x] Extend shared types so the mobile app and server use the same role/call contracts.
- [x] Add the mobile YT Master Call settings flow:
  - [x] replace the first Settings card (`App Settings`) with `YT Master Call`
  - [x] add a dedicated role setup screen for choosing `YT Master` or `YT Driver`
  - [x] enforce name / YT number input rules and render current registration state
- [x] Replace the Home 5th card (`모니터링 설정`) with `반장 호출` while keeping the bottom-tab `Monitoring` route unchanged.
- [x] Add the new call screen with role-specific UI:
  - [x] `YT Driver` layout matching the provided reference closely
  - [x] `YT Master` queue layout matching the provided reference closely
  - [x] live status refresh and immediate approval/rejection feedback
- [x] Trigger an immediate local app notification or alert for the driver when a master approves or rejects a call.
- [x] Add targeted server tests for store logic and route behavior, then run the relevant server tests plus workspace typecheck.

## YT Master Call Review (2026-03-11)
- Added a dedicated JSON-backed YT Master Call state store and service with strict business rules: max two global masters, normalized `YT-번호` driver registration, one pending call per driver, and pending-call guard on driver role clear/change.
- Added shared role/call schemas in `@gwct/shared` so server and mobile now use the same contracts for `driver/master`, `MASTER-1/2`, call reasons, call queue entries, and live-state payloads.
- Added server routes:
  - `GET /api/yt-master-call/live?deviceId=...`
  - `POST /api/yt-master-call/register`
  - `DELETE /api/yt-master-call/register/:deviceId`
  - `POST /api/yt-master-call/calls`
  - `POST /api/yt-master-call/calls/:callId/decision`
- Added YT Master Call SSE events:
  - `yt_master_call_role_updated`
  - `yt_master_call_changed`
  - `yt_master_call_resolved`
- Replaced the Home 5th card with `반장 호출` while leaving the bottom-tab `Monitoring` route intact.
- Replaced the first Settings hero card with a `YT Master Call` entry card and added a dedicated role setup screen for `YT Master` / `YT Driver`.
- Added the new `반장 호출` screen with role-specific layouts:
  - driver view with big circular call button, reason chips, and live pending/approved/rejected status panel
  - master view with oldest-first queue cards and approve/reject actions
- Added a dedicated local-notification path for `yt_master_call_resolved` so driver approval/rejection alerts can still be forced visible immediately, separate from generic monitor-alert preference gating.
- Verification:
  - `npm --workspace @gwct/server run test -- --run tests/yt-master-call-service.test.ts tests/yt-master-call-api.test.ts`
  - `npm run typecheck`
  - `npm test`
  - `npx expo export --platform ios --output-dir dist-test --clear` in `apps/mobile`

## YT Master Call Cancel Update Plan (2026-03-11)
- [x] Re-check the current YT Master Call driver pending-state flow and identify the minimal change needed to support user-initiated cancellation.
- [x] Add a server-side pending-call cancel action that only the owning YT Driver can trigger.
- [x] Ensure cancelled calls disappear from the master queue immediately while not surfacing stale resolved history back to the driver screen.
- [x] Update the driver UI so tapping the pending-status card cancels the current call.
- [x] Rename the top-left `Yard Master` label to `YT Master` anywhere it appears on the call screens.
- [x] Add or update tests for the cancel flow and rerun targeted verification.

## YT Master Call Cancel Update Review (2026-03-11)
- Added driver-owned pending-call cancellation with a new `DELETE /api/yt-master-call/calls/:callId` route and shared cancel input schema.
- Kept cancelled calls in server state as `cancelled` instead of deleting them outright so the backend can distinguish the latest cancelled call from older approved/rejected history; the driver `currentCall` now hides a latest cancelled call, and the master queue excludes cancelled rows entirely.
- Broadcast cancellation through the existing `yt_master_call_changed` SSE channel with `type: "cancelled"`, so both driver and master screens refresh immediately and the cancelled pending card disappears from the master's live queue.
- Updated the driver UI so the lower `호출 대기 중...` card becomes the cancel surface while pending; tapping it now sends cancellation instead of leaving the user stuck in the waiting state.
- Renamed the top-left branding from `Yard Master` to `YT Master` and aligned the master title to `YT Master (반장)`.
- Verification:
  - `npm --workspace @gwct/server run test -- --run tests/yt-master-call-service.test.ts tests/yt-master-call-api.test.ts`
  - `npm run typecheck`
  - `npx expo export --platform ios --output-dir dist-test --clear` in `apps/mobile`
  - `npm test`

## Schedule Relaxed Signal Plan (2026-03-11)
- [x] Confirm the current relaxed-mode schedule signal logic and identify the narrow condition change needed.
- [x] Update the GWCT cadence governor so the first relaxed condition is also satisfied when the `m=H&s=A` schedule list is entirely `cyan`.
- [x] Preserve the existing `yellow`-window behavior for active or soon-to-work schedules.
- [x] Add or update cadence governor tests for the all-`cyan` schedule case.
- [x] Run targeted verification and record the outcome.

## Schedule Relaxed Signal Review (2026-03-11)
- Added `_allRowsCyan` schedule metadata in the GWCT parser so cadence logic can distinguish a true full-list idle state from the normal first-yellow watch window.
- Updated the cadence governor so the first relaxed signal is ready when either the existing yellow-window rule matches or the parsed schedule list is entirely `cyan`.
- Preserved the prior yellow-based rule unchanged for active/soon-to-work situations.
- Verified with `npx vitest run tests/scrape-cadence-governor.test.ts tests/schedule-focus.test.ts` and `npm run typecheck` in `apps/server`.

## Work Signal Fix Plan (2026-03-11)
- [x] Reproduce the current live work-signal failure and confirm whether the blocker is stale runtime or bad work-status parsing.
- [x] Update the cadence governor work-signal parser to match the current `m=F&s=A` headers and treat an empty work table as a relaxed-ready no-work state.
- [x] Add or update tests for Korean work-status headers and the empty-table no-work case.
- [x] Run targeted verification against tests and, if needed, a live diagnostic replay.

## Work Signal Fix Review (2026-03-11)
- Reproduced the live issue: schedule and equipment signals were already relaxed-ready, but the work signal stayed false because the governor looked for mojibake header labels instead of the current `입항일시` / `진행률` headers.
- Added a current-DOM work-signal path that recognizes the Korean headers and treats a recognized work summary table with zero data rows as a no-work relaxed-ready state.
- Added a cadence governor test for the empty-table case and updated the work-summary test HTML to the current header labels.
- Verified with `npx vitest run tests/scrape-cadence-governor.test.ts tests/schedule-focus.test.ts`, `npm run typecheck`, and a live standalone replay that now yields `mode: "relaxed"` with the current GWCT pages.

## Equipment Rule Refinement Plan (2026-03-11)
- [x] Confirm the current equipment-signal rule that counts support-equipment logins together with YT logins.
- [x] Refine the cadence governor so `LEASE` / `REPAIR` / `RS` / `TC` / `TH` logins do not block relaxed mode when active `YT` logins are zero.
- [x] Preserve stability guards so the relaxed transition still requires two consistent observations.
- [x] Add or update cadence governor tests for support-equipment logins with zero YT logins.
- [x] Run targeted verification and record the result.

## Equipment Rule Refinement Review (2026-03-11)
- Updated the equipment signal to split active logins into YT, support-equipment, and relaxed-relevant sets, so support logins alone no longer block relaxed mode when YT logins are absent.
- Changed stability tracking and relaxed wake-up tracking to use the relaxed-relevant fingerprint set, preventing `LEASE` / `REPAIR` / `RS` / `TC` / `TH` login churn from kicking the governor back to fast when YT stays at zero.
- Added a cadence governor test that enters relaxed mode with only support-equipment logins and stays relaxed across further support-only login changes.
- Verified with `npx vitest run tests/scrape-cadence-governor.test.ts tests/schedule-focus.test.ts` and `npm run typecheck` in `apps/server`.

## Schedule Semi-Fast Exception Plan (2026-03-11)
- [x] Confirm the current relaxed cadence applies a uniform interval to `gwct_schedule_list` and the other managed GWCT sources.
- [x] Update the cadence governor so relaxed mode keeps `gwct_schedule_list` on a semi-fast exception interval while the other managed GWCT sources stay at the 10-minute relaxed cadence.
- [x] Treat semi-fast as `30s`, per the user's concrete correction.
- [x] Update cadence governor tests for the per-source relaxed cadence split and shift-boundary behavior.
- [x] Run targeted verification and record the result.

## Schedule Semi-Fast Exception Review (2026-03-11)
- Changed relaxed per-source cadence so `gwct_schedule_list` now uses a `30s` semi-fast interval while `gwct_work_status`, `gwct_gc_remaining`, and `gwct_equipment_status` stay on the existing `10m` relaxed cadence.
- Kept the current mode model intact; only the relaxed per-source interval table changed, so all relaxed entry/exit rules and shift-boundary wake behavior remain unchanged.
- Updated cadence governor expectations to verify the schedule exception and to keep the boundary cap assertion on the non-schedule GWCT sources.
- Verified with `npx vitest run tests/scrape-cadence-governor.test.ts tests/scheduler.test.ts` and `npm run typecheck` in `apps/server`.
- Restarted the local server on port `4000` and confirmed live runtime behavior from `ScrapeRun`: after the initial fast-entry observations, `gwct_schedule_list` settled to roughly `30s` intervals.

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
## YT Driver Work-Time Plan (2026-03-07)
- [x] Inspect the existing YT snapshot pipeline, persistence options, and mobile tab shell to choose a conservative server-backed session model.
- [x] Add persisted YT work-time session and per-driver accumulation state with explicit day/night shift controls and break-time handling.
- [x] Wire the server scrape/snapshot flow so YT active/stopped/logged-out transitions update accumulated work segments without inventing fake state.
- [x] Add a bottom-tab personnel/work-time screen that starts day/night counting mode and shows ranked accumulated driver totals for the active shift.
- [x] Run focused tests plus workspace typecheck, then document the review and remaining risks.

## YT Driver Work-Time Review
- Root cause:
  - The repo already had real-time YT semantic state (`active/stopped/logged_out`) but no persisted concept of an operator-selected shift session, so there was nowhere to accumulate driver work segments across multiple YT relogins within one shift.
  - The bottom tab shell also still spent its center slot on a dummy refresh tab, so there was no dedicated navigation point for an operator-focused work-time screen.
- Fix:
  - Added shared response schemas for YT work-time session state in [packages/shared/src/schemas/domain.ts](C:/coding/gwct/packages/shared/src/schemas/domain.ts).
  - Added a conservative server-side single-session accumulator in:
    - [apps/server/src/services/ytWorkTime/store.ts](C:/coding/gwct/apps/server/src/services/ytWorkTime/store.ts)
    - [apps/server/src/services/ytWorkTime/service.ts](C:/coding/gwct/apps/server/src/services/ytWorkTime/service.ts)
  - Persistence choice:
    - stored the current session in `apps/server/data/config/yt_work_time_session.json`
    - kept it in `data/config` so cleanup does not delete it and so the server can resume the active shift state after restart
  - Counting rules implemented:
    - only `YT semanticState === active` with a real driver name opens or continues a work segment
    - `stopped` or disappearance from named rows closes the open segment and accumulates elapsed work
    - the same driver name later reappearing on any YT opens a new segment and adds to the same total
    - lunch (`12:00~13:00`) and midnight (`00:00~01:00`) breaks are subtracted only for the overlapping portion of a segment
    - shift sessions auto-complete at `19:00` for day mode or `07:00` for night mode
  - Integrated the accumulator into the real scrape pipeline by updating it whenever `gwct_equipment_status` produces a new YT unit snapshot in [apps/server/src/services/monitorService.ts](C:/coding/gwct/apps/server/src/services/monitorService.ts).
  - Added explicit APIs in [apps/server/src/routes/api.ts](C:/coding/gwct/apps/server/src/routes/api.ts):
    - `GET /api/yt/work-time`
    - `POST /api/yt/work-time/start`
  - Replaced the useless center refresh tab with a dedicated people/work tab in [apps/mobile/app/(tabs)/_layout.tsx](C:/coding/gwct/apps/mobile/app/(tabs)/_layout.tsx).
  - Added the mobile screen [apps/mobile/app/worktime.tsx](C:/coding/gwct/apps/mobile/app/worktime.tsx) and stack registration in [apps/mobile/app/_layout.tsx](C:/coding/gwct/apps/mobile/app/_layout.tsx).
- Conservative assumptions:
  - There is exactly one global active YT work-time session at a time on the server. Starting a new day/night session replaces the previous saved session.
  - Driver identity is keyed by normalized driver name because the source page does not expose a stronger unique driver ID.
  - The user's `7시간` wording conflicts with the stated `07:00~19:00 / 19:00~07:00` windows plus one-hour break. I implemented actual accumulated active time inside the selected shift window with fixed break subtraction, and did not invent a separate 7-hour hard cap.
  - If a driver logs in and reaches `stopped` before any scrape ever observed them as `active`, the system does not fabricate unseen work time; accumulation begins from the first captured active state after the mode starts.
- Validation:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/yt-work-time.test.ts tests/yt-monitor.test.ts` ✅
  - `npm.cmd --workspace @gwct/server run test` ✅
  - `npm.cmd --workspace @gwct/server run typecheck` ✅
  - `npm.cmd --workspace @gwct/mobile run typecheck` ✅
  - `npm.cmd run typecheck` ✅
- Remaining risks:
  - The work-time tab now lives in the `(tabs)` group and typechecks cleanly, but I did not run an Expo bundle/export in this pass.
  - Because the source only exposes driver names, two different operators with the exact same displayed name would be merged into one accumulated total.

## YT Work-Time Tab Visibility Fix Review
- Root cause:
  - The people/work-time screen had been created at [apps/mobile/app/worktime.tsx](C:/coding/gwct/apps/mobile/app/worktime.tsx) while the tab bar tried to expose a non-existent `worktime-tab` screen in [apps/mobile/app/(tabs)/_layout.tsx](C:/coding/gwct/apps/mobile/app/(tabs)/_layout.tsx).
  - In Expo Router, that does not create a real bottom-tab destination. The visible tab must map to a real route file inside the `(tabs)` group.
- Fix:
  - Moved the screen into the tab group as [apps/mobile/app/(tabs)/worktime.tsx](C:/coding/gwct/apps/mobile/app/(tabs)/worktime.tsx).
  - Changed the tab registration from `worktime-tab` to the real route name `worktime` in [apps/mobile/app/(tabs)/_layout.tsx](C:/coding/gwct/apps/mobile/app/(tabs)/_layout.tsx).
  - Removed the now-unneeded top-level stack registration for `worktime` in [apps/mobile/app/_layout.tsx](C:/coding/gwct/apps/mobile/app/_layout.tsx).
- Validation:
  - `npm.cmd --workspace @gwct/mobile run typecheck` ✅
  - `npm.cmd run typecheck` ✅
## Work Tab UI Polish Plan (2026-03-07)
- [x] Inspect the current Work tab header and ranking-card layout for the blue header mismatch and right-edge overflow.
- [x] Restyle the Work tab header to the light background, rename the requested labels, and compact the driver cards so date text stays inside the card.
- [x] Run mobile typecheck and document the review plus the correction pattern.

## Work Tab UI Polish Review
- Root cause:
  - The `Work` tab was still inheriting the default blue tab-header style, so the top area did not visually match the light page and kept the iPhone status-bar region on a darker surface.
  - The ranking cards placed two full datetime strings in the same horizontal row (`시작 감지` / `최근 감지`), which made the right-side timestamp push beyond the card width on real devices.
  - The card also carried secondary rows (`누적 분`, `중단사유`) that were not needed for the operator view and made the layout noisier than necessary.
- Fix:
  - Overrode only the `worktime` tab header in [apps/mobile/app/(tabs)/_layout.tsx](C:/coding/gwct/apps/mobile/app/(tabs)/_layout.tsx) so it now uses the same light background and dark title style as the settings tab.
  - Reworked the ranking cards in [apps/mobile/app/(tabs)/worktime.tsx](C:/coding/gwct/apps/mobile/app/(tabs)/worktime.tsx):
    - renamed `기사 누적 순위` to `YT 기사 일한 시간 순위`
    - changed rank labels from `#1` style to `1등`, `2등`, and the final row to `꼴등`
    - renamed `시작 감지` to `운전 시작`
    - renamed the old recent-detection slot to `운전 중지`
    - removed `누적 분` and `중단사유`
    - moved `운전 시작` and `운전 중지` into separate vertical blocks so long timestamps stay inside the card
    - kept only compact summary metadata (`YT`, `상태`, `세그먼트`) in the horizontal summary row
- Conservative assumption:
  - `운전 중지` now uses `lastWorkedAt` rather than `lastSeenAt`, because that matches the label semantics better and avoids showing an actively-updating detection timestamp as if it were a stop time.
  - If there is only one driver in the list, the card stays `1등` instead of trying to show both `1등` and `꼴등`.
- Validation:
  - `npm.cmd --workspace @gwct/mobile run typecheck` ✅
  - `npm.cmd run typecheck` ✅
## Work Tab Status Row Polish Plan (2026-03-07)
- [x] Inspect the current Work card summary rows for status label text, stop-reason placement, and segment ordering.
- [x] Update the Work cards so status is shown without a `상태` prefix, stop reason sits inline in red for non-active rows, and `세그먼트` moves to the last line.
- [x] Run mobile typecheck and record the review plus the correction pattern.

## Work Tab Status Row Polish Review
- Root cause:
  - The card summary row still rendered `상태 작업중` style text, which duplicated meaning the user already understood from the value itself.
  - `세그먼트` was mixed into the same upper metadata area even though it is lower-priority operational detail.
  - The previous layout had no clear inline slot for non-active-state stop reasons.
- Fix:
  - Updated [apps/mobile/app/(tabs)/worktime.tsx](C:/coding/gwct/apps/mobile/app/(tabs)/worktime.tsx) so the top summary row now shows:
    - `YT <번호>`
    - `작업중 / 중단 / 로그아웃` without an `상태` prefix
    - red inline stop reason only when the latest state is `중단` or `로그아웃` and a reason exists
  - Moved `세그먼트` to the last line of the card.
  - Kept `운전 시작` / `운전 중지` as separate vertical blocks so long timestamps still stay inside the card.
- Conservative assumption:
  - `로그아웃` 상태는 source 데이터상 stop reason이 없을 수 있으므로, 사유가 실제로 있을 때만 옆에 표시하고 없으면 상태값만 보여줍니다.
- Validation:
  - `npm.cmd --workspace @gwct/mobile run typecheck` ✅
  - `npm.cmd run typecheck` ✅
## Work Tab Rank/Segment Row Fix Plan (2026-03-07)
- [x] Inspect the current Work card header and summary row to correct the misunderstood rank/segment placement.
- [x] Move `세그먼트 N회` into the same summary line as `YT / 작업중|중단|로그아웃 / 중단사유` and enlarge the rank label beside the driver name.
- [x] Run mobile typecheck and record the review plus the correction lesson.

## Work Tab Rank/Segment Row Fix Review
- Root cause:
  - I misread the requested information hierarchy and moved `세그먼트` to a separate bottom line, even though the user explicitly wanted it to stay in the same compact metadata row as `YT 번호` and the current semantic state.
  - The rank label also remained visually secondary above the name, instead of reading as a strong inline rank marker next to the driver name.
- Fix:
  - Updated [apps/mobile/app/(tabs)/worktime.tsx](C:/coding/gwct/apps/mobile/app/(tabs)/worktime.tsx) so each card now shows:
    - driver name with a larger inline `1등 / 2등 / ... / 꼴등` label beside it
    - one wrapped metadata row in the user-requested order:
      - `YT <번호>`
      - `작업중 / 중단 / 로그아웃`
      - inline red `(<중단사유>)` when the state is non-active and a reason exists
      - `세그먼트 N회`
  - Removed the separate bottom `세그먼트` line.
- Validation:
  - `npm.cmd --workspace @gwct/mobile run typecheck` ✅
  - `npm.cmd run typecheck` ✅

## Work Tab Logout Stop-Reason Persistence Plan (2026-03-07)
- [x] Inspect the YT work-time accumulator and Work response to verify whether `logged_out` already preserves the last stop reason.
- [x] If logout currently clears it, persist the final stop reason through the work-time session response and keep it visible inline beside `로그아웃`.
- [x] Run relevant tests/typecheck and record the review plus the correction lesson.

## Work Tab Logout Stop-Reason Persistence Review
- Root cause:
  - The YT work-time accumulator in [service.ts](C:/coding/gwct/apps/server/src/services/ytWorkTime/service.ts) cleared `latestStopReason` whenever a named YT driver disappeared from the current snapshot and was downgraded to `logged_out`.
  - That meant a `중단 -> 완전 로그아웃` transition lost the final stop-reason trace, so the Work tab could not render `로그아웃 (<마지막 중단사유>)` even though the operator expected that final reason to remain visible.
- Fix:
  - Updated [service.ts](C:/coding/gwct/apps/server/src/services/ytWorkTime/service.ts) so:
    - when an active segment closes and the current named YT row no longer exists, `latestStopReason` falls back to the previously stored value instead of being nulled
    - when a driver is already absent from the named snapshot and remains `logged_out`, the accumulator now preserves the last observed stop reason instead of clearing it
  - The Work tab UI in [worktime.tsx](C:/coding/gwct/apps/mobile/app/(tabs)/worktime.tsx) already rendered `logged_out` reasons inline when present, so no mobile layout change was needed.
  - Added a regression test in [yt-work-time.test.ts](C:/coding/gwct/apps/server/tests/yt-work-time.test.ts) for `stopped("정비대기") -> logged_out` to prove the final stop reason survives logout.
- Validation:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/yt-work-time.test.ts` ✅
  - `npm.cmd --workspace @gwct/server run typecheck` ✅
  - `npm.cmd --workspace @gwct/mobile run typecheck` ✅

## Work Tab Stop-Time Visibility Plan (2026-03-07)
- [x] Inspect the current Work card `운전 중지` rendering and confirm whether a stale last stop time survives after the driver is active again.
- [x] Update the Work-tab display rules so previous stop times disappear once the driver is back to active with no current stop reason, while leaving segment accumulation unchanged.
- [x] Run mobile/root typecheck and record the review plus the correction lesson.

## Work Tab Stop-Time Visibility Review
- Root cause:
  - The Work card always rendered the `운전 중지` block from `lastWorkedAt` even after the driver had already started a new active segment.
  - That made the card continue to show an old stop timestamp while the current semantic state was already back to `작업중`, which is stale and visually misleading.
- Fix:
  - Updated [worktime.tsx](C:/coding/gwct/apps/mobile/app/(tabs)/worktime.tsx) so the `운전 중지` block is rendered only when the current driver state is inactive (`중단` or `로그아웃`).
  - The underlying accumulated session data, `lastWorkedAt`, and `세그먼트` branching logic were left unchanged; only the stale display rule was removed from the UI.
- Validation:
  - `npm.cmd --workspace @gwct/mobile run typecheck` ✅
  - `npm.cmd run typecheck` ✅

## Work Tab Logout Reason Recheck Plan (2026-03-07)
- [x] Inspect the current Work UI and persisted/server YT work-time state to verify whether `logged_out` still drops the final stop reason in practice.
- [x] If the reason is still being lost or old persisted state needs compatibility handling, implement the minimal fix at the correct layer.
- [x] Run focused verification and record the review plus the correction lesson.

## Work Tab Logout Reason Recheck Review
- Root cause:
  - The work-time accumulator in [service.ts](C:/coding/gwct/apps/server/src/services/ytWorkTime/service.ts) only matched current YT rows by `driverName`, so it could not see the real GWCT pattern where a YT row becomes `logged_out` with `driverName = null` but still retains a meaningful `stopReason`.
  - The latest equipment snapshot file already contained many such rows (`driverName=null + stopReason=...`), but the Work session state ignored them and kept `latestStopReason: null`, so the Work tab could not show `로그아웃 (<사유>)`.
  - Existing persisted work-session rows could also stay stale until another monitor-cycle observation updated them.
- Fix:
  - Added a `YT 번호 -> snapshot row` fallback map in [service.ts](C:/coding/gwct/apps/server/src/services/ytWorkTime/service.ts) so the work-time accumulator now:
    - still prefers `driverName` matching when available
    - but falls back to the tracked `YT 번호` when the current row is driverless and `logged_out`
    - preserves `stopReason` from that driverless logout row
  - Updated [api.ts](C:/coding/gwct/apps/server/src/routes/api.ts) so `GET /api/yt/work-time` first reapplies the latest equipment snapshot through `observeYtWorkSnapshot(...)` before materializing the response. That makes existing sessions pick up the missing logout reason on the next screen refresh instead of waiting for a future scrape cycle.
  - Added a regression test in [yt-work-time.test.ts](C:/coding/gwct/apps/server/tests/yt-work-time.test.ts) for `driverName=null, semanticState=logged_out, stopReason=...`.
- Validation:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/yt-work-time.test.ts` ✅
  - `npm.cmd --workspace @gwct/server run typecheck` ✅
  - `npm.cmd --workspace @gwct/mobile run typecheck` ✅
  - `npm.cmd run typecheck` ✅

## Work Tab Stop-Reason Plain Text Plan (2026-03-07)
- [x] Locate the current Work-tab inline reason rendering and confirm the parentheses are coming from the mobile UI.
- [x] Remove the parentheses so stopped/logged_out reasons render as plain red text after the state label.
- [x] Run mobile/workspace typecheck and record the review plus the correction lesson.

## Work Tab Stop-Reason Plain Text Review
- Root cause:
  - The Work card UI in [worktime.tsx](C:/coding/gwct/apps/mobile/app/(tabs)/worktime.tsx) was wrapping the inline stop reason with a literal `(${...})` string, so even though the layout and red emphasis were correct, the user still saw bracketed text.
- Fix:
  - Removed the literal parentheses from the inline reason render path.
  - Stopped/logged-out rows now render as `중단 사유텍스트` or `로그아웃 사유텍스트`, with the reason still colored red.
- Validation:
  - `npm.cmd --workspace @gwct/mobile run typecheck` ✅
  - `npm.cmd run typecheck` ✅

## YT Work-Time Segment Accumulation Audit Plan (2026-03-07)
- [x] Inspect the current YT work-time accumulator and existing tests against the required segment rules:
  - stop/logout closes the current segment immediately
  - same driver name relogin opens a new segment and keeps accumulating
  - same-YT driver handoff closes the old driver and starts the new driver separately
  - same driver relogin on a different YT still accumulates into the same driver total
- [x] If any backend path is missing or inaccurate, implement the minimal server-side fix and add deterministic regression tests for the exact scenarios.
- [x] Run focused server tests plus typecheck, then document the review and any fix.

## YT Work-Time Segment Accumulation Audit Review
- Audit result:
  - The core accumulation model in [service.ts](C:/coding/gwct/apps/server/src/services/ytWorkTime/service.ts) already matched the required backbone:
    - `active -> stopped/logged_out` closes the current segment immediately via `closeSegment(...)`
    - the worked duration is added to `totalWorkedMs`
    - the next time the same normalized `driverName` appears as `active`, a new `currentSegmentStartedAt` opens and accumulation resumes on top of the old total
    - this works even if the driver comes back on a different `YT 번호`, because the active-unit lookup is keyed by normalized driver name
- Problem found:
  - The recent fix for `driverName=null + logged_out + stopReason` added a `YT 번호` fallback, but it was broad enough that a same-YT driver handoff could let the previous driver's record read the new driver's active row.
  - That would make `같은 YT 교대` ambiguous in the accumulator, which conflicts with the user's required behavior of:
    - old driver segment closes
    - new driver starts as a separate person
- Fix:
  - Tightened the fallback in [service.ts](C:/coding/gwct/apps/server/src/services/ytWorkTime/service.ts) so the `YT 번호` fallback is only used for driverless rows.
  - That preserves the needed `logged_out + stopReason` recovery path, while preventing a new active driver on the same YT from being mistaken for the old driver's current state.
  - Added deterministic regression tests in [yt-work-time.test.ts](C:/coding/gwct/apps/server/tests/yt-work-time.test.ts):
    - same driver relogin on a different YT keeps accumulating into one driver total
    - same-YT handoff closes the previous driver and starts the new driver separately
- Validation:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/yt-work-time.test.ts` ✅
  - `npm.cmd --workspace @gwct/server run typecheck` ✅
  - `npm.cmd run typecheck` ✅

## YT Work-Time Precision Verification Plan (2026-03-07)
- [x] Inspect the YT work-time accumulator and response schema to determine whether the backend stores milliseconds/seconds or only whole minutes.
- [x] Run a focused execution check to verify whether elapsed work shorter than one minute is still preserved in the accumulated value.
- [x] Record the verification result clearly, including whether the current UI exposes seconds or only rounded minutes.

## YT Work-Time Precision Verification Review
- Verification result:
  - The backend accumulator already stores work duration in milliseconds, not just whole minutes.
  - Evidence in [service.ts](C:/coding/gwct/apps/server/src/services/ytWorkTime/service.ts):
    - `effectiveWorkedMs(...)` computes raw `Date.getTime()` differences in milliseconds
    - `closeSegment(...)` adds that raw value into `totalWorkedMs`
    - `YTWorkDriverSummary` exposes both `totalWorkedMs` and `totalWorkedMinutes`
  - Evidence in [domain.ts](C:/coding/gwct/packages/shared/src/schemas/domain.ts):
    - `totalWorkedMs`
    - `totalWorkedMinutes`
    - `totalWorkedLabel`
- Focused execution check:
  - Ran an inline `tsx` verification against the real accumulator:
    - after `45.500초` of live time:
      - `totalWorkedMs = 45500`
      - `totalWorkedMinutes = 0`
      - `totalWorkedLabel = "0시간 0분"`
    - after stopping at `65.432초`:
      - `totalWorkedMs = 65432`
      - `totalWorkedMinutes = 1`
      - `totalWorkedLabel = "0시간 1분"`
- Conclusion:
  - 초단위 누적 자체는 이미 되고 있습니다. 정확히는 밀리초 단위로 저장됩니다.
  - 다만 현재 앱 UI는 [worktime.tsx](C:/coding/gwct/apps/mobile/app/(tabs)/worktime.tsx)에서 `driver.totalWorkedLabel`만 사용하므로, 화면에는 분 단위로만 보입니다.
  - 즉:
    - 누적 정밀도: `ms` 수준으로 이미 구현됨
    - 현재 표시 정밀도: `분` 수준

## Vessel ETA Change Verification Plan (2026-03-07)
- [x] Inspect the current server/shared/mobile code paths for `gwct_eta_changed` to verify that ETA earlier/later changes generate the intended event payload and UI display.
- [x] Run focused ETA-related tests to confirm the implementation is active without modifying code.
- [x] Record the verification result, including what is implemented on the server and what is shown in the Vessel Schedule screen.

## Vessel ETA Change Verification Review
- Verification result:
  - Yes. The repo is currently implemented so that meaningful ETA changes trigger a dedicated `gwct_eta_changed` event, and the Vessel Schedule screen shows that change directly under the affected vessel row.
- Server event generation:
  - [diff.ts](C:/coding/gwct/apps/server/src/engine/diff.ts)
    - compares normalized ETA values only
    - skips when previous and current ETA are semantically identical
    - skips when either side is missing
    - emits `gwct_eta_changed` with:
      - `previousEta`
      - `currentEta`
      - `deltaMinutes`
      - `direction`
      - `crossedDate`
      - `humanMessage`
  - The human message text comes from [eta.ts](C:/coding/gwct/packages/shared/src/events/eta.ts), which formats:
    - same-day earlier: `종전보다 X시간 Y분 더 일찍 입항 예정입니다.`
    - same-day later: `종전보다 X시간 Y분 더 늦게 입항 예정입니다.`
    - crossed date later: `내일로 ... 더 늦게 입항 예정입니다.` and more general relative-day wording
- Mobile Vessel Schedule display:
  - [vessels.tsx](C:/coding/gwct/apps/mobile/app/vessels.tsx)
    - renders `ETA` / `ETD`
    - if `latestEtaChange` exists, shows the ETA-change message under the vessel card
    - colors it by direction:
      - `earlier` = red tone
      - `later` = blue tone
  - [liveRows.ts](C:/coding/gwct/apps/server/src/services/vessels/liveRows.ts)
    - attaches the latest `gwct_eta_changed` alert to the matching vessel row
    - formats previous/current ETA display strings for the UI
- Focused verification:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/gwct-eta-monitor.test.ts tests/vessels-live-rows.test.ts tests/schedule-focus.test.ts` ✅
  - `npm.cmd --workspace @gwct/server run typecheck` ✅
- What those tests prove:
  - [gwct-eta-monitor.test.ts](C:/coding/gwct/apps/server/tests/gwct-eta-monitor.test.ts)
    - same-day later -> event emitted with `direction=later`
    - same-day earlier -> event emitted with `direction=earlier`
    - next-day rollover -> event emitted with `crossedDate=true` and `내일로 ...` message
    - identical normalized ETA -> no event
  - [schedule-focus.test.ts](C:/coding/gwct/apps/server/tests/schedule-focus.test.ts)
    - only ETA changes for the same voyage emit `gwct_eta_changed`
  - [vessels-live-rows.test.ts](C:/coding/gwct/apps/server/tests/vessels-live-rows.test.ts)
    - Vessel Schedule rows receive the latest ETA change payload and renderable previous/current ETA display values

## ETA Adjustment Count Plan (2026-03-07)
- [x] Inspect the current ETA change event pipeline, alert history storage, and Vessel Schedule UI wiring to find the cleanest place to carry an adjustment count.
- [x] Implement the minimal server/shared/mobile changes so the first ETA change keeps the plain message, while the 2nd+ changes append `N번째 ETA 조정` and keep comparing against the most recently confirmed ETA.
- [x] Run focused ETA tests/typecheck and document the review plus any new lesson.
## ETA Adjustment Count Review
- Root cause:
  - ETA change detection already compared the current scrape against the immediately previous ETA snapshot, so delta calculation was correct.
  - What was missing was persistent adjustment ordinal metadata. Every ETA change message stayed in the base form, so 2nd/3rd/later ETA changes were indistinguishable in alerts and Vessel Schedule UI.
- Implementation:
  - Added shared helper in [eta.ts](C:/coding/gwct/packages/shared/src/events/eta.ts) to append `N번째 ETA 조정` only from the 2nd change onward, while keeping the base ETA delta message intact.
  - Extended [domain.ts](C:/coding/gwct/packages/shared/src/schemas/domain.ts) so `gwct_eta_changed` payload can carry `adjustmentCount`.
  - Added [countGwctEtaAdjustments()](C:/coding/gwct/apps/server/src/db/repository.ts) to count prior ETA-change events per `vesselKey` from persisted vessel change history.
  - Updated [monitorService.ts](C:/coding/gwct/apps/server/src/services/monitorService.ts) so each newly emitted `gwct_eta_changed` event is decorated before persistence/notification:
    - first change keeps the original message
    - 2nd+ changes become `... 예정입니다. 2번째 ETA 조정`, `... 3번째 ETA 조정`, etc.
  - Updated [liveRows.ts](C:/coding/gwct/apps/server/src/services/vessels/liveRows.ts) so Vessel Schedule rows expose `adjustmentCount` and keep rendering the ordinal suffix even for older alerts that predate the payload field, using recent alert history as a fallback.
  - Updated [vessels.tsx](C:/coding/gwct/apps/mobile/app/vessels.tsx) response typing to match the new `adjustmentCount` field.
- Focused verification:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/gwct-eta-monitor.test.ts tests/vessels-live-rows.test.ts tests/monitor-service-eta-adjustment.test.ts tests/schedule-focus.test.ts` ✅
  - `npm.cmd run typecheck` ✅
- Added regression coverage:
  - [monitor-service-eta-adjustment.test.ts](C:/coding/gwct/apps/server/tests/monitor-service-eta-adjustment.test.ts): verifies 2nd/3rd ETA changes are decorated with the correct ordinal suffix and first change stays plain.
  - [vessels-live-rows.test.ts](C:/coding/gwct/apps/server/tests/vessels-live-rows.test.ts): verifies Vessel Schedule rows surface `2번째 ETA 조정` from ETA change history.
- Result:
  - First ETA change: base message only.
  - Second and later ETA changes: base message plus inline `N번째 ETA 조정`.
  - Delta calculation remains against the most recently confirmed ETA because the compare logic still diffs previous snapshot vs current snapshot.

## ETA Adjustment Persistence Plan (2026-03-07)
- [x] Inspect the current event-clear path and ETA message source to identify every coupling between Event history and Vessel Schedule ETA adjustment display.
- [x] Implement a dedicated ETA adjustment state store that survives event-log clearing, wire server emission/live rows to it, and exclude it from event-clear behavior.
- [x] Run focused tests/typecheck, add regression coverage for clear-events behavior, and document the review.

## ETA Adjustment Persistence Review
- Root cause:
  - The visible ETA message under Vessel Schedule rows still depended on event-history-backed sources.
  - `DELETE /api/events` clears `alertEvent` and related event tables, so `N번째 ETA 조정` and the last displayed ETA message could disappear even though ETA compare logic itself still worked.
- Implementation:
  - Added dedicated ETA-adjustment state storage in [etaAdjustmentStore.ts](C:/coding/gwct/apps/server/src/services/vessels/etaAdjustmentStore.ts) under `apps/server/data/config`.
  - Updated [monitorService.ts](C:/coding/gwct/apps/server/src/services/monitorService.ts) to persist each emitted `gwct_eta_changed` event into that dedicated store after the event row is created.
  - Updated [liveRows.ts](C:/coding/gwct/apps/server/src/services/vessels/liveRows.ts) so Vessel Schedule rows prefer the dedicated ETA-adjustment store and only fall back to recent alerts if the store has no record yet.
  - Updated [api.ts](C:/coding/gwct/apps/server/src/routes/api.ts) so `/api/vessels/live` loads ETA-adjustment state directly instead of relying only on event history.
  - `DELETE /api/events` was intentionally left unchanged, so event-history clearing does not touch the dedicated ETA-adjustment store.
- Focused verification:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/gwct-eta-monitor.test.ts tests/vessels-live-rows.test.ts tests/monitor-service-eta-adjustment.test.ts tests/schedule-focus.test.ts tests/events-clear-api.test.ts` ✅
  - `npm.cmd run typecheck` ✅
- Added regression coverage:
  - [events-clear-api.test.ts](C:/coding/gwct/apps/server/tests/events-clear-api.test.ts): verifies `/api/vessels/live` still returns the persisted ETA message and `adjustmentCount` after `DELETE /api/events`.
- Result:
  - Event log clear and Vessel Schedule ETA adjustment display are now separated.
  - `종전보다 ...` message, `N번째 ETA 조정`, and the latest ETA delta context remain available after clearing the Events history.
## Events Header Tone Plan (2026-03-07)
- [ ] Inspect the tab header options for the Events screen and identify where its header colors diverge from the light background pattern.
- [ ] Update only the Events tab header styling so the title and iPhone status indicators stay readable on the light page background.
- [ ] Run mobile typecheck and record the result.
## Events Header Tone Review
- Implementation:
  - Updated [apps/mobile/app/(tabs)/_layout.tsx](C:/coding/gwct/apps/mobile/app/(tabs)/_layout.tsx) so the hidden `alerts` tab uses the same light header override pattern as `Work` and `Settings`.
  - Header background now follows `colors.screenBackground`, title tint follows `colors.primaryText`, and header shadow is removed.
- Result:
  - The `Events` screen no longer uses the dark blue top bar.
  - The page header blends into the light background and keeps the iPhone status-bar glyphs readable in dark text.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck` ✅
## Events Tone Balance Plan (2026-03-07)
- [ ] Inspect the Events screen background, card/button tones, and current tab-header override to identify the smallest change that reduces the visible boundary.
- [ ] Adjust the Events header/body palette so the transition matches the rest of the app more closely without affecting other tabs.
- [ ] Run mobile typecheck and record the review plus the UI lesson.
## Events Tone Balance Review
- Root cause:
  - The `alerts` header was switched to the light tab-header palette, but [alerts.tsx](C:/coding/gwct/apps/mobile/app/(tabs)/alerts.tsx) still used hard-coded blue-tinted background and card colors.
  - That created a visible seam between the light header and the cooler body background.
- Implementation:
  - Updated [alerts.tsx](C:/coding/gwct/apps/mobile/app/(tabs)/alerts.tsx) to use [useAppPreferences()](C:/coding/gwct/apps/mobile/lib/appPreferences.tsx) and the shared app palette.
  - `screen`, filter chips, cards, and text tones now follow the same light-theme colors used by the other home/session screens.
  - Kept the destructive clear button red so the action remains obvious.
- Result:
  - The `Events` header and the body now sit in the same light-tone family.
  - The boundary under the header is reduced without changing the actual Events functionality.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck` ✅
## Work Copy Cleanup Plan (2026-03-07)
- [ ] Find the Work screen helper copy that contains the quoted comma after `시작하면`.
- [ ] Remove only that punctuation so the sentence reads naturally, without changing the surrounding behavior or layout.
- [ ] Run mobile typecheck and record the review.
## Work Copy Cleanup Review
- Implementation:
  - Removed the comma after `시작하면` in [worktime.tsx](C:/coding/gwct/apps/mobile/app/(tabs)/worktime.tsx).
- Result:
  - The Work helper sentence now reads more naturally without the extra punctuation.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck` ✅
## Monitoring Copy Cleanup Plan (2026-03-07)
- [ ] Find the Monitoring Menu helper copy that still wraps Confirm/Cancel in quotes.
- [ ] Remove only the quote characters so the sentence reads cleanly without changing layout or behavior.
- [ ] Run mobile typecheck and record the review.
## Monitoring Copy Cleanup Review
- Implementation:
  - Removed the quote/backtick characters around `Confirm` and `Cancel` in [monitor.tsx](C:/coding/gwct/apps/mobile/app/monitor.tsx).
- Result:
  - The Monitoring Menu helper sentence now reads as plain `Confirm` / `Cancel` text without decorative punctuation.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck` ✅
## Monitoring Comma Cleanup Review
- Implementation:
  - Removed the comma after `저장/활성화` in [monitor.tsx](C:/coding/gwct/apps/mobile/app/monitor.tsx).
- Result:
  - The Monitoring helper sentence now reads without the extra punctuation.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck` ✅
## Work Ranking Precision Verification Plan (2026-03-07)
- [ ] Inspect the YT work-time backend session view and the Work screen rendering to identify the exact ranking key.
- [ ] Run a focused verification using existing tests or a direct check to confirm whether ranking uses millisecond precision even when the UI shows only minutes.
- [ ] Record the verification result and report the exact behavior without changing code.
## Work Ranking Precision Verification Review
- Verification result:
  - Yes. Work ranking is determined by the backend's millisecond-level accumulated duration, not by the minute-only label shown in the UI.
- Evidence in backend:
  - [service.ts](C:/coding/gwct/apps/server/src/services/ytWorkTime/service.ts)
    - `buildDriverSummary(...)` computes `totalWorkedMs` first.
    - `totalWorkedMinutes` and `totalWorkedLabel` are derived display fields.
    - `materializeYtWorkSession(...)` sorts drivers by `right.totalWorkedMs - left.totalWorkedMs` before returning the list.
  - [worktime.tsx](C:/coding/gwct/apps/mobile/app/(tabs)/worktime.tsx)
    - The Work screen renders `session.drivers` as returned by the backend.
    - It does not re-sort the list on the client.
- Direct execution check:
  - Ran a focused `tsx` check with two drivers whose displayed label is identical (`0시간 1분`) but whose accumulated work differs by 1000ms.
  - Result:
    - `AAA = 70500ms -> 0시간 1분`
    - `BBB = 69500ms -> 0시간 1분`
    - The returned order was `AAA`, then `BBB`.
  - This proves the ranking can differ even when the visible minute label is the same.
- Focused test:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/yt-work-time.test.ts` ✅
- Conclusion:
  - Your understanding is correct.
  - The displayed label is coarse (`분`), but the ranking is based on finer backend timing (`ms`), so a 1-second difference can separate 1등 and 2등.
## Work Stop-Reason Count Plan (2026-03-07)
- [x] Inspect the current YT work-time state/store, shared response schema, and Work UI to find the cleanest place to accumulate stop-reason keyword counters.
- [x] Implement backend keyword-count accumulation for `오바`, `캐빈 셔틀`, and `본선작업`, expose it in the Work session response, and render the compact counts beside 운전 시작 in the Work UI.
- [x] Add focused regression tests for repeated stop-reason counting, run relevant tests/typecheck, and document the review.

## Work Stop-Reason Count Review
- Root cause:
  - Work 세션은 `latestStopReason`만 보여주고 있었고, 특정 작업 중단 패턴(`오바`, `캐빈 셔틀`, `본선작업`)이 몇 번째 누적인지는 별도 상태로 관리하지 않았습니다.
- Implementation:
  - Added shared response typing in [domain.ts](C:/coding/gwct/packages/shared/src/schemas/domain.ts) so each Work driver can return `stopReasonCounters`.
  - Updated [service.ts](C:/coding/gwct/apps/server/src/services/ytWorkTime/service.ts) to track three keyword buckets per driver:
    - `오바` -> `오바하이`
    - `캐빈 셔틀` -> `캐빈셔틀`
    - `본선작업` -> `본선작업요청중단`
  - The accumulator stores per-driver counters in the persisted Work session state and only increments when a newly observed inactive stop-reason signature appears, so the same stopped/logged_out snapshot does not re-count on every scrape.
  - Updated [worktime.tsx](C:/coding/gwct/apps/mobile/app/(tabs)/worktime.tsx) to render the compact `오바하이 1회`, `캐빈셔틀 1회`, `본선작업요청중단 1회` summary in the 운전 시작 block.
- Focused verification:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/yt-work-time.test.ts` ✅
  - `npm.cmd run typecheck` ✅
- Added regression coverage:
  - [yt-work-time.test.ts](C:/coding/gwct/apps/server/tests/yt-work-time.test.ts) now verifies:
    - repeated `오바` interruptions count as `2회` across separate inactive episodes
    - repeated scrape of the same stopped reason does not double-count
    - `캐빈 셔틀` and `본선작업` counters are independently accumulated and exposed in the Work session view
## Work Time Adjustment Plan (2026-03-07)
- [x] Inspect the current Work session counters and ranking path to identify where to add positive/negative time adjustments without breaking persisted sessions.
- [x] Implement stop-reason adjustment rules (`오바하이` +35분, `화장실` -15분, keep other counters), apply them to Work ranking/labels, and expose/render the adjusted totals plus signed adjustment information in the Work UI.
- [x] Add regression tests for repeated adjustment counts and rank ordering, run focused tests/typecheck, and document the review.

## Work Time Adjustment Review
- Root cause:
  - Work 세션은 `오바하이`, `캐빈셔틀`, `본선작업요청중단` 카운트를 누적만 하고 있었고, 실제 순위 정렬과 누적 시간 표시는 원래의 `totalWorkedMs`만 기준으로 삼고 있었습니다.
  - 그래서 `오바하이` 가산 시간과 `화장실` 차감 시간을 순위와 화면에 반영할 경로가 없었습니다.
- Implementation:
  - Added `restroom` to [domain.ts](C:/coding/gwct/packages/shared/src/schemas/domain.ts) and extended the Work driver summary with `adjustedWorkedMs`, `adjustedWorkedMinutes`, `adjustedWorkedLabel`, `adjustmentDeltaMs`, `adjustmentDeltaMinutes`, and `adjustmentDeltaLabel`.
  - Updated [service.ts](C:/coding/gwct/apps/server/src/services/ytWorkTime/service.ts) so tracked stop-reason rules now carry signed minute adjustments:
    - `오바하이` = `+35분`
    - `화장실` = `-15분`
    - `캐빈셔틀`, `본선작업요청중단` = `0분`
  - The persisted Work session still accumulates raw worked time in milliseconds, then derives an adjusted total for ranking and UI display. Ranking now sorts by `adjustedWorkedMs`.
  - Stop-reason counters still increment only when a new inactive episode is observed, so repeated scrape of the same stopped/logged_out snapshot does not over-count. This keeps `2회`, `3회` ... aligned with real repeated interruptions after relogin/restart.
  - Updated [worktime.tsx](C:/coding/gwct/apps/mobile/app/(tabs)/worktime.tsx) to show the signed adjustment value before the adjusted total, making `+` / `-` visible in the Work ranking cards.
- Verification:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/yt-work-time.test.ts` ✅
  - `npm.cmd run typecheck` ✅
- Added regression coverage:
  - [yt-work-time.test.ts](C:/coding/gwct/apps/server/tests/yt-work-time.test.ts) now verifies:
    - `오바` repeated across separate inactive episodes accumulates correctly
    - `화장실` is counted and subtracts `15분`
    - rank ordering follows `adjustedWorkedMs`, not the raw worked time
## YT Logged-Out Cabin Preserve Plan (2026-03-07)
- [x] Inspect the YT live snapshot build path and YT Count screen to confirm why `logged_out` rows drop the last driver name.
- [x] Implement a minimal latest-snapshot merge so `logged_out` YT rows keep the last known driver name in `Cabin` without disturbing raw diff semantics.
- [x] Add regression coverage, run focused tests/typecheck, and document the review.

## YT Logged-Out Cabin Preserve Review
- Root cause:
  - `YT Count` 화면은 [loadEquipmentLatestSnapshot](C:/coding/gwct/apps/server/src/services/equipment/latestStore.ts)로 저장된 latest snapshot의 `ytUnits`를 그대로 읽고 있었습니다.
  - 그런데 latest snapshot 생성 시 [buildYtUnitSnapshotFromEquipment](C:/coding/gwct/apps/server/src/services/equipment/ytUnits.ts)가 현재 scrape의 raw row만 보고 `logged_out` 행의 `driverName`을 `null`로 저장하고 있었고, 이전에 누가 마지막으로 운전했는지는 carry-forward하지 않았습니다.
- Implementation:
  - Extended [buildYtUnitSnapshotFromEquipment](C:/coding/gwct/apps/server/src/services/equipment/ytUnits.ts) with an optional `previousUnits` input and a logged-out merge step.
  - If the current YT row is `logged_out` and its current `driverName` is empty, the builder now copies the last known driver name from the previous snapshot for the same `YT 번호`.
  - Updated [monitorService.ts](C:/coding/gwct/apps/server/src/services/monitorService.ts) so `persistEquipmentLatestSnapshot(...)` loads the previous latest snapshot and passes its `ytUnits` into the builder before saving the new latest snapshot.
  - Raw diff/event semantics remain unchanged because diff detection still calls the builder without a previous snapshot, so this carry-forward applies only to the UI-facing latest snapshot.
- Verification:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/equipment-focus.test.ts tests/yt-monitor.test.ts` ✅
  - `npm.cmd run typecheck` ✅
- Added regression coverage:
  - [equipment-focus.test.ts](C:/coding/gwct/apps/server/tests/equipment-focus.test.ts) now verifies that a current `logged_out` YT row with no driver name still exposes the previous driver's name as `Cabin` in the latest snapshot path.
## YT Count Label + Logout Timestamp Plan (2026-03-07)
- [x] Inspect the YT Count snapshot schema, API, and mobile UI to confirm where the active label and login/logout timestamp row are sourced from.
- [x] Implement a minimal server/mobile change so active rows show `운전중`, and logged_out rows preserve/display `로그아웃: MM-DD HH:mm` until the same YT becomes active again.
- [x] Add regression coverage, run focused tests/typecheck, and document the review.

## YT Count Label + Logout Timestamp Review
- Root cause:
  - The `YT Count` screen in [yt.tsx](C:/coding/gwct/apps/mobile/app/yt.tsx) rendered the active badge as `운영`, and always used the third row as `로그인: ...` based on `unit.loginTime`.
  - The server latest snapshot path did not store a dedicated logout timestamp, so a `logged_out` row had no stable time to show on the UI.
- Implementation:
  - Extended [domain.ts](C:/coding/gwct/packages/shared/src/schemas/domain.ts) so `YTUnitSnapshot` can carry optional `logoutTime`.
  - Updated [ytUnits.ts](C:/coding/gwct/apps/server/src/services/equipment/ytUnits.ts):
    - `active` label semantics remain unchanged in the raw state machine.
    - Added latest-snapshot-only merge logic so a `logged_out` YT row can retain the previous driver name and record the first logout timestamp (`capturedAt`) for that inactive run.
    - Repeated `logged_out` scrapes keep the original `logoutTime` instead of overwriting it every poll.
    - When the same YT becomes active again, `logoutTime` resets to `null`.
  - Updated [monitorService.ts](C:/coding/gwct/apps/server/src/services/monitorService.ts) to pass `capturedAt` and previous latest `ytUnits` into the snapshot builder before persisting the new latest snapshot.
  - Updated [yt.tsx](C:/coding/gwct/apps/mobile/app/yt.tsx):
    - `active` badge text now renders as `운전중`
    - Third row dynamically switches between `로그인: ...` and `로그아웃: ...`
    - `logged_out` rows format the stored ISO logout timestamp as `MM-DD HH:mm`
- Verification:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/equipment-focus.test.ts tests/yt-monitor.test.ts` ✅
  - `npm.cmd run typecheck` ✅
- Added regression coverage:
  - [equipment-focus.test.ts](C:/coding/gwct/apps/server/tests/equipment-focus.test.ts) now verifies:
    - the first `logged_out` observation records `logoutTime`
    - repeated `logged_out` scrapes preserve the original recorded time
    - re-activation clears `logoutTime`
## YT Relogin Message Correction Plan (2026-03-07)
- [x] Inspect the current YT transition rules for `logged_out -> active`, same-YT driver changes, and any company-prefix handling.
- [x] Implement minimal transition logic so `다시 로그인` applies only to the same YT+same driver, while different-driver returns become `로그인`, `교대`, or `주야 교대` based on the last known driver and two-letter company prefix.
- [x] Add focused regression tests, run verification/typecheck, and document the review.

## YT Relogin Message Correction Review
- Root cause:
  - [diff.ts](C:/coding/gwct/apps/server/src/engine/diff.ts) was treating every `logged_out -> active` transition as `다시 로그인`.
  - That logic only looked at the YT state transition and YT number, not the last known driver identity, so day/night handoff and same-YT driver swaps were mislabeled as relogin.
  - The existing `교대` detection only covered rows where both `before.driverName` and `after.driverName` were present in the same compare cycle. It did not recover the previous driver name across an intermediate `logged_out` row.
- Implementation:
  - Extended [domain.ts](C:/coding/gwct/packages/shared/src/schemas/domain.ts) with a new `shift_handoff` YT transition kind.
  - Updated [monitorService.ts](C:/coding/gwct/apps/server/src/services/monitorService.ts) so YT unit alert detection receives the previous latest YT snapshot and the current merged YT snapshot, preserving the last known driver across `logged_out` rows for transition comparison.
  - Updated [diff.ts](C:/coding/gwct/apps/server/src/engine/diff.ts) to classify `logged_out -> active` like this:
    - same YT + same driver => `다시 로그인`
    - same YT + different driver + same two-letter company prefix => `교대`
    - same YT + different driver + different two-letter company prefix => `주야 교대`
    - previous driver unavailable => plain `로그인`
  - Direct same-YT driver swaps without an intermediate logout now also become `주야 교대` when the company prefix changes.
- Verification:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/yt-monitor.test.ts tests/equipment-focus.test.ts` ✅
  - `npm.cmd run typecheck` ✅
- Added regression coverage:
  - [yt-monitor.test.ts](C:/coding/gwct/apps/server/tests/yt-monitor.test.ts) now verifies:
    - same-driver return after logout => `다시 로그인`
    - different same-company driver after logout => `교대`
    - different-company driver after logout => `주야 교대`
    - missing previous driver identity => plain `로그인`
    - direct same-YT different-company swap => `주야 교대`
## Work Shift Window Correction Plan (2026-03-07)
- [x] Inspect the current Work shift-window calculation and Shift Start helper text for the existing 07:00/19:00 boundaries.
- [x] Update the server-side Work session window to `06:45~18:45` for day and `18:45~06:45` for night, and align the Work UI helper text with the same rule.
- [x] Adjust focused regression tests, run verification/typecheck, and document the correction.

## Work Shift Window Correction Review
- Root cause:
  - The Work session service still hardcoded `07:00~19:00` and `19:00~07:00` as the valid start windows.
  - The Work screen helper copy in [worktime.tsx](C:/coding/gwct/apps/mobile/app/(tabs)/worktime.tsx) showed the same outdated times.
- Implementation:
  - Updated [service.ts](C:/coding/gwct/apps/server/src/services/ytWorkTime/service.ts) to centralize the shift boundaries as constants:
    - day: `06:45~18:45`
    - night: `18:45~06:45`
  - `buildShiftWindow(...)` now uses those new boundaries for:
    - start validation
    - shift window start time
    - shift completion time
    - error messages
  - Updated the Work screen helper text in [worktime.tsx](C:/coding/gwct/apps/mobile/app/(tabs)/worktime.tsx) to display the same new time windows under `Shift Start`.
- Verification:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/yt-work-time.test.ts` ✅
  - `npm.cmd run typecheck` ✅
- Regression coverage updated:
  - [yt-work-time.test.ts](C:/coding/gwct/apps/server/tests/yt-work-time.test.ts)
    - night shift completion now expects `06:45 KST` end (`2026-03-07T21:45:00.000Z`)
    - worked duration changed from `390분` to `375분`
    - validation errors now expect `06:45~18:45` and `18:45~06:45`

## GC Multi-Vessel Assignment Plan (2026-03-07)
- [x] Reconfirm the current GC multi-vessel data path and append this implementation/review block before coding.
- [x] Add a persisted GC assignment state store with latest-DB backfill support so active vessel evidence survives restart and event clears.
- [x] Update server GC work-state resolution to use assignment evidence for `active`, `checking`, and `scheduled` rows.
- [x] Update mobile Crane Status UI for the new `작업유무 체크중` state and sort priority.
- [x] Add focused regression/API tests for assignment persistence, backfill, and row classification.
- [x] Run server/mobile verification plus a live/manual GC184 check, then write the review here.

## GC Multi-Vessel Assignment Review
- Root cause:
  - `buildGcCraneLiveRows()` was classifying each same-GC row independently from `remainingSubtotal + crew assigned`, so one GC with two positive vessel rows could render both as `작업중`.
  - That ignored the only reliable live evidence for "which vessel is actually being worked now": per-vessel subtotal decreases across successive `gwct_work_status` snapshots.
- Implementation:
  - Added persisted GC assignment state store:
    - `apps/server/src/services/gc/assignmentStore.ts`
    - stores `activeVesselName`, `pendingVesselNames`, `lastEvidenceAt`, `lastSeenAt` per GC181~190
    - survives restart and `DELETE /api/events`
  - Added repository snapshot-group reader:
    - `apps/server/src/db/repository.ts`
    - reads recent `gwct_work_status` seenAt groups for backfill
  - Wired assignment updates into live scrape flow:
    - `apps/server/src/services/monitorService.ts`
    - after each `gwct_work_status` save, compares previous/current rows and updates persisted assignment state
  - Refined backfill after live validation:
    - initial `latest 2 groups` idea was not sufficient for the current GC184 history because the most recent 2 groups were unchanged
    - `ensureGcAssignmentState(...)` now scans multiple recent snapshot groups in order and replays them to recover the last proven active vessel when possible
  - Updated crane live row resolution:
    - `apps/server/src/services/gc/workState.ts`
    - same-GC multi-vessel rows now resolve as:
      - proven vessel => `active`
      - unresolved multi-vessel => `checking`
      - pending/non-active vessel => `scheduled`
      - no remaining => `idle`
  - Updated `/api/cranes/live`:
    - `apps/server/src/routes/api.ts`
    - loads ensured assignment state before building rows
  - Updated mobile Crane Status UI:
    - `apps/mobile/app/cranes.tsx`
    - added `checking` state label `작업유무 체크중`
    - added neutral badge style
    - sort order now `active -> checking -> scheduled -> idle`
- Tests added/updated:
  - `apps/server/tests/gc-work-state.test.ts`
  - `apps/server/tests/gc-assignment-store.test.ts`
  - `apps/server/tests/crane-live-api.test.ts`
- Verification:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/gc-work-state.test.ts tests/gc-assignment-store.test.ts tests/crane-live-api.test.ts` ✅
  - `npm.cmd run typecheck` ✅
  - `npm.cmd test` ✅
  - Note: mobile workspace still has no UI test suite (`mobile tests not configured`)
- Live/manual check:
  - Cleared persisted GC assignment state and forced backfill from the current local DB history.
  - Result for `GC184`:
    - `MAERSK SALTORO` => `active`
    - `CMA CGM CORTE REAL` => `scheduled`
  - Backfilled state recovered:
    - `activeVesselName = MAERSK SALTORO`
    - `pendingVesselNames = [CMA CGM CORTE REAL]`

## Work Always-On Shift Count Plan (2026-03-08)
- [x] Reconfirm the current Work session storage, monitor loop integration point, and remove the no-longer-wanted control-surface work from the prior implementation.
- [x] Refactor backend Work accumulation to be always-on by current shift window (`06:45~18:45`, `18:45~06:45`) with fixed lunch/midnight break exclusions.
- [x] Remove manual/automation Work endpoints and any persisted automation state no longer needed.
- [x] Simplify the mobile `Work` screen so it only presents current automatic shift info and the existing ranking cards.
- [x] Update focused service/API regression coverage, run verification, and document the revised review.

## Work Always-On Shift Count Review
- Root cause:
  - The user no longer wanted any `Work` controls. The previous implementation had introduced manual/auto configuration surface, extra state, and extra endpoints that no longer matched the actual product intent.
- Implementation:
  - Simplified `apps/server/src/services/ytWorkTime/service.ts` to a single always-on reconcile path:
    - `reconcileYtWorkSnapshotState(...)` now derives the current shift from each `gwct_equipment_status` snapshot time
    - if the stored session already matches the current shift, it continues accumulating
    - if the shift boundary has passed, the next snapshot automatically rolls the stored session into the new shift
    - lunch `12:00~13:00` and midnight `00:00~01:00` breaks remain excluded through the existing effective-worked-time calculation
    - stale older snapshots are ignored so they do not overwrite a newer session
  - Removed the discarded control/config surface:
    - deleted `apps/server/src/services/ytWorkTime/automationStore.ts`
    - removed Work automation types from `packages/shared/src/schemas/domain.ts`
    - removed `POST /api/yt/work-time/start`
    - removed `POST /api/yt/work-time/automation`
    - removed unused mobile API config entries for those POST routes
  - Simplified `apps/mobile/app/(tabs)/worktime.tsx`:
    - removed `Shift Start`, `Auto Count`, pills, tiles, alerts, and related busy state
    - kept the ranking cards intact
    - kept only passive auto-shift summary text and current shift/session metadata
- Tests added/updated:
  - `apps/server/tests/yt-work-time.test.ts`
    - current shift auto-start from first snapshot
    - automatic rollover at day/night boundary
    - stale older snapshot ignore rule
  - `apps/server/tests/yt-work-time-api.test.ts`
    - `GET /api/yt/work-time` auto-creates the current shift session from latest snapshot
    - old `start` / `automation` POST routes are absent (`404`)
- Verification:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/yt-work-time.test.ts tests/yt-work-time-api.test.ts` ✅
  - `npm.cmd run typecheck` ✅
  - `npm.cmd test` ✅
  - Note: mobile workspace still has no UI test suite (`mobile tests not configured`)

## Work Rules Card + Shift Pause Plan (2026-03-08)
- [x] Reconfirm the current Work ranking screen structure and replace the old top banners with a screenshot-matched rules card plus a compact status shape indicator.
- [x] Extend the Work backend response with a derived aggregate shift status that the UI can map to `blue circle / red triangle / gray square`.
- [x] Implement the new `교대 시작 +30분 무로그인 => 일시정지, 이후 첫 로그인 즉시 재개` rule without disturbing the existing driver-by-driver accumulation and ranking logic.
- [x] Add focused regression coverage for the new no-login pause/resume behavior, run relevant verification, and document the review.

## Work Rules Card + Shift Pause Review
- Root cause:
  - The Work screen still had the previous auto-shift summary banners, which no longer matched the new operator-facing requirement.
  - The backend also did not expose a single aggregate shift status for the requested `blue circle / red triangle / gray square` indicator.
- Implementation:
  - Extended the Work response contract in `packages/shared/src/schemas/domain.ts` with `shiftStatus`:
    - `state = collecting | paused | idle`
    - `reason = active_shift | break_time | awaiting_login | team_off | no_snapshot`
  - Updated `apps/server/src/services/ytWorkTime/service.ts`:
    - added `deriveYtWorkShiftIndicator(...)`
    - `break_time` is raised during fixed lunch/midnight rest windows
    - if the current shift is past `+30분` and there are still zero active YT logins, the aggregate state becomes `paused/team_off`
    - if any YT logs in later in the same shift, the same session immediately returns to `collecting` and counting resumes from that login snapshot
    - driver-level accumulation/ranking logic was left intact, so only real active segments continue to add work time
  - Rebuilt `apps/mobile/app/(tabs)/worktime.tsx`:
    - removed the old `YT 기사 일한 시간` and current-shift summary banners
    - added a top rules card based on the provided screenshot structure
    - placed the large status shape in the top-right whitespace area
    - mapped status visuals as:
      - blue circle => `collecting`
      - red triangle => `paused`
      - gray square => `idle`
    - kept the ranking card structure below and corrected the visible copy to clean Korean/English strings
  - Font note:
    - the repo does not contain a dedicated font asset matching the screenshot, so the rules card uses the native system bold font with the same emoji/text layout in dark and light themes
- Tests added/updated:
  - `apps/server/tests/yt-work-time.test.ts`
    - lunch-break indicator regression
    - `+30분 무로그인` pause and same-shift relogin resume regression
  - `apps/server/tests/yt-work-time-api.test.ts`
    - `GET /api/yt/work-time` now returns `shiftStatus`
    - `team_off` response behavior when the latest snapshot has zero logged-in YTs after the grace window
- Verification:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/yt-work-time.test.ts tests/yt-work-time-api.test.ts` ✅
  - `npm.cmd run typecheck` ✅
  - `npm.cmd test` ✅
  - Note: mobile workspace still has no UI test suite (`mobile tests not configured`)

## Equipment Monitor UI Refresh Plan (2026-03-08)
- [x] Re-read the current `monitor-equipment` layout and remove the low-signal raw `Latest GC180~190 State` list box.
- [x] Rebuild the screen with a theme-aware summary layout: hero status, tighter monitor config cards, and a bottom `Live Snapshot Focus` card that uses summary tiles and exception pills instead of raw rows.
- [x] Run mobile typecheck, record the review, and capture the UI lesson from the user correction.

## Equipment Monitor UI Refresh Review
- Root cause:
  - The old `Latest GC180~190 State` block was a verbose raw dump at the bottom of a configuration screen.
  - It took a full card of space without helping the operator scan the important things quickly.
- Implementation:
  - Rebuilt [apps/mobile/app/monitor-equipment.tsx](/c:/coding/gwct/apps/mobile/app/monitor-equipment.tsx) as a theme-aware screen using the shared app palette instead of hard-coded light-only colors.
  - Replaced the old bottom raw list with a `Live Snapshot Focus` card:
    - 4 summary tiles: `Tracked GC`, `Cabin ready`, `Under ready`, `Stop flagged`
    - exception pills for missing Cabin, missing Under, and Stop-set cranes
    - success pill when the latest snapshot is clean
  - Tightened the rest of the screen to match the new bottom section:
    - top hero card for latest capture / YT count / tracked GC
    - cleaner monitor cards with status badges, compact metric tiles, and the existing Confirm/Cancel controls
- Result:
  - The screen keeps the same functionality, but the space previously used by the raw GC list now works as a quick-glance dashboard.
  - Operators can tell whether the latest snapshot is healthy and where the exceptions are without reading long per-row text.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck` ✅
  - Note: mobile workspace still has no UI test suite (`mobile tests not configured`)

## Equipment Monitor Trim Plan (2026-03-08)
- [x] Remove the weak-signal `Tracked GC` tile from the Equipment Monitor hero.
- [x] Remove the entire bottom `Live Snapshot Focus` card and rebalance the remaining layout.
- [x] Run mobile typecheck and document the follow-up review plus lesson.

## Equipment Monitor Trim Review
- Root cause:
  - Even after the first refresh, the `Tracked GC` tile and the extra bottom focus card still read as low-value chrome compared with the actual monitor controls.
- Implementation:
  - Updated [apps/mobile/app/monitor-equipment.tsx](/c:/coding/gwct/apps/mobile/app/monitor-equipment.tsx) to remove the hero `Tracked GC` tile.
  - Removed the entire `Live Snapshot Focus` card from the bottom of the screen.
  - Folded the strongest leftover signal back into the GC monitor card by keeping `Cabin ready`, `Under ready`, and `Stop flagged` in the metric strip.
- Result:
  - The Equipment Monitor screen is shorter and more control-focused.
  - The remaining summary information sits closer to the setting it belongs to instead of living in a separate decorative section.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck` ✅
  - Note: mobile workspace still has no UI test suite (`mobile tests not configured`)

## Equipment Monitor Copy Trim Plan (2026-03-08)
- [x] Remove the gray helper/description lines from the three visible Equipment Monitor cards.
- [x] Keep the remaining spacing tidy without adding new UI elements.
- [x] Run mobile typecheck and document the follow-up review plus lesson.

## Equipment Monitor Copy Trim Review
- Root cause:
  - The three remaining Equipment Monitor cards still carried gray helper sentences that added visual weight without adding much operational value.
- Implementation:
  - Removed the helper/description text rows from [apps/mobile/app/monitor-equipment.tsx](/c:/coding/gwct/apps/mobile/app/monitor-equipment.tsx):
    - hero card
    - `YT Count Monitor` card
    - `GC180~GC190 Cabin/Under Monitor` card
  - Tightened the local title-block gaps so the cards still feel intentional after the copy removal.
- Result:
  - The screen reads cleaner and more control-focused.
  - The three boxes now present title, status, metrics, and actions only.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck` ✅
  - Note: mobile workspace still has no UI test suite (`mobile tests not configured`)

## Home YT Widget Threshold Color Plan (2026-03-08)
- [x] Reconfirm how the home YT widget reads the configured threshold and where its current color condition is applied.
- [x] Change the widget number color to three-way comparison: below threshold = red, exactly threshold = default dark text, above threshold = blue.
- [x] Run mobile typecheck and record the review plus the UI lesson.

## Home YT Widget Threshold Color Review
- Root cause:
  - The home YT widget only distinguished `low` vs `not low`, so operators could not tell at a glance when the live YT count was above the configured target.
- Implementation:
  - Updated [apps/mobile/app/(tabs)/index.tsx](/c:/coding/gwct/apps/mobile/app/(tabs)/index.tsx):
    - kept the existing threshold source from `GET /api/yt/live`
    - added a separate `isYtHigh` comparison (`ytCount > threshold`)
    - mapped colors as:
      - below threshold => `colors.danger`
      - equal threshold => `colors.primaryText`
      - above threshold => `colors.badgeBackground`
- Result:
  - The YT widget now reads as a three-state signal:
    - red when short
    - black/dark when on target
    - blue when above target
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck` ✅
  - Note: mobile workspace still has no UI test suite (`mobile tests not configured`)

## Yeosu Monitor UI Refresh Plan (2026-03-08)
- [x] Re-read the current `monitor-yeosu` layout and identify which raw/internal labels are making the screen feel noisy.
- [x] Rebuild the screen into a simpler, theme-aware status layout with clearer information hierarchy and operator-facing labels, while preserving the same API/actions.
- [x] Run mobile typecheck and document the review plus the UI lesson.

## Yeosu Monitor UI Refresh Review
- Root cause:
  - The old screen exposed internal keys like `lastRawText` and `lastNormalizedState` almost verbatim, so the whole page read like a debug dump instead of an operator tool.
  - Every line had the same visual weight, which made it hard to tell current status, memory state, and actions apart.
- Implementation:
  - Rebuilt [apps/mobile/app/monitor-yeosu.tsx](/c:/coding/gwct/apps/mobile/app/monitor-yeosu.tsx) with the shared app palette and a stronger layout hierarchy.
  - New structure:
    - hero card with live state pill, weather icon, monitor status, last capture, last change
    - `Status Snapshot` card with two clear tiles: `Live Forecast` and `Stored Memory`
    - `Signal Text` card for the current duty text and stored memory text
    - `Monitor Switch` card with a compact active/off badge and direct `Enable` / `Disable` actions
  - Replaced raw/internal wording with operator-facing labels:
    - `lastNormalizedState` -> `Stored Memory`
    - `lastRawText` -> `Stored Memory Text`
    - `latestForecastState` -> `Live Forecast`
  - Preserved the existing API flow and enable/disable behavior.
- Result:
  - The page is shorter, calmer, and easier to scan.
  - The top of the screen now answers the important questions first: current weather state, whether monitoring is on, when it last changed, and what text caused the state.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck` ✅
  - Note: mobile workspace still has no UI test suite (`mobile tests not configured`)

## Yeosu Monitor Trim Plan (2026-03-08)
- [x] Replace the hero `Last captured` stat with `Last change` and remove the redundant separate `Last change` stat box.
- [x] Remove the `Status Snapshot` card entirely and rebalance the remaining card flow.
- [x] Run mobile typecheck and document the follow-up review plus lesson.

## Yeosu Monitor Trim Review
- Root cause:
  - After the first redesign, `Last change` was still duplicated in the hero area and the separate `Status Snapshot` card repeated information the hero pill already communicated.
- Implementation:
  - Updated [apps/mobile/app/monitor-yeosu.tsx](/c:/coding/gwct/apps/mobile/app/monitor-yeosu.tsx):
    - replaced the hero `Last captured` tile with `Last change`
    - removed the old extra `Last change` stat tile so the hero now has only `Monitor` and `Last change`
    - removed the entire `Status Snapshot` card
  - Kept the remaining `Signal Text` and `Monitor Switch` cards unchanged so the screen still exposes the useful context and controls.
- Result:
  - The screen is shorter and less repetitive.
  - The hero now carries the key live status and transition timing, while the lower cards focus on text evidence and control.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck` ✅
  - Note: mobile workspace still has no UI test suite (`mobile tests not configured`)

## GWCT ETA Monitor UI Refresh Plan (2026-03-08)
- [x] Re-read the current `monitor-gwct-eta` layout and identify which parts still read like a raw settings dump.
- [x] Rebuild the screen into a theme-aware status-first layout with a clearer window-size control card and a denser watch-window preview list.
- [x] Run mobile typecheck and document the review plus the UI lesson.

## GWCT ETA Monitor UI Refresh Review
- Root cause:
  - The old GWCT ETA screen was functionally correct but visually thin: status, control, and preview all looked like the same level of plain text.
  - The watch-window preview in particular read like a raw dump instead of an operational scan list.
- Implementation:
  - Rebuilt [apps/mobile/app/monitor-gwct-eta.tsx](/c:/coding/gwct/apps/mobile/app/monitor-gwct-eta.tsx) with the shared app palette and a clearer hierarchy.
  - New structure:
    - hero card with monitor on/off pill, ferry icon, last capture, window size, preview row count
    - `Watch Window Size` card with cleaner metric tiles, stepper, and direct `Enable` / `Disable` actions
    - `Watch Window Preview` card using compact row cards instead of raw text lines
  - Preview rows now show:
    - watch-window index
    - voyage
    - vessel name
    - ETA
    - row-color-derived watch badge (`Watch Start`, `Watch`, `Stable`, `Unknown`)
- Result:
  - The screen is easier to read top-down: current monitor status first, setting control second, live watched vessels third.
  - The preview now feels like a deliberate operational list instead of debug output.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck` ✅
  - Note: mobile workspace still has no UI test suite (`mobile tests not configured`)

## GWCT ETA Last Change Plan (2026-03-08)
- [x] Reconfirm where GWCT ETA monitor currently gets its hero timestamp and identify the cleanest backend place to track a true trackingCount-scoped `lastChangedAt`.
- [x] Add persisted observed-state tracking for the current top-N watch-window signature, expose `lastChangedAt` via the API, and switch the mobile hero from `Last capture` to `Last change`.
- [x] Add focused regression coverage, run server/mobile verification, and document the review plus the lesson.

## GWCT ETA Last Change Review
- Root cause:
  - The GWCT ETA screen was still showing the latest scrape time, which only says when the board was fetched.
  - The user needed the more meaningful timestamp: when anything in the currently configured top-N watch window last changed.
- Implementation:
  - Extended [apps/server/src/services/monitorConfig/store.ts](/c:/coding/gwct/apps/server/src/services/monitorConfig/store.ts) so `gwctEtaMonitor` now keeps:
    - `lastTrackedSignature`
    - `lastChangedAt`
  - Added [apps/server/src/services/scheduleFocus/observedState.ts](/c:/coding/gwct/apps/server/src/services/scheduleFocus/observedState.ts):
    - builds a signature from the current tracked top-N schedule-focus rows
    - updates `lastChangedAt` only when that signature changes
  - Updated [apps/server/src/services/monitorService.ts](/c:/coding/gwct/apps/server/src/services/monitorService.ts) so each `gwct_schedule_list` scrape refreshes the ETA observed state using the current configured `trackingCount`.
  - Updated [apps/server/src/routes/api.ts](/c:/coding/gwct/apps/server/src/routes/api.ts):
    - `GET /api/monitors/gwct-eta` now returns `lastChangedAt`
    - the route no longer leaks internal `lastTrackedSignature`
    - `POST /api/monitors/gwct-eta` now returns the same public shape
  - Updated [apps/mobile/app/monitor-gwct-eta.tsx](/c:/coding/gwct/apps/mobile/app/monitor-gwct-eta.tsx) so the hero stat shows `Last change` instead of `Last capture`.
- Result:
  - The GWCT ETA monitor now shows the last meaningful change time for the configured watch window, not just the last scrape time.
  - The timestamp is scoped to the user-selected `trackingCount`, so it reflects the actual monitored vessel set.
- Verification:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/gwct-eta-monitor.test.ts tests/gwct-eta-observed-state.test.ts tests/gwct-eta-api.test.ts` ✅
  - `npm.cmd run typecheck` ✅
  - `npm.cmd test` ✅
  - Note: mobile workspace still has no UI test suite (`mobile tests not configured`)

## GWCT ETA Monitor Metric Trim Plan (2026-03-08)
- [x] Remove the `Applied now` and `Available rows` metric boxes from the `Watch Window Size` card.
- [x] Keep the control card balanced using only the stepper and action row.
- [x] Run mobile typecheck and document the follow-up review plus lesson.

## GWCT ETA Monitor Metric Trim Review
- Root cause:
  - The `Applied now` and `Available rows` tiles were repeating information already visible through the stepper value and the preview list itself.
- Implementation:
  - Updated [apps/mobile/app/monitor-gwct-eta.tsx](/c:/coding/gwct/apps/mobile/app/monitor-gwct-eta.tsx) to remove both metric tiles from the `Watch Window Size` card.
  - Kept the card focused on:
    - title/status
    - N stepper input
    - Enable / Disable actions
- Result:
  - The control card is shorter and less repetitive.
  - The remaining UI still communicates the configured N clearly through the input itself.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck` ✅
  - Note: mobile workspace still has no UI test suite (`mobile tests not configured`)

## GWCT ETA Monitor Copy Trim Plan (2026-03-08)
- [x] Remove the gray helper description under the `Watch Window Size` card title.
- [x] Keep the card spacing tidy without adding replacement copy.
- [x] Run mobile typecheck and document the follow-up review plus lesson.

## GWCT ETA Monitor Copy Trim Review
- Root cause:
  - The `Watch Window Size` card still had a gray helper sentence that repeated the obvious purpose of the control and added visual noise.
- Implementation:
  - Removed the helper sentence from [apps/mobile/app/monitor-gwct-eta.tsx](/c:/coding/gwct/apps/mobile/app/monitor-gwct-eta.tsx).
  - Tightened the title-block gap so the card remains visually balanced after the copy removal.
- Result:
  - The card now reads more cleanly as a direct control block.
  - Title, status, stepper, and action buttons remain without extra filler text.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck` ✅
  - Note: mobile workspace still has no UI test suite (`mobile tests not configured`)

## Home GWCT Icon Swap Plan (2026-03-08)
- [x] Replace the `야드 장비 로그인` emoji/icon in the home GWCT widget with a forklift icon.
- [x] Run mobile typecheck and document the follow-up review plus lesson.

## Home GWCT Icon Swap Review
- Root cause:
  - The first icon swap to `FontAwesome5 name="forklift"` rendered as `?` because this app ships the free FontAwesome5 set, and `forklift` exists in `FontAwesome5 Pro` but not in `FontAwesome5 Free`.
- Implementation:
  - Updated [apps/mobile/app/(tabs)/index.tsx](/c:/coding/gwct/apps/mobile/app/(tabs)/index.tsx) to use `MaterialCommunityIcons name="forklift"` on the `야드 장비 로그인` row instead of the unsupported FontAwesome5 glyph.
- Result:
  - The row icon now matches the yard-equipment context more directly and renders correctly instead of showing `?`.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck` ✅
  - Note: mobile workspace still has no UI test suite (`mobile tests not configured`)

## Operations Screen Dark Mode Plan (2026-03-08)
- [x] Audit the YT, GC, GC Cabin/Under, and GC Remaining screens for hard-coded light-theme colors.
- [x] Convert all four screens to use the shared app palette so surfaces, borders, copy, badges, and controls adapt in dark mode.
- [x] Verify the mobile workspace typechecks cleanly after the theme pass.
- [x] Document the review and add a lesson that operational status screens need an explicit dark-mode pass.

## Operations Screen Dark Mode Review
- Root cause:
  - The `YT`, `GC`, `GC Cabin/Under`, and `GC Remaining` screens were still using hard-coded light-theme colors even though the app already had a shared light/dark palette.
  - That left dark mode with bright cards, pale borders, and low-contrast controls that looked like light-mode leftovers instead of native dark surfaces.
- Implementation:
  - Updated [apps/mobile/app/yt.tsx](/c:/coding/gwct/apps/mobile/app/yt.tsx) to use `useAppPreferences()` and a theme-aware style factory for screen background, cards, error banner, count color, and YT status badges.
  - Updated [apps/mobile/app/cranes.tsx](/c:/coding/gwct/apps/mobile/app/cranes.tsx) to move crane cards and work-state badges onto palette-driven colors, including darker badge fills and contrast-safe text in dark mode.
  - Updated [apps/mobile/app/equipment.tsx](/c:/coding/gwct/apps/mobile/app/equipment.tsx) so the summary strip, GC cards, Cabin/Under text rows, stop-reason chip, and circle/triangle/square state marks all adapt to light and dark themes.
  - Updated [apps/mobile/app/monitor-gc-remaining.tsx](/c:/coding/gwct/apps/mobile/app/monitor-gc-remaining.tsx) so the monitor header, cards, stepper controls, numeric input, confirm/cancel buttons, and status text use the shared palette in both themes.
  - Added themed `RefreshControl` colors on all four screens so pull-to-refresh does not disappear against dark backgrounds.
- Result:
  - The four operational screens now render with actual dark surfaces, subdued borders, readable secondary text, and dark-mode-safe status accents instead of retaining light-only styling.
  - Status chips and control surfaces keep the same semantics as before, but they now read cleanly in both light and dark mode.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck` ✅
  - Note: mobile workspace still has no UI test suite (`mobile tests not configured`)

## Work Over-High Adjustment Verification Plan (2026-03-09)
- [x] Inspect the YT Work stop-reason matching rules for `오바`.
- [x] Trace whether the matched rule changes adjusted work totals and ranking output.
- [x] Verify the behavior with the dedicated YT work-time regression test.

## Work Over-High Adjustment Verification Review
- Result:
  - The exact requested rule is **not** implemented as `오바 => +30분`.
  - The current backend does treat `오바` as the `over_high` bucket, but the adjustment is `+35분`.
- Evidence:
  - [service.ts](C:/coding/gwct/apps/server/src/services/ytWorkTime/service.ts) matches `pattern: /오바/u` under `kind: "over_high"` and sets `adjustmentMinutes: 35`.
  - The same file applies that delta to `adjustedWorkedMs` and sorts Work ranking by `adjustedWorkedMs`, so the `+35분` rule is live in the actual response path.
  - [yt-work-time.test.ts](C:/coding/gwct/apps/server/tests/yt-work-time.test.ts) verifies `오바` stop reasons count toward `오바하이` and expects the adjusted total/label based on `+35분`.
- Verification:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/yt-work-time.test.ts` ✅

## Work Over-High Continuation Rule Plan (2026-03-09)
- [x] Rework the YT Work over-height stop-reason matcher so partial keywords like `B/BULK`, `오바잇`, `와이어`, and `오바` map to the same `오바하이` rule.
- [x] Change the over-height time adjustment from `+35분` to `+30분`.
- [x] Keep the current work segment open when the latest state is `stopped` or `logged_out` with an over-height reason, including the driverless logout row case, until the driver actually returns to normal flow or a conflicting handoff is observed.
- [x] Update Work UI copy/behavior only where needed to stay consistent with the new backend semantics.
- [x] Add regression coverage for continuous counting through over-height stop/logout and rerun the relevant tests.

## Work Over-High Continuation Rule Review
- Root cause:
  - The existing Work rules only matched a narrow `오바` keyword, added `+35분`, and still closed the live work segment as soon as the row changed to `stopped` or `logged_out`.
  - That did not match the operator rule that `B/BULK(오바잇(와이어)작업)`-style stop/logout states still represent ongoing over-height work until the driver returns to normal login flow.
- Implementation:
  - Updated [service.ts](C:/coding/gwct/apps/server/src/services/ytWorkTime/service.ts) so the `오바하이` rule now:
    - matches broader partial keywords (`B/BULK`, `오바잇`, `와이어`, `오바`, `OVER-HEIGHT`)
    - adds `+30분`
    - keeps the current segment open during `stopped` / `logged_out` snapshots for that reason
    - still stops the carry-over when a conflicting same-YT handoff is observed
  - Tightened stop-reason episode dedupe so the same tracked reason kind is counted once per inactive episode until the driver becomes `active` again.
  - Updated [worktime.tsx](C:/coding/gwct/apps/mobile/app/(tabs)/worktime.tsx) so the rules card explains the over-height continuation rule and the card no longer shows an empty `운전 중지` block while an over-height stop/logout is still being counted as live work.
- Verification:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/yt-work-time.test.ts tests/yt-work-time-api.test.ts` ✅
  - `npm.cmd run typecheck` ✅

## Work Break Persistence Plan (2026-03-10)
- [x] Verify whether meal-break windows keep the current shift session alive or drop the Work list to empty.
- [x] Fix the post-break grace logic so `team_off` starts only after `break end + 30분`, not immediately after `12:00~13:00` / `00:00~01:00`.
- [x] Add current-shift recovery from equipment snapshot history when the persisted Work session is empty or missing during a live break.
- [x] Add regression tests for break persistence and recovery, then rerun the relevant verification.

## Work Break Persistence Review
- Root cause:
  - The shift indicator only used `shift start + 30분` as the no-login grace cutoff, so right after meal break ended it could jump straight to `team_off` instead of staying in `awaiting_login`.
  - If the persisted Work session file was missing during break time, `GET /api/yt/work-time` rebuilt the current shift from only the latest snapshot. When that latest snapshot had no active YTs, the Work list could come back empty even though the same shift had already accumulated drivers before the break.
- Implementation:
  - Updated [service.ts](C:/coding/gwct/apps/server/src/services/ytWorkTime/service.ts) so `awaiting_login` now applies during two windows:
    - shift start until `+30분`
    - each break end until `+30분`
  - Added a shift-window helper export and kept `break_time` / `awaiting_login` / `team_off` transitions explicit in the Work indicator path.
  - Added [repository.ts](C:/coding/gwct/apps/server/src/db/repository.ts) support for loading grouped equipment snapshots since the current shift start.
  - Updated [api.ts](C:/coding/gwct/apps/server/src/routes/api.ts) so `GET /api/yt/work-time` can replay the current shift's equipment history and rebuild the persisted Work session before applying the latest snapshot. That prevents the break-time empty-list regression when the session file is absent.
- Verification:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/yt-work-time.test.ts tests/yt-work-time-api.test.ts` ✅
  - `npm.cmd run typecheck` ✅

## Work Meal-Break Carry-Over Verification Plan (2026-03-10)
- [x] Recheck the Work accumulation code path to confirm that meal breaks subtract time without discarding the stored pre-break total.
- [x] Verify existing day-shift regression coverage and add an explicit night-shift resume test if needed.
- [x] Run the focused YT work-time test suite and record the review conclusion.

## Work Meal-Break Carry-Over Verification Review
- Result:
  - Verified. Both day and night Work accumulation now preserve the pre-break total and continue from that same total when work resumes after the meal break.
- Evidence:
  - [service.ts](C:/coding/gwct/apps/server/src/services/ytWorkTime/service.ts) computes worked time by subtracting overlap with configured break windows from each segment, not by resetting driver totals.
  - When a segment closes, the worked milliseconds are added into persisted `totalWorkedMs`; when work resumes, a new `currentSegmentStartedAt` opens on top of the existing total instead of replacing it.
  - Existing day-shift regression already proved `11:50 -> lunch break -> 13:30 relogin` keeps the old total and resumes accumulation.
  - Added an explicit night-shift regression proving `23:50 -> 00:10 meal stop -> 01:20 resume` keeps the pre-break `10분` and grows it to `30분` after work restarts.
- Verification:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/yt-work-time.test.ts` ✅

## Home Focus Refresh Plan (2026-03-10)
- [x] Inspect the current home-tab data flow and identify which endpoints drive the bell badge and GWCT/YT summary widgets.
- [x] Trigger a silent refresh of those home endpoints whenever the Home screen regains focus.
- [x] Run mobile typecheck and document the result.

## Home Focus Refresh Review
- Root cause:
  - The Home screen loaded `summary` and `yt` once on mount, then only refreshed when the user manually pulled the screen.
  - That left the bell badge and GWCT/YT widgets stale after visiting another screen until the user scrolled and triggered refresh manually.
- Implementation:
  - Updated [index.tsx](C:/coding/gwct/apps/mobile/app/(tabs)/index.tsx) to use `useFocusEffect`.
  - When the Home tab regains focus, it now silently refreshes both:
    - `GET /api/dashboard/summary`
    - `GET /api/yt/live`
  - The refresh is silent, so the values update immediately without showing a pull-to-refresh spinner every time the user returns home.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck` ✅
  - Note: mobile workspace still has no automated UI test suite, so actual navigation behavior was not device-tested in this pass.

## Home Badge Immediate Clear Follow-Up Plan (2026-03-10)
- [x] Re-check why the bell badge could stay blue after clearing events and returning home.
- [x] Make Home react immediately to the `events_cleared` SSE event instead of waiting only for the next fetch result.
- [x] Re-run mobile typecheck and record the follow-up review.

## Home Badge Immediate Clear Follow-Up Review
- Root cause:
  - Home focus refresh alone was not enough for the user flow `Events clear -> Home tab`, because the Home badge still depended on the previous `summary` payload until the silent network refresh completed.
  - The Home live hook listened for new `alert` SSE events, but it did not listen for the `events_cleared` broadcast that the server already emitted after `DELETE /api/events`.
- Implementation:
  - Updated [useSseAlerts.ts](C:/coding/gwct/apps/mobile/hooks/useSseAlerts.ts) to listen for `events_cleared`, clear `lastAlert`, and expose `eventsClearedAt`.
  - Updated [index.tsx](C:/coding/gwct/apps/mobile/app/(tabs)/index.tsx) so Home immediately forces `alertCount24h` to `0` when `events_cleared` arrives, while still keeping the focus-based silent refresh for full server sync.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck` ✅
  - Note: mobile workspace still has no automated UI test suite, so this pass confirms compile safety but not device-level navigation timing.

## Vessel ETA Copy Plan (2026-03-10)
- [x] Inspect the shared ETA adjustment message formatter and locate every test that asserts the current copy.
- [x] Change the suffix from `N번째 ETA 조정` to `N번째 조정`.
- [x] Update duration wording so `0시간 N분` becomes `N분`, and `N시간 0분` becomes `N시간`.
- [x] Run the affected server tests and document the review.

## Vessel ETA Copy Review
- Root cause:
  - The shared ETA formatter always rendered both hour and minute units, so messages like `0시간 30분`, `2시간 0분`, and `26시간 0분` leaked into the Vessel Schedule UI.
  - The ETA adjustment suffix still used `N번째 ETA 조정` even though the user wanted the shorter `N번째 조정`.
- Implementation:
  - Updated [eta.ts](C:/coding/gwct/packages/shared/src/events/eta.ts) so:
    - `0시간 N분` => `N분`
    - `N시간 0분` => `N시간`
    - mixed values keep `N시간 N분`
    - `N번째 ETA 조정` => `N번째 조정`
  - Updated ETA-related tests across monitor/live-row/event-clear flows to the new wording.
- Verification:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/gwct-eta-monitor.test.ts tests/monitor-service-eta-adjustment.test.ts tests/vessels-live-rows.test.ts tests/events-clear-api.test.ts` ✅
  - `npm.cmd run typecheck` ✅

## Tab Bar Press Feedback Plan (2026-03-10)
- [x] Inspect the current bottom-tab layout and icon setup.
- [x] Add a custom tab bar button so the selected tab reads as a filled icon and a pressed tab shrinks with a stronger filled background.
- [x] Run mobile typecheck and document the review.

## Tab Bar Press Feedback Review
- Root cause:
  - The bottom tab bar was still using the default Expo Router tab button behavior, so the active state only changed tint color and the press interaction had almost no tactile feedback.
- Implementation:
  - Rebuilt [app/(tabs)/_layout.tsx](C:/coding/gwct/apps/mobile/app/(tabs)/_layout.tsx) with a custom tab button wrapper.
  - Active tabs now switch from outline icons to filled icons (`home`, `grid`, `person`, `construct`, `settings`) so the selected state reads much more clearly.
  - Press-and-hold now adds two feedback cues:
    - the whole tab button gets a stronger accent-filled background
    - the icon/label content springs down to `0.9x` scale while the finger is down, then rebounds on release
  - Selected tabs also keep a lighter accent-filled background even when not pressed, so the chosen destination reads as “filled” rather than just recolored.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck` ✅
  - Note: mobile workspace still has no automated UI test suite, so the tactile feel itself was not device-tested in this pass.

## Home Indicator Spacing Plan (2026-03-10)
- [x] Recheck the current tab bar height/padding and identify the smallest safe adjustment that lifts the controls slightly.
- [x] Increase the bottom-tab vertical breathing room without changing the home screen card grid itself.
- [x] Run mobile typecheck and document the result.

## Home Indicator Spacing Review
- Root cause:
  - After the press-feedback refresh, the tab bar still sat a little too close to the iPhone home indicator, so the lower touch area felt cramped and easy to mis-hit.
- Implementation:
  - Kept the Home screen layout itself untouched.
  - Updated [app/(tabs)/_layout.tsx](C:/coding/gwct/apps/mobile/app/(tabs)/_layout.tsx) with a small tab-bar-only spacing adjustment:
    - `height`: `68 -> 76`
    - `paddingBottom`: `8 -> 12`
    - `paddingTop`: `8 -> 7`

## Home Tab Polish Plan (2026-03-10)
- [x] Recheck the Home screen bottom widgets and tab bar together so only the lowest visual block moves.
- [x] Lift the GWCT and YT widgets slightly without disturbing the existing card grid.
- [x] Remove the tab-bar square highlight and leave only icon fill plus press-scale feedback.
- [x] Increase tab-bar bottom breathing room one more small step, then run mobile typecheck.

## Home Tab Polish Review
- Root cause:
  - The recent custom tab feedback solved the tap feel, but the added button background/border read as a separate square control and made the selected tab feel visually heavy.
  - The bottom safe-area issue also needed one more small vertical adjustment, but only near the lowest Home widgets and the tab bar itself.
- Implementation:
  - Updated [app/(tabs)/index.tsx](C:/coding/gwct/apps/mobile/app/(tabs)/index.tsx) to pull the GWCT/YT bottom row up slightly by reducing its top margin from `8` to `4`.
  - Updated [app/(tabs)/_layout.tsx](C:/coding/gwct/apps/mobile/app/(tabs)/_layout.tsx) to remove the tab-button square background/border completely.
  - Kept the icon-only pressed feedback by preserving the spring scale animation on press.
  - Raised the tab content slightly again by changing the tab-bar spacing to `height: 80`, `paddingBottom: 15`, `paddingTop: 6`, and button margins to `marginTop: 2`, `marginBottom: 8`.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## Home Vertical Rhythm Plan (2026-03-10)
- [x] Recheck the full Home stack spacing instead of only the bottom widget row.
- [x] Pull the content stack slightly upward by trimming the top padding and vertical gaps while keeping the card layout unchanged.
- [x] Preserve the icon-only tab feedback and verify the new Home spacing against the raised tab bar.
- [x] Run mobile typecheck and document the review plus the correction lesson.

## Home Vertical Rhythm Review
- Root cause:
  - Moving only the bottom GWCT/YT row was too local. The top live section and the five navigation cards still held the overall stack too low, so the bottom widgets remained visually cramped against the tab bar.
- Implementation:
  - Updated [app/(tabs)/index.tsx](C:/coding/gwct/apps/mobile/app/(tabs)/index.tsx) to shift the whole Home stack slightly upward by trimming the main vertical spacing:
    - `content.paddingTop`: `60 -> 56`
    - `content.gap`: `14 -> 13`
    - `links.gap`: `12 -> 11`
    - `links.marginTop`: `4 -> 2`
    - `linkCard.paddingVertical`: `20 -> 19`
    - `bottomRow.marginTop`: `4 -> 2`
  - Updated [app/(tabs)/_layout.tsx](C:/coding/gwct/apps/mobile/app/(tabs)/_layout.tsx) to lift the tab icons slightly inside the already-expanded tab bar:
    - `tabButton.marginTop`: `2 -> 1`
    - `tabButton.marginBottom`: `8 -> 9`
    - `tabBarStyle.paddingBottom`: `15 -> 16`
    - `tabBarStyle.paddingTop`: `6 -> 5`
  - Kept the icon-only tab feedback: no square button background, filled active icon state preserved, press-scale animation preserved.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## Home Widget Gap Plan (2026-03-10)
- [x] Recheck the latest Home spacing change with emphasis on the monitor-settings-to-widget gap only.
- [x] Reduce only the gap above the GWCT/YT row and leave widget sizing untouched.
- [x] Lift the tab-bar contents slightly again without bringing back any square button chrome.
- [x] Run mobile typecheck and document the correction.

## Home Widget Gap Review
- Root cause:
  - The last pass compressed the whole Home stack correctly, but the user's specific request was narrower: keep the GWCT/YT widgets at their existing size and only tighten the gap above them.
- Implementation:
  - Updated [app/(tabs)/index.tsx](C:/coding/gwct/apps/mobile/app/(tabs)/index.tsx) so the lower-section gap tightens without shrinking the widgets:
    - `content.gap`: `13 -> 11`
    - `topBar.marginBottom`: `+2` to avoid over-compressing the top section
    - `bottomRow.marginTop`: `2 -> 0`
  - Left the GWCT/YT card padding and typography unchanged.
  - Updated [app/(tabs)/_layout.tsx](C:/coding/gwct/apps/mobile/app/(tabs)/_layout.tsx) to raise the tab contents slightly again:
    - `tabButton.marginTop`: `1 -> 0`
    - `tabButton.marginBottom`: `9 -> 10`
    - `tabBarStyle.paddingBottom`: `16 -> 17`
    - `tabBarStyle.paddingTop`: `5 -> 4`
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## Tab Bar Raise Plan (2026-03-10)
- [x] Recheck the current tab-bar-only spacing values.
- [x] Raise only the tab bar slightly without changing the Home screen layout.
- [x] Run mobile typecheck and document the correction.

## Tab Bar Raise Review
- Root cause:
  - The previous pass already fixed the widget-to-bar gap, but the user wanted one more tab-bar-only lift without any further Home screen adjustments.
- Implementation:
  - Updated [app/(tabs)/_layout.tsx](C:/coding/gwct/apps/mobile/app/(tabs)/_layout.tsx) only.
  - Increased `tabBarStyle.height` from `80` to `83`.
  - Increased `tabBarStyle.paddingBottom` from `17` to `18`.
  - Left the Home widgets and their spacing untouched.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## Tab Bar Raise Follow-up Plan (2026-03-10)
- [x] Recheck the current tab-bar-only spacing values after the last raise.
- [x] Raise only the tab bar further without touching the Home layout.
- [x] Run mobile typecheck and document the correction.

## Tab Bar Raise Follow-up Review
- Root cause:
  - The previous tab-bar raise was still visually too conservative relative to the bottom widgets, so the gap still read as overly tall.
- Implementation:
  - Updated [app/(tabs)/_layout.tsx](C:/coding/gwct/apps/mobile/app/(tabs)/_layout.tsx) only.
  - Increased `tabBarStyle.height` from `83` to `90`.
  - Increased `tabBarStyle.paddingBottom` from `18` to `19`.
  - Left the Home screen spacing and widget sizes unchanged.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## Tab Bar Nudge Down Plan (2026-03-10)
- [x] Recheck the current tab-bar-only spacing values.
- [x] Lower only the tab-bar container by one unit.
- [x] Run mobile typecheck and document the correction.

## Tab Bar Nudge Down Review
- Root cause:
  - After the larger raise, the user wanted a one-step rollback rather than another broader spacing rebalance.
- Implementation:
  - Updated [app/(tabs)/_layout.tsx](C:/coding/gwct/apps/mobile/app/(tabs)/_layout.tsx) only.
  - Reduced `tabBarStyle.height` from `90` to `89`.
  - Left the Home screen layout and the rest of the tab-bar spacing untouched.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## Work Ranking Investigation Plan (2026-03-10)
- [x] Capture the investigation scope from the reported screenshot symptoms.
- [x] Inspect Work accumulation and sorting logic for meal-break handling, displayed start time semantics, and ranking tie-breaks.
- [x] Reproduce the reported pattern with code/tests and decide whether the behavior is expected or buggy.
- [x] If buggy, implement the fix, add regression coverage, verify it, and document the result.

## Work Ranking Investigation Review
- Root cause:
  - The equal `0시간 36분` / `0시간 37분` values in the screenshot were not a counting bug. During the night shift, `00:00~01:00` is excluded from worked time, so drivers who first logged in at `00:48`, `00:49`, `00:50`, `00:56`, or `00:57` all start accumulating from `01:00` and therefore can show the same worked minutes.
  - The real bug was the ranking tie-break. When `adjustedWorkedMs` was equal, the backend sorted by `driverName`, so a driver with an earlier displayed `운전 시작` could still appear below a later one.
- Implementation:
  - Updated [apps/server/src/services/ytWorkTime/service.ts](C:/coding/gwct/apps/server/src/services/ytWorkTime/service.ts) so the rank sort order is now:
    - `adjustedWorkedMs` descending
    - `totalWorkedMs` descending
    - `firstSeenAt` ascending
    - `currentSegmentStartedAt` ascending
    - `driverName` ascending
  - Added a regression test in [apps/server/tests/yt-work-time.test.ts](C:/coding/gwct/apps/server/tests/yt-work-time.test.ts) that reproduces the midnight-break case where different start times still have equal worked minutes, and verifies that tied drivers now rank by earlier start time instead of by name.
- Verification:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/yt-work-time.test.ts`
  - `npm.cmd run typecheck`

## Work Break Window Plan (2026-03-10)
- [x] Add the requested scope for the meal-break window and Work rules-card copy change.
- [x] Update backend meal-break windows from 60 minutes to 40 minutes and align the break-status detail text.
- [x] Remove the over-height stop/logout explanation row from the Work rules card.
- [x] Update regression tests, run YT Work tests plus typecheck, and document the correction.

## Work Break Window Review
- Root cause:
  - The fixed meal-break windows were still modeled as `12:00~13:00` and `00:00~01:00`, and the Work rules card still showed an extra over-height explanation row that the user wanted removed.
- Implementation:
  - Updated [apps/server/src/services/ytWorkTime/service.ts](C:/coding/gwct/apps/server/src/services/ytWorkTime/service.ts) so the fixed break windows are now:
    - day: `12:00 ~ 12:40`
    - night: `00:00 ~ 00:40`
  - Updated the break-status detail text in the same service file to show the new `12:40` / `00:40` end times.
  - Rewrote [apps/mobile/app/(tabs)/worktime.tsx](C:/coding/gwct/apps/mobile/app/(tabs)/worktime.tsx) with clean text and removed the `Over-height stop/logout keeps counting until re-login` row from the `Time Adjustments` section.
  - Updated [apps/server/tests/yt-work-time.test.ts](C:/coding/gwct/apps/server/tests/yt-work-time.test.ts) expectations for the shorter break windows, including lunch/night accumulated minutes and the `awaiting_login -> team_off` timing.
- Verification:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/yt-work-time.test.ts tests/yt-work-time-api.test.ts`
  - `npm.cmd run typecheck`

## Work Rules Indent Plan (2026-03-10)
- [x] Recheck the Work rules-card row styles for the dotted sections.
- [x] Move only the dotted rule rows slightly to the right without changing the card layout.
- [x] Run mobile typecheck and document the correction.

## Work Rules Indent Review
- Root cause:
  - The dotted rows under `Shift Schedule` and `Time Adjustments` were starting too far left relative to the section-title emoji/text, so the small bullet list looked slightly under-indented.
- Implementation:
  - Updated [app/(tabs)/worktime.tsx](C:/coding/gwct/apps/mobile/app/(tabs)/worktime.tsx) only.
  - Added `paddingLeft: 8` to `rulesRow` so the bullet, row icon, and text all move right together while preserving their existing internal spacing.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## Tab Press Animation Plan (2026-03-10)
- [x] Recheck the current bottom-tab press animation values.
- [x] Make the press animation shrink a bit more before springing back.
- [x] Run mobile typecheck and document the correction.

## Tab Press Animation Review
- Root cause:
  - The existing tab press feedback was readable, but the shrink amount was too mild to feel punchy on touch.
- Implementation:
  - Updated [app/(tabs)/_layout.tsx](C:/coding/gwct/apps/mobile/app/(tabs)/_layout.tsx) only.
  - Changed press-in scale from `0.9` to `0.82` and tightened the press-in spring so the icon/label compress more noticeably.
  - Adjusted the press-out spring to rebound a little more crisply while keeping the same overall interaction model.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`
    - tab button `marginBottom`: `2 -> 6`
  - That lifts the interactive tab content slightly higher and gives the bar a bit more vertical breathing room without changing the card rows/columns on Home.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck` ✅
  - Note: mobile workspace still has no automated UI test suite, so the touch feel itself was not device-tested in this pass.

## Monitoring Tactile Feedback Plan (2026-03-10)
- [x] Inspect the Monitoring settings screens and identify every enable/disable, confirm/cancel, and plus/minus control that needs richer press feedback.
- [x] Build a shared tactile pressable that adds a subtle sink, compression, and rebound without redesigning each screen independently.
- [x] Apply the shared control to all Monitoring settings actions and steppers.
- [x] Run mobile typecheck, review the touch model, and document the result.

## Monitoring Tactile Feedback Review
- Root cause:
  - The Monitoring settings controls were visually correct but still felt flat on touch because the buttons only changed color. They were missing the small depth cues that make a press feel intentional, like a slight sink and a quick rebound.
- Implementation:
  - Added [apps/mobile/components/TactilePressable.tsx](C:/coding/gwct/apps/mobile/components/TactilePressable.tsx) as a shared animated press wrapper.
  - The shared control compresses and drops slightly on press-in, relaxes its shadow while pressed, and springs back on release.
  - It exposes two variants:
    - `regular` for `Enable`, `Disable`, `Confirm`, `Cancel`
    - `compact` for `+` / `-` steppers with a slightly tighter, punchier compression
  - Applied the shared control to:
    - [apps/mobile/app/monitor-gwct-eta.tsx](C:/coding/gwct/apps/mobile/app/monitor-gwct-eta.tsx)
    - [apps/mobile/app/monitor-gc-remaining.tsx](C:/coding/gwct/apps/mobile/app/monitor-gc-remaining.tsx)
    - [apps/mobile/app/monitor-equipment.tsx](C:/coding/gwct/apps/mobile/app/monitor-equipment.tsx)
    - [apps/mobile/app/monitor-yeosu.tsx](C:/coding/gwct/apps/mobile/app/monitor-yeosu.tsx)
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - Note: this pass verified the code path and typings, but did not include physical-device tuning of the exact press feel.

## Monitoring Tactile Motion Correction Plan (2026-03-10)
- [x] Recheck the shared Monitoring tactile button motion that was causing the press feedback to feel like the screen was shifting vertically.
- [x] Remove only the vertical movement from the shared button animation while keeping the scale/shadow tactile feel.
- [x] Run mobile typecheck and document the correction.

## Monitoring Tactile Motion Correction Review
- Root cause:
  - The added `translateY` sink made the button feel like it was bouncing the layout instead of simply compressing under the finger, which read as an awkward refresh-like motion.
- Implementation:
  - Updated [apps/mobile/components/TactilePressable.tsx](C:/coding/gwct/apps/mobile/components/TactilePressable.tsx) only.
  - Removed the vertical `translateY` animation from both tactile variants.
  - Kept the scale compression, pressed shadow reduction, and spring-back so the buttons still feel tactile without the up/down wobble.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## Monitoring Keyboard Plan (2026-03-10)
- [x] Inspect every Monitoring settings input that still forces the iOS numeric keypad.
- [x] Switch those inputs to the default keyboard while keeping the entered values numeric-only.
- [x] Run mobile typecheck and document the result.

## Monitoring Keyboard Review
- Root cause:
  - The Monitoring settings inputs were explicitly using `keyboardType=\"number-pad\"`, so iOS was always showing the narrow numeric keypad instead of the standard keyboard layout.
- Implementation:
  - Added [apps/mobile/lib/sanitizeNumericInput.ts](C:/coding/gwct/apps/mobile/lib/sanitizeNumericInput.ts) to keep Monitoring threshold inputs digit-only even when using the default keyboard.
  - Updated these inputs to use `keyboardType=\"default\"` plus numeric sanitization:
    - [apps/mobile/app/monitor-gwct-eta.tsx](C:/coding/gwct/apps/mobile/app/monitor-gwct-eta.tsx)
    - [apps/mobile/app/monitor-gc-remaining.tsx](C:/coding/gwct/apps/mobile/app/monitor-gc-remaining.tsx)
    - [apps/mobile/app/monitor-equipment.tsx](C:/coding/gwct/apps/mobile/app/monitor-equipment.tsx)
  - Added `returnKeyType=\"done\"` and disabled autocorrect/spellcheck on those numeric fields so the keyboard behaves more like a clean system input instead of a search field.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## Monitoring Input Submit Plan (2026-03-10)
- [x] Recheck the Monitoring numeric inputs after the keyboard change and confirm how the return key behaves.
- [x] Change those inputs so the keyboard `search` key triggers the existing confirm action immediately.
- [x] Run mobile typecheck and document the correction.

## Monitoring Input Submit Review
- Root cause:
  - After switching the Monitoring numeric fields to the default keyboard, the return key no longer matched the intended workflow. Operators still had to tap `Confirm` manually even though the keyboard could submit directly.
- Implementation:
  - Updated the Monitoring numeric inputs to use `returnKeyType="search"` and wired `onSubmitEditing` to the existing confirm handler on each relevant screen:
    - [apps/mobile/app/monitor-gwct-eta.tsx](C:/coding/gwct/apps/mobile/app/monitor-gwct-eta.tsx)
    - [apps/mobile/app/monitor-gc-remaining.tsx](C:/coding/gwct/apps/mobile/app/monitor-gc-remaining.tsx)
    - [apps/mobile/app/monitor-equipment.tsx](C:/coding/gwct/apps/mobile/app/monitor-equipment.tsx)
  - The button logic itself was not duplicated; the keyboard submit now calls the same save path the visible `Confirm` button already uses.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## Success Alert Removal Plan (2026-03-10)
- [x] Inspect mobile settings and delete flows for post-success modal alerts.
- [x] Remove the unnecessary success alerts while keeping failure alerts and destructive confirmations.
- [x] Run mobile typecheck and document the result.

## Success Alert Removal Review
- Root cause:
  - Several settings and delete flows were still showing blocking success modals even though the screen state already refreshed immediately. That duplicated feedback and interrupted the operator's flow without adding real information.
- Implementation:
  - Removed post-success `Alert.alert(...)` calls from:
    - [apps/mobile/app/monitor-gwct-eta.tsx](C:/coding/gwct/apps/mobile/app/monitor-gwct-eta.tsx)
    - [apps/mobile/app/monitor-equipment.tsx](C:/coding/gwct/apps/mobile/app/monitor-equipment.tsx)
    - [apps/mobile/app/monitor-yeosu.tsx](C:/coding/gwct/apps/mobile/app/monitor-yeosu.tsx)
    - [apps/mobile/app/(tabs)/alerts.tsx](C:/coding/gwct/apps/mobile/app/(tabs)/alerts.tsx)
  - Kept error alerts in place so failed saves/deletes still surface clearly.
  - Kept the pre-delete confirmation dialog in Events because that is a destructive guard, not a post-success notification.
- Verification:
  - `rg -n "Alert\\.alert\\(" apps/mobile`
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## Work Rank Medal Plan (2026-03-10)
- [x] Inspect the Work rank label render path.
- [x] Add medal emojis to 1st, 2nd, and 3rd place without disturbing the rest of the rank labels.
- [x] Run mobile typecheck and document the result.

## Work Rank Medal Review
- Root cause:
  - The Work rank cards only rendered plain ordinal labels, so the top three positions were not visually distinguished. The existing `꼴등` rule also would have conflicted with a 3-person ranking if medals were added naively.
- Implementation:
  - Updated [apps/mobile/app/(tabs)/worktime.tsx](C:/coding/gwct/apps/mobile/app/(tabs)/worktime.tsx) only.
  - Changed `rankLabel(...)` so it now returns:
    - `1등 🥇`
    - `2등 🥈`
    - `3등 🥉`
  - Moved the `꼴등` fallback behind the medal checks and limited it to lists with more than 3 drivers so 3등이 꼴등으로 바뀌지 않게 했습니다.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## Scraper Latency Tightening Plan (2026-03-10)
- [ ] Inspect the end-to-end latency path across server scrape scheduling, fetch wait behavior, persistence, SSE fan-out, and mobile refresh behavior.
- [ ] Record the measured current intervals and recent scrape durations, then decide a tighter but still safe operating point.
- [ ] Implement the latency reduction with minimal architectural churn:
  - lower the live scrape intervals and jitter conservatively but materially
  - remove avoidable fetch-side delay
  - push live source-update invalidation over SSE so active mobile screens refresh immediately instead of waiting for long polling windows
- [ ] Run verification for both server and mobile and document the performance tradeoff and remaining limits.

## Scraper Latency Investigation Notes
- Current configured live intervals in [apps/server/.env](C:/coding/gwct/apps/server/.env) are:
  - `GWCT_INTERVAL_MS=30000`
  - `GWCT_GC_INTERVAL_MS=25000`
  - `YS_INTERVAL_MS=60000`
  - `JITTER_MS=3000`
- Recent `ScrapeRun` samples from the local DB show the fetch/parse work itself is much faster than those intervals:
  - `gwct_schedule_list`: avg `694ms`, max `752ms`
  - `gwct_work_status`: avg `1321ms`, max `2034ms`
  - `gwct_gc_remaining`: avg `1478ms`, max `2613ms`
  - `gwct_equipment_status`: avg `883ms`, max `927ms`
  - `ys_forecast`: avg `1654ms`, max `1723ms`
- The current user-facing lag is therefore dominated by scheduling and client refresh strategy, not parser CPU time.

## Scraper Latency Tightening Review
- Root cause:
  - The observed 10-second-class lag was not coming from parser CPU work. The local measurements showed most scrapes finishing in under 2 seconds, but the system was still waiting on:
    - very loose source intervals (`30s` / `25s` / `60s`)
    - per-cycle scheduler drift because the next run waited the full interval after completion
    - an extra fixed `350ms` fetch-side wait
    - mobile screens that often polled every `20s~30s` or not at all
  - That meant the app could miss a fresh scrape even after the server already had the new snapshot.
- Implementation:
  - Tightened live server defaults and the active local runtime config:
    - [apps/server/src/config/env.ts](C:/coding/gwct/apps/server/src/config/env.ts)
    - [apps/server/.env.example](C:/coding/gwct/apps/server/.env.example)
    - [apps/server/.env](C:/coding/gwct/apps/server/.env)
  - New values:
    - `GWCT_INTERVAL_MS=2000`
    - `GWCT_GC_INTERVAL_MS=2000`
    - `YS_INTERVAL_MS=10000`
    - `JITTER_MS=250`
  - Changed [apps/server/src/services/scheduler.ts](C:/coding/gwct/apps/server/src/services/scheduler.ts) from an "interval after completion" pattern to a start-cadence-compensated loop, so short scrapes stay close to the configured cadence instead of drifting by their own runtime every cycle.
  - Reduced the fixed post-load wait in [apps/server/src/scraper/fetcher.ts](C:/coding/gwct/apps/server/src/scraper/fetcher.ts) from `350ms` to `150ms`.
  - Added server-side SSE invalidation in [apps/server/src/services/monitorService.ts](C:/coding/gwct/apps/server/src/services/monitorService.ts) so each successful scrape broadcasts `source_updated` immediately.
  - Extended [apps/mobile/hooks/useEndpoint.ts](C:/coding/gwct/apps/mobile/hooks/useEndpoint.ts) so screens can subscribe to live source updates and silently refresh right away instead of waiting for the next long polling window. The hook also now skips overlapping fetches to avoid self-inflicted burst traffic.
  - Wired the active live screens and monitor pages to the relevant source updates, and reduced their fallback polling windows to `5s` for GWCT live data and `10s` for YS weather data.
- Verification:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/scheduler.test.ts tests/monitor-service-eta-adjustment.test.ts`
  - `npm.cmd run typecheck`
- Tradeoff:
  - This materially reduces lag, but it is still not mathematically guaranteed to stay under 2 seconds in every case because the upstream websites themselves can take `1~2.6s` to respond and parse. The new setup is designed to push the app close to the scrape completion time without making the server poll blindly every few hundred milliseconds.
  - If even tighter behavior is needed after observing this in production, the next structural optimization would be to deduplicate shared-page fetches like `gwct_work_status` and `gwct_gc_remaining`, which currently hit the same GWCT `m=F&s=A` page separately.

## Save/Delete Spinner Investigation Plan (2026-03-10)
- [x] Inspect the mobile delete/save flows that showed indefinite loading and compare them against the recent live-refresh changes.
- [x] Measure local API latency for the affected routes to separate server processing cost from client-side refresh contention.
- [x] Implement the safest fix:
  - stop hidden screens from continuing live SSE/poll refresh work
  - add request timeouts for destructive/save actions
  - stop tying button spinners to a follow-up refresh round-trip when the mutation itself already succeeded
- [x] Run verification and document the findings.

## Save/Delete Spinner Investigation Review
- Root cause:
  - The save/delete routes themselves were not slow locally. Measured against the running server:
    - `GET /api/monitors/equipment`: avg about `24.7ms`
    - `POST /api/monitors/equipment`: avg about `24.4ms`
    - `DELETE /api/events`: avg about `25ms`
  - That means the "infinite saving/clearing" symptom was unlikely to be caused by the DB delete or monitor-setting write itself.
  - The more plausible regression came from the recent live-refresh tightening:
    - `useEndpoint` was opening SSE subscriptions and poll timers for every mounted screen, not just the currently visible one.
    - In a tab-based app, visited screens can stay mounted, so hidden screens could keep refreshing in the background.
    - Mutation buttons were also awaiting a follow-up `refresh()` round-trip before clearing their spinner, so any network stall after the successful `POST` could make the UI look stuck.
- Implementation:
  - Updated [apps/mobile/hooks/useEndpoint.ts](C:/coding/gwct/apps/mobile/hooks/useEndpoint.ts) to activate polling and `source_updated` SSE refresh only while the screen is focused.
  - Added [apps/mobile/lib/fetchJson.ts](C:/coding/gwct/apps/mobile/lib/fetchJson.ts) so save/delete actions now fail fast with a timeout instead of waiting indefinitely on a hanging request.
  - Updated the affected mutation flows to:
    - clear their spinner when the mutation response returns
    - update local screen state optimistically with `setData(...)`
    - run the follow-up refresh in the background with `void refresh({ silent: true })`
  - Applied that to:
    - [apps/mobile/app/(tabs)/alerts.tsx](C:/coding/gwct/apps/mobile/app/(tabs)/alerts.tsx)
    - [apps/mobile/app/monitor-gwct-eta.tsx](C:/coding/gwct/apps/mobile/app/monitor-gwct-eta.tsx)
    - [apps/mobile/app/monitor-gc-remaining.tsx](C:/coding/gwct/apps/mobile/app/monitor-gc-remaining.tsx)
    - [apps/mobile/app/monitor-equipment.tsx](C:/coding/gwct/apps/mobile/app/monitor-equipment.tsx)
    - [apps/mobile/app/monitor-yeosu.tsx](C:/coding/gwct/apps/mobile/app/monitor-yeosu.tsx)
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - Local route timing checks via `Invoke-WebRequest` for:
    - `GET /api/monitors/equipment`
    - `POST /api/monitors/equipment`
    - `DELETE /api/events`

## Monitoring Settings Freeze Plan (2026-03-10)
- [x] Inspect the monitor setting screens and confirm whether polling/live SSE refresh is still active while the user edits values.
- [x] Disable live refresh on the monitor setting screens so they only load when entered/focused and otherwise keep the current draft stable.
- [x] Run verification and document the outcome.

## Monitoring Settings Freeze Review
- Root cause:
  - The monitor setting screens were still using `pollMs` and `liveSources` via `useEndpoint(...)`.
  - That meant focused setting screens kept receiving server-originated refreshes while the user was typing, so local draft input state could be overwritten by the last saved server value.
- Implementation:
  - Removed `pollMs` and `liveSources` from:
    - [apps/mobile/app/monitor-gwct-eta.tsx](C:/coding/gwct/apps/mobile/app/monitor-gwct-eta.tsx)
    - [apps/mobile/app/monitor-gc-remaining.tsx](C:/coding/gwct/apps/mobile/app/monitor-gc-remaining.tsx)
    - [apps/mobile/app/monitor-equipment.tsx](C:/coding/gwct/apps/mobile/app/monitor-equipment.tsx)
    - [apps/mobile/app/monitor-yeosu.tsx](C:/coding/gwct/apps/mobile/app/monitor-yeosu.tsx)
  - These screens now fetch once when entered/focused through the default `useEndpoint` behavior and otherwise keep the draft stable until the user manually refreshes or saves.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## Tactile Feedback Restoration Plan (2026-03-10)
- [x] Inspect the shared tactile button component to confirm whether the current effect became too subtle after removing vertical movement.
- [x] Restore a clearly visible but stable press effect for shared monitoring buttons without bringing back the awkward screen-wobble motion.
- [x] Run verification and document the result.

## Tactile Feedback Restoration Review
- Root cause:
  - After removing vertical travel from the shared tactile button, the remaining feedback was only a modest scale change plus a softer shadow.
  - On small controls like `+/-`, `Confirm`, `Enable`, that remaining motion was too subtle and could read as if the press effect had disappeared.
- Implementation:
  - Updated [apps/mobile/components/TactilePressable.tsx](C:/coding/gwct/apps/mobile/components/TactilePressable.tsx) so the shared press effect is more visible again without reintroducing the awkward vertical wobble:
    - stronger press-in scale
    - brief pressed opacity dimming
    - same anchored position, with the lighter pressed shadow retained
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## Dynamic GWCT Cadence Plan (2026-03-10)
- [x] Inspect the current GWCT source cadence, scheduler behavior, and available parser fields for schedule/work/equipment pages.
- [x] Implement a conservative early-off-duty cadence governor that relaxes GWCT scraping only when schedule, work, and equipment all indicate the shift has effectively ended, and restores fast mode on login activity or shift boundary.
- [x] Add regression coverage for the governor and scheduler integration, then run targeted verification.

## Dynamic GWCT Cadence Review
- Goal:
  - Reduce unnecessary GWCT scrape pressure during proven early-off-duty windows without giving up fast refresh during real operations or shift handoff periods.
- Implementation:
  - Added [apps/server/src/services/scrapeCadence/governor.ts](C:/coding/gwct/apps/server/src/services/scrapeCadence/governor.ts), an in-memory cadence governor that watches three signals:
    - schedule list: first yellow row must exist after at least one completed green row, and its ETA must still be at least `90분` away
    - work status: the summary table must show only zero-progress rows whose ETA is still at least `90분` away
    - equipment status: tracked operational equipment (`GC`, `LEASE`, `REPAIR`, `RS`, `TC`, `TH`, `YT`) must be effectively idle, with at most `2` normal logins and a stable idle observation streak
- When all three line up, the governor switches the relevant GWCT sources into a relaxed cadence:
  - `gwct_schedule_list`: `15s`
  - `gwct_work_status`: `15s`
  - `gwct_gc_remaining`: `15s`
  - `gwct_equipment_status`: `15s`
  - Any newly appearing normal login while relaxed immediately restores fast mode and holds it until the next shift boundary so the system does not bounce back into relaxed mode on the same quiet-looking stale data.
  - Shift boundary (`06:45` / `18:45` KST) also forces a return to fast mode and clears the prior quiet signals so the next cycle starts from fresh observations.
  - Wired the governor into:
    - [apps/server/src/services/monitorService.ts](C:/coding/gwct/apps/server/src/services/monitorService.ts)
    - [apps/server/src/services/scheduler.ts](C:/coding/gwct/apps/server/src/services/scheduler.ts)
    - [apps/server/src/runtime.ts](C:/coding/gwct/apps/server/src/runtime.ts)
  - Extended [apps/server/src/parsers/gwct.ts](C:/coding/gwct/apps/server/src/parsers/gwct.ts) to preserve the count of preceding completed green rows in the watched schedule row metadata, so the governor can distinguish "real completed work before a future yellow row" from a plain first yellow row at the top.
- Verification:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/scrape-cadence-governor.test.ts tests/scheduler.test.ts tests/monitor-service-eta-adjustment.test.ts`
  - `npm.cmd run typecheck`

## Dynamic GWCT Cadence Tuning Plan (2026-03-10)
- [x] Re-check the relaxed cadence values against the user's clarified "near sleep mode" expectation.
- [x] Raise the relaxed GWCT cadence to 10 minutes and ensure the scheduler still wakes by the next shift boundary instead of oversleeping past 06:45 or 18:45.
- [x] Update regression coverage and verification notes.

## Dynamic GWCT Cadence Tuning Review
- Adjustment:
  - Raised the relaxed cadence for the managed GWCT sources from `15s` to `10m`, effectively treating the confirmed early-off-duty window as a near-sleep mode.
  - Applied uniformly to:
    - `gwct_schedule_list`
    - `gwct_work_status`
    - `gwct_gc_remaining`
    - `gwct_equipment_status`
- Safety guard:
  - Even in relaxed mode, the governor now caps the next delay to the upcoming shift boundary. That means the scheduler will not oversleep past `06:45` or `18:45`; if the next 10-minute slot would cross the boundary, it wakes at the boundary instead and the cadence can revert to fast.
- Verification:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/scrape-cadence-governor.test.ts tests/scheduler.test.ts`
  - `npm.cmd run typecheck`

## Tactile Rebound Plan (2026-03-10)
- [x] Re-check the shared monitoring button tactile component against the user's note that the springy rebound feel has disappeared.
- [x] Restore a visible rebound on release so monitor buttons feel like they compress and lightly pop back, without bringing back the awkward full-screen vertical wobble.
- [x] Run mobile typecheck and document the adjustment.

## Tactile Rebound Review
- Root cause:
  - The shared monitoring buttons still compressed on press, but after the earlier cleanup they no longer had a visible release rebound. That made the controls feel flat compared with the older springier interaction.
- Implementation:
  - Updated [apps/mobile/components/TactilePressable.tsx](C:/coding/gwct/apps/mobile/components/TactilePressable.tsx) so release now uses a two-stage scale animation:
    - compress on press-in
    - lightly overshoot above `1.0` on release
    - settle back to rest with a controlled spring
  - Kept the element anchored in place, so the prior awkward screen-wobble / vertical bob effect does not return.
  - Added `stopAnimation()` before each new press phase so repeated taps do not stack stale spring motion.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## Monitoring Keyboard Bounce Plan (2026-03-10)
- [x] Inspect the monitoring numeric submit paths and confirm that `search` currently reuses the same confirm logic as button taps, with no separate screen-level success feedback.
- [x] Add a reusable screen bounce effect for monitoring pages and trigger it only after successful numeric saves initiated via keyboard `search`.
- [x] Run mobile typecheck and document the adjustment.

## Monitoring Keyboard Bounce Review
- Root cause:
  - The numeric monitoring inputs already used the keyboard `search` action to call the same save path as the visible `Confirm` button, so there was no way to give keyboard-submit its own screen-level success feedback.
- Implementation:
  - Added [apps/mobile/hooks/useScreenBounce.ts](C:/coding/gwct/apps/mobile/hooks/useScreenBounce.ts), a reusable animated `translateY` bounce hook for a brief up/down screen response.
  - Applied it only to monitoring screens with numeric keyboard submit:
    - [apps/mobile/app/monitor-gwct-eta.tsx](C:/coding/gwct/apps/mobile/app/monitor-gwct-eta.tsx)
    - [apps/mobile/app/monitor-gc-remaining.tsx](C:/coding/gwct/apps/mobile/app/monitor-gc-remaining.tsx)
    - [apps/mobile/app/monitor-equipment.tsx](C:/coding/gwct/apps/mobile/app/monitor-equipment.tsx)
  - The bounce is triggered only after a successful save that came from `onSubmitEditing` with the keyboard `search` key. Button taps (`Confirm`, `Cancel`, `Enable`, `Disable`, `+/-`) do not trigger this screen movement.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## Monitoring Keyboard Bounce Tuning Plan (2026-03-10)
- [x] Re-check the current keyboard-submit bounce amplitude after the user reported that it still feels too subtle.
- [x] Increase the screen-bounce travel and rebound so keyboard `search` saves feel closer to the earlier visible wobble, while keeping button-tap behavior unchanged.
- [x] Run mobile typecheck and document the tuning.

## Monitoring Keyboard Bounce Tuning Review
- Adjustment:
  - Tuned [apps/mobile/hooks/useScreenBounce.ts](C:/coding/gwct/apps/mobile/hooks/useScreenBounce.ts) to use a stronger multi-stage wobble on successful keyboard `search` submits:
    - higher upward lift
    - deeper downward rebound
    - one extra settling oscillation before returning to rest
  - Scope remains unchanged: this stronger wobble still applies only to successful numeric keyboard-submit saves on the monitoring pages, not to ordinary button taps.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## Monitoring Bounce Snap Plan (2026-03-10)
- [x] Re-check the tuned keyboard-submit bounce after the user said it still feels too loose and teasing.
- [x] Replace the loose wobble with a single stronger upward snap and direct settle, while keeping the trigger limited to successful keyboard `search` submits.
- [x] Run mobile typecheck and document the retuning.

## Monitoring Bounce Snap Review
- Adjustment:
  - Simplified [apps/mobile/hooks/useScreenBounce.ts](C:/coding/gwct/apps/mobile/hooks/useScreenBounce.ts) from a teasing multi-step wobble into a stronger two-step snap:
    - one large upward kick
    - direct spring return to rest
  - This makes the reaction read as a decisive screen pop instead of a loose oscillation.
- Scope:
  - Trigger scope is unchanged. It still runs only on successful numeric keyboard `search` submits in the monitoring screens.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## Monitoring Value Change Animation Plan (2026-03-10)
- [x] Re-check the current Monitoring numeric-save feedback after the user clarified they want the value-change action itself to animate, not the whole screen.
- [x] Remove the screen-level bounce from the numeric Monitoring screens and attach a local pulse animation to the numeric input controls when their values change.
- [x] Delete the now-unused screen-bounce hook, run mobile typecheck, and document the result.

## Monitoring Value Change Animation Review
- Root cause:
  - The prior implementation interpreted the request as a screen-level save wobble on keyboard submit. That left the actual number field static while the whole page moved, which does not match "숫자를 바꿨을 시에 액션 애니메이션".
- Implementation:
  - Added [apps/mobile/components/ValueChangePulseView.tsx](C:/coding/gwct/apps/mobile/components/ValueChangePulseView.tsx) as a reusable local pulse wrapper for changing numeric controls.
  - Updated the Monitoring numeric editors to animate the input itself whenever its value changes through typing or `+/-` stepping:
    - [apps/mobile/app/monitor-gwct-eta.tsx](C:/coding/gwct/apps/mobile/app/monitor-gwct-eta.tsx)
    - [apps/mobile/app/monitor-gc-remaining.tsx](C:/coding/gwct/apps/mobile/app/monitor-gc-remaining.tsx)
    - [apps/mobile/app/monitor-equipment.tsx](C:/coding/gwct/apps/mobile/app/monitor-equipment.tsx)
  - Removed the old screen-bounce path entirely by deleting [apps/mobile/hooks/useScreenBounce.ts](C:/coding/gwct/apps/mobile/hooks/useScreenBounce.ts).
- Verification:
  - `rg -n "useScreenBounce|triggerBounce|Animated\\.View" apps/mobile`
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## Monitoring Tactile And Tab Reselect Plan (2026-03-10)
- [x] Roll back the just-added numeric input pulse, since the user rejected animating the input control itself.
- [x] Strengthen monitoring button tactile feedback so button taps feel closer to pressure-touch / 3D-touch feedback without reintroducing screen-level wobble.
- [x] Add double-tap on the bottom `Work` and `Status` tabs to scroll those screens back to the top.
- [x] Run mobile typecheck and verify the old pulse path is gone.

## Monitoring Tactile And Tab Reselect Review
- Rollback:
  - Removed the numeric input pulse wrappers from:
    - [apps/mobile/app/monitor-gwct-eta.tsx](C:/coding/gwct/apps/mobile/app/monitor-gwct-eta.tsx)
    - [apps/mobile/app/monitor-gc-remaining.tsx](C:/coding/gwct/apps/mobile/app/monitor-gc-remaining.tsx)
    - [apps/mobile/app/monitor-equipment.tsx](C:/coding/gwct/apps/mobile/app/monitor-equipment.tsx)
  - Deleted the abandoned local input-pulse helper [apps/mobile/components/ValueChangePulseView.tsx](C:/coding/gwct/apps/mobile/components/ValueChangePulseView.tsx).
- Tactile adjustment:
  - Retuned [apps/mobile/components/TactilePressable.tsx](C:/coding/gwct/apps/mobile/components/TactilePressable.tsx) so monitoring buttons compress harder, dim a bit more while pressed, flatten their shadow more aggressively, and pop back faster on release.
- Double-tap scroll-to-top:
  - Added a small tab reselect event bridge in [apps/mobile/lib/tabScrollToTop.ts](C:/coding/gwct/apps/mobile/lib/tabScrollToTop.ts).
  - Wired the custom bottom tab button in [apps/mobile/app/(tabs)/_layout.tsx](C:/coding/gwct/apps/mobile/app/(tabs)/_layout.tsx) to detect a focused-tab double tap on `worktime` and `status-tab`.
  - Registered scroll-to-top handlers in:
    - [apps/mobile/app/(tabs)/worktime.tsx](C:/coding/gwct/apps/mobile/app/(tabs)/worktime.tsx)
    - [apps/mobile/app/equipment.tsx](C:/coding/gwct/apps/mobile/app/equipment.tsx)
- Verification:
  - `rg -n "ValueChangePulseView|useScreenBounce|triggerBounce" apps/mobile`
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## Tab Reselect Fix Plan (2026-03-10)
- [x] Re-check why the newly added Work/Status double-tap scroll-to-top path is not firing on device.
- [x] Replace the fragile custom button `onPress` detection with router-level `tabPress` reselect handling, while keeping the scroll bridge in the screens.
- [x] Run mobile typecheck and document the fix.

## Tab Reselect Fix Review
- Root cause:
  - The first implementation tried to infer tab reselects from the custom `tabBarButton` press handler and its `accessibilityState`. In Expo Router tabs that is not the most reliable source of truth for focused-tab reselect behavior, so the double-tap path could fail even though the screen-side scroll subscription was correct.
- Implementation:
  - Kept the screen-side scroll bridge in:
    - [apps/mobile/app/(tabs)/worktime.tsx](C:/coding/gwct/apps/mobile/app/(tabs)/worktime.tsx)
    - [apps/mobile/app/equipment.tsx](C:/coding/gwct/apps/mobile/app/equipment.tsx)
  - Moved the double-tap detection to router-level `tabPress` listeners in [apps/mobile/app/(tabs)/_layout.tsx](C:/coding/gwct/apps/mobile/app/(tabs)/_layout.tsx), which now:
    - tracks reselect timing for `worktime` and `status-tab`
    - clears the reselect window on other tabs
    - emits scroll-to-top only when the already-focused Work/Status tab is tapped twice within the reselect window
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## YT Header Scroll-To-Top Plan (2026-03-10)
- [x] Confirm that the requested `YT Count` scroll-to-top interaction is on the stack header title, not the bottom tab bar.
- [x] Add a header-title double-tap path for the `yt` screen and wire it to the screen scroll ref.
- [x] Run mobile typecheck and document the result.

## YT Header Scroll-To-Top Review
- Implementation:
  - Added a small header-level scroll bridge in [apps/mobile/lib/headerScrollToTop.ts](C:/coding/gwct/apps/mobile/lib/headerScrollToTop.ts).
  - Replaced the plain `yt` screen title in [apps/mobile/app/_layout.tsx](C:/coding/gwct/apps/mobile/app/_layout.tsx) with a pressable custom header title that detects a quick second tap and emits `scroll-to-top` for the `yt` route.
  - Registered the `yt` screen itself to listen and scroll its `ScrollView` to the top in [apps/mobile/app/yt.tsx](C:/coding/gwct/apps/mobile/app/yt.tsx).
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## Global Header Scroll-To-Top Plan (2026-03-10)
- [x] Expand the one-off `YT Count` header double-tap behavior into a shared pattern for all scrollable screens with visible header titles.
- [x] Generalize the header scroll bridge and wire the stack/tab header titles through a shared double-tap title component.
- [x] Connect each scrollable screen to the new header route key and run mobile typecheck.

## Global Header Scroll-To-Top Review
- Implementation:
  - Generalized [apps/mobile/lib/headerScrollToTop.ts](C:/coding/gwct/apps/mobile/lib/headerScrollToTop.ts) from a `yt`-only bridge into a generic route-keyed header double-tap emitter.
  - Added [apps/mobile/components/HeaderScrollTitle.tsx](C:/coding/gwct/apps/mobile/components/HeaderScrollTitle.tsx) and [apps/mobile/hooks/useHeaderScrollToTop.ts](C:/coding/gwct/apps/mobile/hooks/useHeaderScrollToTop.ts) so header titles and scroll screens use the same path everywhere.
  - Applied header-title double-tap scroll-to-top to the visible-title routes in:
    - [apps/mobile/app/_layout.tsx](C:/coding/gwct/apps/mobile/app/_layout.tsx)
    - [apps/mobile/app/(tabs)/_layout.tsx](C:/coding/gwct/apps/mobile/app/(tabs)/_layout.tsx)
  - Connected the scrollable screens to their route keys, including shared components that serve both tab and stack routes:
    - [apps/mobile/app/vessels.tsx](C:/coding/gwct/apps/mobile/app/vessels.tsx)
    - [apps/mobile/app/cranes.tsx](C:/coding/gwct/apps/mobile/app/cranes.tsx)
    - [apps/mobile/app/equipment.tsx](C:/coding/gwct/apps/mobile/app/equipment.tsx)
    - [apps/mobile/app/yt.tsx](C:/coding/gwct/apps/mobile/app/yt.tsx)
    - [apps/mobile/app/weather.tsx](C:/coding/gwct/apps/mobile/app/weather.tsx)
    - [apps/mobile/app/monitor.tsx](C:/coding/gwct/apps/mobile/app/monitor.tsx)
    - [apps/mobile/app/monitor-gwct-eta.tsx](C:/coding/gwct/apps/mobile/app/monitor-gwct-eta.tsx)
    - [apps/mobile/app/monitor-gc-remaining.tsx](C:/coding/gwct/apps/mobile/app/monitor-gc-remaining.tsx)
    - [apps/mobile/app/monitor-equipment.tsx](C:/coding/gwct/apps/mobile/app/monitor-equipment.tsx)
    - [apps/mobile/app/monitor-yeosu.tsx](C:/coding/gwct/apps/mobile/app/monitor-yeosu.tsx)
    - [apps/mobile/app/(tabs)/worktime.tsx](C:/coding/gwct/apps/mobile/app/(tabs)/worktime.tsx)
    - [apps/mobile/app/(tabs)/settings.tsx](C:/coding/gwct/apps/mobile/app/(tabs)/settings.tsx)
    - [apps/mobile/app/(tabs)/alerts.tsx](C:/coding/gwct/apps/mobile/app/(tabs)/alerts.tsx)
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## YT Driver Peek Transparency Cleanup Plan (2026-03-11)
- [x] Re-check the just-added peek editor against the user's request for a more minimal transparent popup.
- [x] Remove the extra helper copy and make the popup surface feel more like a translucent overlay on top of the driver screen.
- [x] Delete the temporary local video-reference files created for analysis and rerun mobile verification.

## YT Driver Peek Transparency Cleanup Review (2026-03-11)
- Simplified the driver-number quick editor in `apps/mobile/app/yt-master-call.tsx` by removing the `QUICK EDIT` line and the explanatory helper sentence under the input.
- Tightened the popup into a cleaner translucent card so more of the underlying driver screen shows through, with lighter overlay dimming and a softer glass-like surface.
- Deleted the temporary local analysis directory `tasks/video_frames_bug11`; the original user video on `N:` was left untouched.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - `npx expo export --platform ios --output-dir dist-test --clear` in `apps/mobile`

## YT Driver Peek Artifact Removal Plan (2026-03-11)
- [x] Re-check the refined peek popup against the screenshot and identify the exact source of the unrelated oval artifacts.
- [x] Remove the popup-only decorative layers so the translucent card shows only the real driver screen behind it.
- [x] Re-run targeted mobile verification and document the fix.

## YT Driver Peek Artifact Removal Review (2026-03-11)
- Root cause: the translucent quick-edit card still contained two absolutely positioned decorative glow views (`driverEditGlowPrimary`, `driverEditGlowSecondary`) that were intended as highlights but read like fake background objects behind `YT-584` and the cancel button.
- Removed those popup-only glow layers from `apps/mobile/app/yt-master-call.tsx`, so the translucent card now reveals only the actual driver screen underneath.
- Kept the anchored pop animation and the lightweight glass card treatment intact; the fix is limited to removing the misleading artifact layers.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - `npx expo export --platform ios --output-dir dist-test --clear` in `apps/mobile`

## YT Driver Peek Native Menu Tuning Plan (2026-03-11)
- [x] Re-check the quick editor against the user's request for a smaller card with no visible `YT 번호` label.
- [x] Tighten the popup size and retune the motion toward an iOS context-menu-like anchored pop feel.
- [x] Re-run targeted mobile verification and document the result.

## YT Driver Peek Native Menu Tuning Review (2026-03-11)
- Removed the visible `YT 번호` title from the quick editor in `apps/mobile/app/yt-master-call.tsx`, which lets the pop card collapse into a more compact inline editor.
- Reduced the popup width, paddings, input height, and action-button height so the whole editor reads more like a lightweight context menu than a mini form.
- Retuned the open/close animation to a shorter anchored spring with less travel and a tighter overshoot, based on the public iOS context-menu interaction pattern rather than a looser modal pop.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - `npx expo export --platform ios --output-dir dist-test --clear` in `apps/mobile`

## YT Driver Peek Squash Motion Plan (2026-03-11)
- [x] Re-check the current compact quick editor against the user's request for a more elastic `쭈왑 -> 팡` motion feel.
- [x] Retune the popup presentation to use a squash-and-release spring closer to current iOS/context-menu-style microinteraction trends.
- [x] Re-run targeted mobile verification and document the adjustment.

## YT Driver Peek Squash Motion Review (2026-03-11)
- Retuned the quick-edit popup in `apps/mobile/app/yt-master-call.tsx` from a simple uniform scale pop into a two-phase squash animation:
  - a brief compressed phase
  - a short spring release with a small overshoot
  - a fast settle back to rest
- Switched the transform to separate `scaleX` and `scaleY` curves so the card now visibly compresses before opening, which reads closer to the current snappy context-menu style the user described.
- Kept the card compact and titleless from the previous pass; this change is motion-only.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - `npx expo export --platform ios --output-dir dist-test --clear` in `apps/mobile`

## YT Driver Peek Smoothness Fix Plan (2026-03-11)
- [x] Re-check why the new squash motion still reads choppy on-device instead of smooth.
- [x] Remove the abrupt open-phase timing and stop the keyboard autofocus from competing with the popup animation.
- [x] Re-run targeted mobile verification and document the smoothness fix.

## YT Driver Peek Smoothness Fix Review (2026-03-11)
- Root cause: the popup used a very short first-stage timing step and also focused the `TextInput` immediately, so the keyboard started animating while the card itself was still opening. That made the pop feel steppy and laggy on-device.
- Reworked `apps/mobile/app/yt-master-call.tsx` so the popup now opens on a single smoother spring curve, while the `TextInput` focus is delayed briefly until after the visual pop has mostly settled.
- Kept the compact squash feel, but shifted it onto one continuous UI-thread spring with gentler progress interpolation so the motion reads more like one fluid gesture than two stitched phases.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - `npx expo export --platform ios --output-dir dist-test --clear` in `apps/mobile`

## YT Driver Peek Close Smoothness Fix Plan (2026-03-11)
- [x] Re-check whether the remaining close-path jank is caused by popup dismissal and keyboard dismissal happening at the same time.
- [x] Separate the keyboard-hide phase from the popup close phase so save/cancel do not fight the keyboard animation.
- [x] Re-run targeted mobile verification and document the result.

## YT Driver Peek Close Smoothness Fix Review (2026-03-11)
- Root cause: the popup close animation was still starting while the number-pad keyboard was dismissing, so the save/cancel path had the same kind of animation contention that previously affected the open path.
- Updated `apps/mobile/app/yt-master-call.tsx` so close now:
  - clears any pending focus timer
  - blurs/dismisses the keyboard first when needed
  - waits for `keyboardDidHide` or a short fallback timeout
  - only then starts the popup close by flipping `driverEditVisible`
- Applied the same close sequence to backdrop tap, cancel, modal back-close, and successful save so every exit path uses the same smoother shutdown flow.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - `npx expo export --platform ios --output-dir dist-test --clear` in `apps/mobile`

## YT Driver Peek Close Order Reversal Plan (2026-03-11)
- [x] Re-check the close-path implementation after the user asked for the popup to disappear before the keyboard starts dismissing.
- [x] Reverse the shutdown order so the popup visually closes first, then the keyboard dismisses after the popup close animation completes.
- [x] Re-run targeted mobile verification and document the reversed close-order fix.

## YT Driver Peek Close Order Reversal Review (2026-03-11)
- Root cause: the previous close fix still prioritized keyboard dismissal, which reduced contention but did not match the requested visual order.
- Reworked `apps/mobile/app/yt-master-call.tsx` so close now:
  - marks whether the keyboard should be dismissed after close
  - immediately starts the popup close animation by flipping `driverEditVisible`
  - waits for the popup close animation to finish
  - only then blurs/dismisses the keyboard and unmounts the now-invisible modal shortly after
- Removed the earlier `keyboardDidHide -> close popup` dependency and kept keyboard listeners only for visibility tracking, so the popup can lead the shutdown sequence cleanly.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - `npx expo export --platform ios --output-dir dist-test --clear` in `apps/mobile`

## YT Driver Native iPhone Edit Path Plan (2026-03-11)
- [x] Confirm the closest public/native iPhone interaction available in the current Expo/React Native stack for in-app number editing.
- [x] Replace the iPhone custom popup flow with a native iOS editing path while leaving the existing custom fallback in place for non-iOS.
- [x] Re-run targeted mobile verification and document the native-path switch.

## YT Driver Native iPhone Edit Path Review (2026-03-11)
- Switched the `YT Driver` number-edit interaction on iPhone from the custom animated popup to a native iOS path in `apps/mobile/app/yt-master-call.tsx`.
- The long-press flow on iOS now uses:
  - `ActionSheetIOS.showActionSheetWithOptions(...)` for the initial native action menu
  - `Alert.prompt(...)` for native inline number entry
- Kept the existing custom popup path as the fallback for non-iOS platforms, so this change is additive rather than deleting the cross-platform editor.
- Reused a shared `persistDriverYtNumber(...)` helper so both the iPhone native path and the fallback path save through the same registration API and state update logic.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - `npx expo export --platform ios --output-dir dist-test --clear` in `apps/mobile`

## YT Driver Anchored Native Context Menu Plan (2026-03-11)
- [x] Install the Expo native UI package that exposes iOS `ContextMenu` support compatible with this SDK.
- [x] Replace the centered iPhone action sheet path with an anchored native context menu on the top-right driver identity block when the runtime supports it.
- [x] Keep Expo Go / unsupported runtimes on the previous fallback path, then rerun targeted verification.

## YT Driver Anchored Native Context Menu Review (2026-03-11)
- Added `@expo/ui` to the mobile workspace so the app can use the native SwiftUI-backed `ContextMenu` implementation on supported iPhone runtimes.
- Updated `apps/mobile/app/yt-master-call.tsx` so the top-right `YT 번호 / 이름` block now uses an anchored native context menu when:
  - `Platform.OS === "ios"`
  - `Constants.executionEnvironment !== StoreClient`
  - the `@expo/ui/swift-ui` module is available
- The identity block itself is hosted through `RNHostView` inside the native context-menu trigger, so the menu opens near that exact top-right block instead of appearing as a centered action sheet.
- Selecting `YT 번호 변경` from that anchored native menu still uses the existing iPhone-native `Alert.prompt(...)` entry step to capture the new number.
- Expo Go remains on the earlier fallback path because Expo's native UI context menu is not available there.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - `npx expo export --platform ios --output-dir dist-test --clear` in `apps/mobile`
## YT Driver Peek Animation Refinement Plan (2026-03-11)
- [x] Re-check the current long-press driver-number editor and the reference video's popup motion/style.
- [x] Restyle the popup into a darker anchored quick-edit card with a pop-in animation closer to the reference.
- [x] Re-run targeted mobile verification and document the result.

## YT Driver Peek Animation Refinement Review (2026-03-11)
- Refined `apps/mobile/app/yt-master-call.tsx` so the long-press driver-number editor now opens with a short anchored peek-and-pop motion instead of a plain fade modal.
- Kept the edit flow intact while changing the presentation to a dark glass-like quick-edit card with stronger shadow, soft highlight glows, and a dedicated `YT-` input frame.
- Added open/close animation state so the card scales and rises in, then closes cleanly instead of disappearing abruptly.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - `npx expo export --platform ios --output-dir dist-test --clear` in `apps/mobile`

## YT Driver Native Edit Rollback Plan (2026-03-11)
- [x] Re-check the recent native iPhone context-menu additions and isolate only the code needed to revert.
- [x] Restore the earlier custom driver-number popup path while keeping the improved popup-first-close keyboard behavior.
- [x] Remove the now-unused native menu dependency and rerun mobile verification.

## YT Driver Native Edit Rollback Review (2026-03-11)
- Rolled `apps/mobile/app/yt-master-call.tsx` back from the native iPhone menu experiment to the prior custom long-press popup flow.
- Kept the popup close sequence that was already working better:
  - the popup close animation starts immediately
  - the keyboard dismisses only after the popup close finishes
- Removed the temporary native edit branches:
  - `ActionSheetIOS`
  - `Alert.prompt(...)`
  - `@expo/ui` anchored context-menu runtime
- Removed the unused `@expo/ui` dependency from `apps/mobile/package.json` and lockfile.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - `npx expo export --platform ios --output-dir dist-test --clear` in `apps/mobile`

## Repo Cleanup Inspection Plan (2026-03-11)
- [x] Inspect the repository for large temporary/generated artifacts that are not required for runtime or source history.
- [x] Remove only safe cleanup targets such as export output, scratch folders, and obvious transient files.
- [x] Verify what changed and document the cleanup result.

## Repo Cleanup Inspection Review (2026-03-11)
- Checked the repo for large non-runtime artifacts outside source and normal assets.
- Removed safe transient/generated folders:
  - `apps/mobile/dist-test` (`expo export` output, about `8.28 MB`)
  - `apps/mobile/.expo` (local Expo metadata)
  - `node_modules/.cache` (tooling cache, about `38.3 MB`)
- Verified the cleanup by re-checking path existence and ignored-file status.
- Remaining biggest file is still `apps/server/data/dev.db` (`45.33 MB`), which is local server runtime data rather than disposable test output, so it was intentionally kept.

## YT Driver Tractor Subreason Plan (2026-03-11)
- [x] Inspect the current YT Master call reason schema, storage, and render path across shared, mobile, and server layers.
- [x] Add a long-press tractor-inspection subreason picker on the YT Driver screen and persist the selected detail on created calls.
- [x] Show the selected tractor subreason in the driver/master call UI, then run verification and document the result.

## YT Driver Tractor Subreason Review (2026-03-11)
- Extended the shared YT Master call schema with tractor-inspection detail support:
  - fixed tractor detail enum/list
  - optional `reasonDetailCode` / `reasonDetailLabel`
  - shared display formatter for `기본 사유 · 세부 사유`
- Updated the YT Master call service so tractor-inspection calls persist the chosen detail and old stored state still loads safely with `null` defaults.
- Updated the driver screen in `apps/mobile/app/yt-master-call.tsx`:
  - `트랙터 점검` tap still selects the general tractor reason
  - `트랙터 점검` long-press opens a dedicated detail picker modal
  - choosing a detail sets the tractor reason plus the selected detail
  - pending-driver UI now shows the detailed tractor reason when present
- Updated the master queue and create-call push payloads so masters see `트랙터 점검 · 세부 사유` instead of losing the detail.
- Added regression coverage for detailed tractor calls in both service and API tests.
- Verification:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/yt-master-call-service.test.ts tests/yt-master-call-api.test.ts`
  - `npm.cmd --workspace @gwct/server run typecheck`
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## Scrape Cadence Zero-YT Override Plan (2026-03-13)
- [x] Re-check the current cadence governor path that counts active YT logins and identify where a zero-YT override must bypass the existing AND gate and relaxed exit paths.
- [x] Implement a top-priority rule so `ytActiveCount === 0` forces `relaxed` mode regardless of the other three signals or fast-hold state.
- [x] Add focused cadence governor regressions for zero-YT entry and staying relaxed while non-YT login churn continues.
- [x] Run focused verification and record the result.

## Scrape Cadence Zero-YT Override Review (2026-03-13)
- Updated `apps/server/src/services/scrapeCadence/governor.ts` so `ytActiveCount === 0` is now the highest-priority relaxed override once equipment status has been observed.
- The new zero-YT override bypasses both the existing three-signal AND gate and the fast-hold guard, and it also suppresses the relaxed-mode equipment-login exit while YT active logins are still zero.
- Kept the existing behavior that `stopReason` rows are not counted as normal logins, so a stopped YT still contributes to the zero-active-YT relaxed rule exactly as requested.
- Updated `apps/server/tests/scrape-cadence-governor.test.ts` to prove:
  - zero active YT logins now enter relaxed immediately even when schedule/work are not ready
  - support-only churn stays relaxed while YT active logins remain zero
  - a new active YT login still returns the governor to fast mode and re-applies the shift-boundary hold
- Verification:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/scrape-cadence-governor.test.ts`
  - `npm.cmd --workspace @gwct/server run typecheck`

## YT Master Day-Off Month-Day Label Plan (2026-03-12)
- [x] Re-check the shared day-off display format and identify the smallest change needed to drop redundant year text while keeping current-year storage intact.
- [x] Update the shared formatter, mobile day-off picker copy, and focused expectations so selected leave dates display as month/day only.
- [x] Re-run focused verification and record the result.

## YT Master Day-Off Month-Day Label Review (2026-03-12)
- Updated `packages/shared/src/schemas/domain.ts` so `휴무일정` display text now renders selected dates as `MM.DD` and compresses consecutive runs as `MM.DD~MM.DD`.
- Kept the saved raw value unchanged as current-year normalized dates like `2026-03-25,2026-03-26`, so the picker and server validation still work off the full date.
- Updated `apps/mobile/app/yt-master-call.tsx` so the leave-date picker summary no longer repeats the explicit year and only shows the selected-day count.
- Updated focused regressions in:
  - `apps/server/tests/yt-master-call-service.test.ts`
  - `apps/server/tests/yt-master-call-api.test.ts`
  so stored call labels and push text now assert month/day-only display.
- Verification:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/yt-master-call-service.test.ts tests/yt-master-call-api.test.ts`
  - `npm.cmd --workspace @gwct/server run typecheck`
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## YT Master Duplicate Other-Reason Lock Plan (2026-03-12)
- [x] Re-check which `기타 사유` detail codes need shared duplicate-lock classification and where create-call validation currently runs.
- [x] Add a 20-minute same-reason lock for `이적 끝`, `본선 끝`, `교대 셔틀`, and `점심 셔틀`, and return the requested duplicate-delivery message on blocked creates.
- [x] Add focused service/api regressions, verify them, and record the result.

## YT Master Duplicate Other-Reason Lock Review (2026-03-12)
- Added a shared duplicate-lock classification in `packages/shared/src/schemas/domain.ts` for:
  - `교대 셔틀`
  - `이적 끝`
  - `본선 끝`
  - `점심 셔틀`
- Updated `apps/server/src/services/ytMasterCall/service.ts` so creating one of those `기타 사유` calls checks the full stored call history for the same detail code within the last 20 minutes.
- Blocked duplicate creates now return:
  - `같은 사유로 이미 메세지가 도달했습니다.`
- Kept the lock window independent from current queue visibility or resolution state, so it expires by create time and then allows the next call again.
- Added focused regressions in:
  - `apps/server/tests/yt-master-call-service.test.ts`
  - `apps/server/tests/yt-master-call-api.test.ts`
  to assert both the 20-minute block and the unlock after 20 minutes.
- Verification:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/yt-master-call-service.test.ts tests/yt-master-call-api.test.ts`
  - `npm.cmd --workspace @gwct/server run typecheck`
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## YT Master Duplicate-Lock Toast Plan (2026-03-12)
- [x] Re-check how `actionError` is rendered in the mobile YT master-call screen and identify the smallest way to special-case the duplicate-lock text.
- [x] Show the duplicate-lock message as a centered dissolve-style overlay instead of the inline red error text, while leaving other errors unchanged.
- [x] Re-run mobile verification and record the result.

## YT Master Duplicate-Lock Toast Review (2026-03-12)
- Updated `apps/mobile/app/yt-master-call.tsx` so the exact duplicate-lock text:
  - `같은 사유로 이미 메세지가 도달했습니다.`
  now appears as a centered transient toast overlay with fade-in/fade-out motion.
- Kept all other `actionError` cases on their existing inline red text path, so only the duplicate-lock notice changed presentation.
- Added a screen-level overlay container and a small opacity/scale animation driven by `Animated.Value`, without changing the request logic or master/driver data flow.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## YT Master Duplicate-Lock Toast Match Fix Review (2026-03-12)
- The first toast implementation matched the duplicate-lock error with exact-string equality, which could miss live responses if the server text still carried older suffix text or whitespace differences.
- Updated `apps/mobile/app/yt-master-call.tsx` so duplicate-lock detection now uses normalized substring matching before deciding whether to hide the inline error and show the centered toast.
- The centered toast still renders the fixed short sentence:
  - `같은 사유로 이미 메세지가 도달했습니다.`
  even if the backend response contains extra legacy wording.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## Scrape Cadence Meal Relax Override Plan (2026-03-13)
- [x] Re-check the current relaxed-mode governor path and identify where the three-signal rule and the relaxed-to-fast equipment-login exit are enforced.
- [x] Add a separate meal-stop-before-work-start override so relax mode can enter and remain active independently of the existing three aligned idle signals.
- [x] Add focused governor regressions, verify them, and record the result.

## Scrape Cadence Meal Relax Override Review (2026-03-13)
- Updated `apps/server/src/services/scrapeCadence/governor.ts` so `식사`/`식사시간` stop reasons are tracked separately from the existing idle-equipment readiness signal.
- Added a dedicated meal override rule:
  - if meal stop is observed
  - and the current work table is recognized
  - and work progress has not started yet
  - then scrape cadence enters or stays in `relaxed` mode even when the original three idle signals do not all align
- Also changed the relaxed-mode equipment-login exit so meal override still wins until work progress actually starts.
- Added focused regressions in `apps/server/tests/scrape-cadence-governor.test.ts` to cover:
  - entering relaxed mode via the meal override without the three normal ready signals
  - staying relaxed through login churn during meal stop
  - returning to `fast` as soon as work progress starts
- Verification:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/scrape-cadence-governor.test.ts`
  - `npm.cmd --workspace @gwct/server run typecheck`
  - `npx expo export --platform ios --output-dir dist-test --clear` in `apps/mobile`

## YT Driver Tractor Picker Layout Refinement Plan (2026-03-11)
- [x] Re-check the current tractor subreason picker modal and identify why the full-width list wastes space.
- [x] Replace the vertical list with a compact grouped chip layout so related reasons stay physically close.
- [x] Verify the mobile build, document the refinement, and record the layout lesson.

## YT Driver Tractor Picker Layout Refinement Review (2026-03-11)
- Reworked the tractor subreason picker in `apps/mobile/app/yt-master-call.tsx` from a full-width vertical list into grouped wrapped chips.
- Grouped related reasons so similar inspections stay visually near each other:
  - tire / bolt
  - oil / leak / fuel
  - engine / start / cooling
  - cabin / electrical
  - safety / exterior / structure
- Within each group, items are sorted by their Korean labels so the scan order stays predictable while avoiding the wasted height of one-card-per-row.
- Reduced vertical bulk by switching from long horizontal cards to content-width chips and keeping only subtle group captions.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - `npx expo export --platform ios --output-dir dist-test --clear` in `apps/mobile`
  - removed regenerated `apps/mobile/dist-test` after verification

## YT Driver Tractor Label Wording Review (2026-03-11)
- Updated the shared tractor subreason labels in `packages/shared/src/schemas/domain.ts` so these four items now read with `보충`:
  - `엔진오일 보충`
  - `미션오일 보충`
  - `작동유 보충`
  - `파워오일 보충`
- Verification:
  - `npm.cmd --workspace @gwct/server run typecheck`
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## YT Driver Tractor Group Order Review (2026-03-11)
- Adjust the oil/leak/fuel group ordering so the `보충` items stay adjacent and `에어누설` sits last in that cluster.
- Re-run mobile typecheck after the order change.

## YT Driver Tractor Group Order Result (2026-03-11)
- Removed the picker's extra intra-group auto-sort so each tractor group now respects the explicit semantic order defined in `apps/mobile/app/yt-master-call.tsx`.
- Updated the `오일 / 누유 / 연료` cluster so the four `보충` items stay adjacent and `에어누설` renders last in that group.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## YT Driver Safety Group Order Review (2026-03-11)
- Updated the shared `seatbelt` label to `안전벨트 고장` in `packages/shared/src/schemas/domain.ts`.
- Reordered the `안전 / 외관 / 하부` tractor group in `apps/mobile/app/yt-master-call.tsx` to this sequence:
  - `유리창 파손`
  - `탑 틸팅 안됨`
  - `판스프링 3장 이상 파손`
  - `백미러 교체`
  - `백미러 볼트 쪼이기`
  - `안전벨트 고장`
  - `판스프링 이퀄라이저 이탈`
- Verification:
  - `npm.cmd --workspace @gwct/server run typecheck`
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## YT Driver Tractor Picker Packing Plan (2026-03-11)
- [x] Re-check the tractor subreason chip layout with the current grouping and identify where chip order is creating unnecessary extra wrap rows.
- [x] Reorder the grouped chips to pack the modal more tightly without changing chip sizing/typography, and rename `냉각수` to `냉각수 보충`.
- [x] Re-run verification and document the packing-focused layout correction.

## YT Driver Tractor Picker Packing Review (2026-03-11)
- Updated the shared tractor label map so `냉각수` now renders as `냉각수 보충` in every YT Master call surface.
- Kept the chip size and typography intact, but tightened only the picker packing values in `apps/mobile/app/yt-master-call.tsx`:
  - group-to-group gap reduced
  - within-group vertical gap reduced
  - chip wrap gap reduced
- This keeps the same chip design while making the tractor picker noticeably denser so all items are more likely to fit without scrolling.
- Verification:
  - `npm.cmd --workspace @gwct/server run typecheck`
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - `npx expo export --platform ios --output-dir dist-test --clear` in `apps/mobile`
  - confirmed regenerated `apps/mobile/dist-test` was removed after verification

## YT Driver Safety Chip Packing Review (2026-03-11)
- Reordered the `안전 / 외관 / 하부` chip sequence in `apps/mobile/app/yt-master-call.tsx` so `백미러 교체` now sits immediately after `탑 틸팅 안됨` to pack that row more tightly.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## YT Driver Emergency Direct Call Plan (2026-03-11)
- [x] Inspect the current YT Master call reason model and the idle driver-screen layout to place an emergency direct-call affordance cleanly.
- [x] Add a distinct emergency accident reason across shared/server/mobile and wire a red direct-call control that submits immediately.
- [x] Verify driver/master rendering plus targeted tests/typechecks, then document the change.

## YT Driver Emergency Direct Call Review (2026-03-11)
- Added a new shared YT Master call reason `emergency_accident` so the server, live state, and push payloads can all carry a distinct emergency label instead of overloading the normal reason chips.
- Kept the normal driver reason picker focused on selectable reasons and added a separate red `긴급 사고 직접 호출` card under the regular status area in `apps/mobile/app/yt-master-call.tsx`.
- Wired that emergency card to submit immediately without opening the tractor-detail flow, while the master queue now renders the emergency call with a siren icon and emergency-red accent instead of the generic fallback icon.
- Added targeted server regression coverage so emergency calls are verified to:
  - persist with `긴급 사고` as the reason label
  - carry no tractor detail
  - push the emergency body text to master devices
- Verification:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/yt-master-call-service.test.ts tests/yt-master-call-api.test.ts`
  - `npm.cmd --workspace @gwct/server run typecheck`
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - `npx expo export --platform ios --output-dir dist-test --clear` in `apps/mobile`
  - removed regenerated `apps/mobile/dist-test` after verification

## YT Driver Other Detail Reason Plan (2026-03-11)
- [x] Inspect the current shared reason-detail model and the existing long-press picker flow to define how `기타 사유` details should be stored and shown.
- [x] Add grouped `기타 사유` detail options across shared/server/mobile so long-pressing `기타 사유` opens a compact detail picker and the selected detail appears in driver/master views.
- [x] Run targeted server/mobile verification and record the result.

## YT Driver Other Detail Reason Review (2026-03-11)
- Expanded the shared YT Master call detail model in `packages/shared/src/schemas/domain.ts` so `reasonDetailCode` can now carry either:
  - tractor inspection details
  - grouped `기타 사유` details
- Added a new `기타 사유` detail set including:
  - 개인 / 일정
  - GC 캐빈 고발 (`GC181` ~ `GC190`)
  - 노매너 / 고발
  - 위험 / 현장
  - 셔틀 / 작업 종료
- Updated `apps/mobile/app/yt-master-call.tsx` so:
  - tapping `기타 사유` still selects the plain top-level reason
  - long-pressing `기타 사유` opens a grouped chip picker, just like tractor details
  - the chosen detail is shown in the driver's summary text and then sent with the call
- Updated the server YT Master call service so detail labels are resolved generically from the shared helper rather than only from tractor-specific labels.
- Added targeted regression coverage for a detailed `기타 사유` call (`GC181 캐빈 고발`) in both service and API tests, including the push body text sent to master devices.
- Verification:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/yt-master-call-service.test.ts tests/yt-master-call-api.test.ts`
  - `npm.cmd --workspace @gwct/server run typecheck`
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - `npx expo export --platform ios --output-dir dist-test --clear` in `apps/mobile`
  - removed regenerated `apps/mobile/dist-test` after verification

## YT Driver Other Detail Label Packing Plan (2026-03-11)
- [x] Re-check the current `기타 사유` labels and grouped chip rows to identify the shortest wording changes that reclaim space without touching font or chip styling.
- [x] Shorten the requested GC/report/yard labels and adjust only local grouping wording/order if that helps the same chips fit on one screen.
- [x] Run targeted verification and record the correction.

## YT Driver Other Detail Label Packing Review (2026-03-11)
- Shortened the shared `기타 사유` detail labels in `packages/shared/src/schemas/domain.ts` without changing any chip sizing or typography:
  - `GC181 캐빈 고발` ~ `GC190 캐빈 고발` -> `GC181 고발` ~ `GC190 고발`
  - `TC 노매너 고발` / `리치 노매너 고발` / `언더 노매너 고발` -> `TC 고발` / `리치 고발` / `언더 고발`
  - `야드 컨테이너 1열의 1단 돌출` -> `야드 컨테이너 1열 돌출`
- Shortened only the local picker group captions in `apps/mobile/app/yt-master-call.tsx` where it helps density:
  - `GC 캐빈 고발` -> `GC 고발`
  - `노매너 / 고발` -> `고발`
- Kept the chip font, padding, and overall picker design unchanged so the visual system stays the same while the copy takes less space.
- Updated the detailed `기타 사유` server expectations so the stored label and master push body now match the shorter wording.
- Verification:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/yt-master-call-service.test.ts tests/yt-master-call-api.test.ts`
  - `npm.cmd --workspace @gwct/server run typecheck`
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - `npx expo export --platform ios --output-dir dist-test --clear` in `apps/mobile`
  - removed regenerated `apps/mobile/dist-test` after verification

## YT Driver Danger Label Tightening Plan (2026-03-11)
- [x] Re-check the current `위험 / 현장` chip labels and confirm the shortest safe wording change that could pull the row onto one screen without changing chip design.
- [x] Update only the requested danger label text, keeping font size, padding, and chip styling untouched, and adjust expectations if any shared-string checks depend on it.
- [x] Run targeted verification and document the result.

## YT Driver Danger Label Tightening Review (2026-03-11)
- Shortened only the requested shared danger label in `packages/shared/src/schemas/domain.ts`:
  - `야드 컨테이너 1열 돌출` -> `컨테이너 돌출`
- Kept the existing chip font size, chip padding, chip layout, and grouped picker design intact. This change only reclaims width through shorter copy.
- Re-ran the mobile iOS bundle path after the shared string update to confirm the picker still builds cleanly with no design-code changes.
- Verification:
  - `npm.cmd --workspace @gwct/server run typecheck`
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - `npx expo export --platform ios --output-dir dist-test --clear` in `apps/mobile`
  - removed regenerated `apps/mobile/dist-test` after verification

## Vessel Schedule Date Wording Plan (2026-03-11)
- [x] Find the current vessel schedule change formatter that uses different wording when ETA/ETB/ETD shifts across calendar days.
- [x] Simplify the wording so all date/time shifts use the same `종전보다 ...` style regardless of whether the date changed.
- [x] Run targeted verification and record the wording correction.

## Vessel Schedule Date Wording Review (2026-03-11)
- Simplified the shared ETA-change formatter in `packages/shared/src/events/eta.ts` so the human message no longer switches to relative-day wording like `내일로 ...` when the date rolls over.
- `crossedDate` is still preserved in the payload, but the visible message is now always:
  - `종전보다 ... 더 일찍 입항 예정입니다.`
  - `종전보다 ... 더 늦게 입항 예정입니다.`
- Root cause of the user's follow-up was a second path: previously stored ETA adjustment records and older alert payloads were still reusing their saved `humanMessage` strings. Updated `monitorService` and `vessels/liveRows` to re-normalize those older records from `deltaMinutes` at read/decorate time, so existing `어제로 ...` / `내일로 ...` strings no longer leak back into the UI.
- Updated the ETA monitor and vessel live-row regression expectations so next-day changes now assert the unified `종전보다 ...` phrasing instead of the old relative-day copy.
- Verification:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/gwct-eta-monitor.test.ts tests/monitor-service-eta-adjustment.test.ts tests/vessels-live-rows.test.ts`
  - `npm.cmd --workspace @gwct/server run typecheck`
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## YT Driver Detail Summary Reset Plan (2026-03-11)
- [x] Inspect the current driver-side selected-detail summary rendering and the create/cancel success paths to confirm why the gray summary line persists after a call.
- [x] Clear the selected tractor/other detail state after successful call creation and after successful cancel so the inline gray detail line disappears again.
- [x] Run targeted mobile verification and record the correction.

## YT Driver Detail Summary Reset Review (2026-03-11)
- The gray inline detail summary on the driver screen was being rendered from local selection state (`selectedTractorSubreasonCode` / `selectedOtherSubreasonCode`), and those values were not being cleared after a successful create or cancel.
- Updated `apps/mobile/app/yt-master-call.tsx` so successful:
  - `createYtMasterCall(...)`
  - `cancelYtMasterCall(...)`
  now both call the same local detail-reset helper before updating live state.
- This keeps the actual pending/resolved call reason intact in the status card and master queue, but removes the old pre-call helper summary line once the operator has already sent or cancelled the call.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - `npx expo export --platform ios --output-dir dist-test --clear` in `apps/mobile`
  - removed regenerated `apps/mobile/dist-test` after verification

## YT Message-Only Reason Flow Plan (2026-03-11)
- [x] Inspect the current YT Master call status model, driver pending UI, and master approval/rejection flow to find the cleanest place to split approval-type calls from acknowledgement-only message items.
- [x] Implement an acknowledgement-only path for the requested `기타 사유` details so drivers send a one-way message receipt instead of entering pending approval, and masters get a single confirm action that clears the item.
- [x] Run targeted server/mobile verification and document the workflow change.

## YT Message-Only Reason Flow Review (2026-03-11)
- Expanded the shared YT Master call state model in `packages/shared/src/schemas/domain.ts` so selected `기타 사유` detail reasons can enter a `message` handling mode and use `sent -> acknowledged` instead of the normal `pending -> approved/rejected` flow.
- Updated `apps/server/src/services/ytMasterCall/service.ts` so:
  - message-only details are stored as `handlingMode: "message"` and `status: "sent"`
  - driver cancel remains limited to real pending approval calls
  - masters can only `acknowledge` message items, while normal calls still allow only `approved/rejected`
- Updated `apps/server/src/routes/api.ts` so master confirmation of a message-only item:
  - still broadcasts `yt_master_call_changed` for UI refresh
  - does not emit `yt_master_call_resolved`
  - does not send driver approval/rejection push notifications
- Updated `apps/mobile/app/yt-master-call.tsx` so:
  - driver screens show a message receipt card instead of the waiting loader for message-only items
  - those message receipts do not block sending later calls
  - master queue cards show a single `확인` button for message-only items and keep approve/reject only for real decision calls
- Added regression coverage for message-only `기타 사유` creation and acknowledgement in:
  - `apps/server/tests/yt-master-call-service.test.ts`
  - `apps/server/tests/yt-master-call-api.test.ts`
- Verification:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/yt-master-call-service.test.ts tests/yt-master-call-api.test.ts`
  - `npm.cmd --workspace @gwct/server run typecheck`
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - `npx expo export --platform ios --output-dir dist-test --clear` in `apps/mobile`
  - remove regenerated `apps/mobile/dist-test` after verification

## YT Message-Only Container + Wheel Detail Plan (2026-03-11)
- [x] Inspect the current shared YT tractor detail list and the message-only `기타 사유` set to confirm where `바퀴 빠짐` and `컨테이너 돌출` should be wired.
- [x] Add `바퀴 빠짐` to the tractor inspection detail definitions and picker group, and lock `컨테이너 돌출` into the message-only flow with explicit regression coverage.
- [x] Re-run the focused YT server/mobile verification path and record the result.

## YT Message-Only Container + Wheel Detail Review (2026-03-11)
- Added the new tractor inspection detail `바퀴 빠짐` in `packages/shared/src/schemas/domain.ts` so it now exists in:
  - the shared tractor subreason enum
  - the shared tractor subreason option list
  - the shared tractor subreason label map
- Updated the `타이어 / 볼트` tractor picker group in `apps/mobile/app/yt-master-call.tsx` so `바퀴 빠짐` appears alongside the existing tire-related inspection reasons.
- Confirmed `컨테이너 돌출` remains part of the message-only `기타 사유` set and added explicit regression coverage so that flow is now locked in tests instead of only implied by the shared set.
- Added targeted verification cases in:
  - `apps/server/tests/yt-master-call-service.test.ts`
  - `apps/server/tests/yt-master-call-api.test.ts`
  covering:
  - tractor detail storage for `바퀴 빠짐`
  - message-only creation for `컨테이너 돌출`
- Verification:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/yt-master-call-service.test.ts tests/yt-master-call-api.test.ts`
  - `npm.cmd --workspace @gwct/server run typecheck`
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - `npx expo export --platform ios --output-dir dist-test --clear` in `apps/mobile`
  - removed regenerated `apps/mobile/dist-test` after verification

## YT Oil-Leak Label Packing Plan (2026-03-11)
- [x] Re-check the current shared tractor leak labels to confirm which wording change can reclaim width without touching chip design.
- [x] Keep `에어누설` as a no-space label and shorten only `하부 누유` to `하부누유` at the shared source so the chips can pack tighter on one row.
- [x] Run targeted shared/server/mobile verification and record the wording correction.

## YT Oil-Leak Label Packing Review (2026-03-11)
- Re-checked the shared tractor leak labels in `packages/shared/src/schemas/domain.ts` and confirmed `air_leak` was already rendered as the requested no-space `에어누설`.
- Updated only `undercarriage_oil_leak` from `하부 누유` to `하부누유` at the shared label source, leaving chip sizing, font size, and layout code untouched.
- This keeps the existing design intact while reducing label width enough for tighter one-line packing in the oil/leak group.
- Verification:
  - `npm.cmd --workspace @gwct/server run typecheck`
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## YT Oil-Leak Final Width Trim Plan (2026-03-11)
- [x] Re-check whether the leak-group order already places the last two chips as `하부누유 -> 에어...` before changing any layout code.
- [x] Shorten only the shared `air_leak` label to `에어누공`, keeping the existing last-position order and leaving chip design untouched.
- [x] Run targeted type verification and record the final wording correction.

## YT Oil-Leak Final Width Trim Review (2026-03-11)
- Confirmed the `오일 / 누유 / 연료` group in `apps/mobile/app/yt-master-call.tsx` already ends with:
  - `하부누유`
  - `에어...`
  so no picker reordering was needed.
- Updated only the shared `air_leak` label in `packages/shared/src/schemas/domain.ts` from `에어누설` to `에어누공`.
- Left the font, chip size, wrap gap, and all other layout values unchanged. This change relies purely on the shorter label width to help `하부누유` and `에어누공` fit on the same final row.
- Verification:
  - `npm.cmd --workspace @gwct/server run typecheck`
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## YT Oil-Leak Same-Row Packing Plan (2026-03-11)
- [x] Re-check whether the requested final row already has the correct item order and isolate the remaining width problem to copy length rather than layout.
- [x] Tighten only the shared wording needed so `파워오일보충 주유 하부누유 에어누공` can pack onto the same final row without changing chip styling or font.
- [x] Run targeted verification and document the correction.

## YT Oil-Leak Same-Row Packing Review (2026-03-11)
- Re-checked the `오일 / 누유 / 연료` group in `apps/mobile/app/yt-master-call.tsx` and confirmed the last four chips were already ordered correctly for the requested final row:
  - `power_oil`
  - `fueling`
  - `undercarriage_oil_leak`
  - `air_leak`
- That meant the remaining problem was width, not row order. Updated only the shared `power_oil` label in `packages/shared/src/schemas/domain.ts` from `파워오일 보충` to `파워오일보충`.
- Left chip size, font size, padding, gap, and group order untouched. This change relies purely on the shorter label width to help the final four chips fit together on one row.
- Verification:
  - `npm.cmd --workspace @gwct/server run typecheck`
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## YT Tractor Message-Only Detail Plan (2026-03-11)
- [x] Inspect the current shared handling-mode helper and tractor detail definitions to locate the cleanest place to classify message-only tractor subreasons.
- [x] Extend the shared handling-mode logic so the requested tractor details use the message-only flow, then update the affected server/API regression expectations.
- [x] Run focused verification and document the behavior change.

## YT Tractor Message-Only Detail Review (2026-03-11)
- Extended the shared handling-mode source in `packages/shared/src/schemas/domain.ts` with a dedicated tractor message-only set covering:
  - `시동꺼짐`
  - `시동불량`
  - `무전기 불량`
  - `배터리 방전`
  - `블랙박스`
  - `졸음 방지기`
  - `안전벨트 고장`
  - `바퀴 빠짐`
- Updated `getYtMasterCallHandlingMode(...)` so those `tractor_inspection` detail codes now resolve to `handlingMode: "message"` and therefore create calls as `status: "sent"` instead of `pending`.
- The existing driver/master YT UI already consumed `handlingMode` generically, so no additional screen logic was needed:
  - driver shows the message receipt card
  - master shows `확인` instead of `승인/거절`
- Updated regression coverage so tractor message-only behavior is now pinned in:
  - `apps/server/tests/yt-master-call-service.test.ts`
  - `apps/server/tests/yt-master-call-api.test.ts`
- Verification:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/yt-master-call-service.test.ts tests/yt-master-call-api.test.ts`
  - `npm.cmd --workspace @gwct/server run typecheck`
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - `npx expo export --platform ios --output-dir dist-test --clear` in `apps/mobile`
  - removed regenerated `apps/mobile/dist-test` after verification

## YT Message Acknowledgement Driver Feedback Plan (2026-03-11)
- [x] Trace the message-only acknowledgement path to confirm whether the driver receives a resolved event, notification, auto-open, and a visible acknowledged state.
- [x] Update the shared service/API/mobile flow so a master `확인` action notifies the driver, auto-opens `YT Driver` from other screens, and leaves an acknowledged message card on the driver screen.
- [x] Re-run focused server/mobile verification, then clean generated artifacts and document the final behavior.

## YT Message Acknowledgement Driver Feedback Review (2026-03-11)
- Confirmed the original gap came from two places:
  - `yt_master_call_resolved` was only broadcast for `approved/rejected`, so message-only acknowledgements never reused the existing driver-side alert + auto-open path.
  - the YT service hid `acknowledged` calls from the driver's live state, so the driver screen had nothing to render after the master pressed `확인`.
- Updated `apps/server/src/routes/api.ts` so `acknowledged` decisions now:
  - broadcast `yt_master_call_changed` with `type: "acknowledged"`
  - also broadcast `yt_master_call_resolved`
  - dispatch a driver push/local-notification payload titled `메시지 확인`
  - keep `deepLink: "yt-master-call"`, `forcePresentation: true`, and `autoOpen: true`
- Updated `apps/server/src/services/ytMasterCall/service.ts` so the driver's latest call stays visible when its status becomes `acknowledged`, while the master queue still clears acknowledged items.
- Updated `apps/mobile/app/yt-master-call.tsx` so the driver screen renders a dedicated acknowledged card with the copy `메시지가 확인되었습니다.`
- Reused the existing notification route handling in `apps/mobile/app/_layout.tsx`, so when the driver is on another screen the resolved acknowledgement alert can still surface and auto-open `/yt-master-call`.
- Verification:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/yt-master-call-service.test.ts tests/yt-master-call-api.test.ts`
  - `npm.cmd --workspace @gwct/server run typecheck`
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - `npx expo export --platform ios --output-dir dist-test --clear` in `apps/mobile`
  - removed regenerated `apps/mobile/dist-test` after verification

## Relaxed Mode Status Check Plan (2026-03-12)
- [x] Re-read the cadence-governor relaxed gate so the current answer uses the actual `schedule/work/equipment` rules instead of memory.
- [x] Check live evidence from the running server and persisted scrape history to see whether the managed GWCT sources are currently running on relaxed or fast cadence.
- [x] Summarize which relaxed condition is currently blocking the mode, with concrete timestamps and observed watch-window data.

## Relaxed Mode Status Check Review (2026-03-12)
- Reconfirmed from `apps/server/src/services/scrapeCadence/governor.ts` that relaxed mode is still an AND gate:
  - `scheduleSignal.ready`
  - `workSignal.ready`
  - `equipmentSignal.ready`
- Checked the live server at `2026-03-12 18:45~18:46 KST` via `GET /api/monitors/status` and found the current schedule preview starts with two `yellow` watch-window rows:
  - `SAWASDEE PACIFIC`
  - `PEGASUS GRACE`
  so the schedule-side relaxed condition is not satisfied right now.
- Verified persisted `ScrapeRun` timing in `apps/server/data/dev.db` and found all four managed GWCT sources are still running at roughly `2.0s` cadence:
  - `gwct_schedule_list`: avg `2007.2ms`
  - `gwct_work_status`: avg `2006.6ms`
  - `gwct_equipment_status`: avg `2008.4ms`
  - `gwct_gc_remaining`: avg `2007.2ms`
- Because the governor only relaxes when all three signals are ready, the failing schedule signal is enough to keep the entire managed GWCT set in fast mode even if work/equipment look idle.
- Runtime evidence used:
  - `Invoke-WebRequest http://127.0.0.1:4000/api/monitors/status`
  - direct SQLite inspection of `apps/server/data/dev.db` recent `ScrapeRun.startedAt` rows

## YT Driver Fuzzy Registration Plan (2026-03-12)
- [x] Re-check the current YT Master Driver registration flow across mobile/shared/server so the combined-input change lands in one consistent parsing path.
- [x] Replace the separate driver `YT 번호` + `이름` entry with one tolerant combined identity input that can infer number/name from noisy mixed text.
- [x] Add focused regression coverage for messy driver registration input variants, run targeted verification, and record the review.

## YT Driver Fuzzy Registration Review (2026-03-12)
- Reworked `apps/mobile/app/yt-master-call-settings.tsx` so `YT Driver` registration now uses one combined `YT 번호 / 이름` field instead of separate number and name inputs.
- The driver field now accepts loose mixed input such as `600홍길동`, `홍길동600`, `6 00홍 길동`, or `60,0 홍-길.동`, and the save path automatically extracts:
  - digits -> `YT 번호`
  - letters -> driver name
- Added a shared parser in `packages/shared/src/schemas/domain.ts` so both mobile and server use the same normalization rule for noisy driver identity input.
- Updated `apps/server/src/services/ytMasterCall/service.ts` so driver registration storage also normalizes the combined number/name signal before persisting `YT-번호` and the cleaned driver name.
- Added focused regression coverage in `apps/server/tests/yt-master-call-service.test.ts` for the user's messy-input variants and for normalized driver registration persistence.
- Verification:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/yt-master-call-service.test.ts tests/yt-master-call-api.test.ts`
  - `npm.cmd --workspace @gwct/server run typecheck`
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - `npx expo export --platform ios --output-dir dist-test --clear` in `apps/mobile`
  - removed regenerated `apps/mobile/dist-test` after verification

## YT Driver Example Text Plan (2026-03-12)
- [x] Re-check the visible driver registration example text and limit it to the single format the user specified.
- [x] Keep the fuzzy parsing behavior unchanged and update only the displayed example copy.
- [x] Run quick verification and record the result.

## YT Driver Example Text Review (2026-03-12)
- Updated the visible `YT Driver` registration placeholder in `apps/mobile/app/yt-master-call-settings.tsx` from a multi-format example to the single requested example: `예: 600 홍길동`.
- Kept the fuzzy parsing behavior unchanged; this follow-up only narrows the displayed example text.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## YT Registration Keyboard Submit Plan (2026-03-12)
- [x] Re-check the current registration save path so keyboard submit can reuse the exact same logic as the visible `등록` button.
- [x] Wire both the driver combined input and the master name input so pressing the keyboard search/enter key triggers registration immediately.
- [x] Run quick mobile verification and record the result.

## YT Registration Keyboard Submit Review (2026-03-12)
- Updated `apps/mobile/app/yt-master-call-settings.tsx` so both visible registration inputs now submit through the same `saveRole()` path as the `등록` button.
- The `YT Driver` combined input and the `YT Master` name input now both use:
  - `returnKeyType="search"`
  - `onSubmitEditing={() => void saveRole()}`
- Added a small guard in `saveRole()` so keyboard submit does not double-fire while a save or clear action is already in progress.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## YT Emergency Runtime Test Plan (2026-03-12)
- [x] Check the live local server and confirm whether a YT Master is currently registered to receive the test call.
- [x] Register a dedicated test driver profile as `YT-591 / 이송택` on the live API.
- [x] Create a live `긴급 사고` call for that driver and verify it appears in both driver live state and the master's queue.
- [x] Clean up any temporary probe registrations used during the runtime check and record the result.

## YT Emergency Runtime Test Review (2026-03-12)
- Confirmed the local server on `http://127.0.0.1:4000` was reachable and currently had one active master registration:
  - `MASTER-1 / 송일권`
- Registered dedicated test driver device `codex-driver-emergency-20260312-591` as:
  - `YT-591 / 이송택`
- Created live emergency call `yt_master_call_2d920837-4d71-462d-bda1-6db94e0f58fd` with:
  - `reasonCode: "emergency_accident"`
  - `reasonLabel: "긴급 사고"`
  - `status: "pending"`
- Verified the same pending call in both live states:
  - driver `codex-driver-emergency-20260312-591` current call
  - master `송일권` queue
- Current live result after the test:
  - driver pending count: `1`
  - master pending count: `1`
  - master queue contains `YT-591 / 이송택 / 긴급 사고`
- Removed temporary diagnostic registrations `probe-a` and `probe-b` after the check so only the requested test driver/call remains active.

## YT Emergency Message-Only Plan (2026-03-12)
- [x] Re-check where `긴급 사고` currently resolves its handling mode and identify the smallest shared change that flips it from approval-type to message-only.
- [x] Update the shared handling-mode rule so `긴급 사고` uses the same `sent -> acknowledged` flow as other message-only YT reports, and adjust the affected server/API expectations.
- [x] Run targeted verification and record the result.

## YT Emergency Message-Only Review (2026-03-12)
- Updated the shared YT handling-mode classifier in `packages/shared/src/schemas/domain.ts` so top-level `긴급 사고` now resolves to `handlingMode: "message"` instead of `decision`.
- Kept the rest of the stack generic on `handlingMode`, so no special service or UI branch was needed:
  - create path now stores new emergency calls as `status: "sent"`
  - master queue uses the existing single `확인` action for message-only items
  - driver side uses the existing message receipt / acknowledged flow
- Updated the focused YT server regressions in:
  - `apps/server/tests/yt-master-call-service.test.ts`
  - `apps/server/tests/yt-master-call-api.test.ts`
  so emergency calls now assert `handlingMode: "message"` and `status: "sent"`.
- Verification:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/yt-master-call-service.test.ts tests/yt-master-call-api.test.ts`
  - `npm.cmd --workspace @gwct/server run typecheck`
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## YT Emergency Message Runtime Rerun (2026-03-12)
- Re-registered live test driver device `codex-driver-emergency-20260312-591` as `YT-591 / 이송택`.
- Created a fresh live emergency call `yt_master_call_18e287be-1ff0-4e42-82b6-b31b2f3af582`.
- Verified the new runtime behavior is now message-only on the live API:
  - `reasonCode: "emergency_accident"`
  - `handlingMode: "message"`
  - `status: "sent"`
- Verified the same call in both live states:
  - driver `codex-driver-emergency-20260312-591` current call
  - master `송일권` queue
- Current live result:
  - driver pending count: `1`
  - master pending count: `1`
  - master queue contains `YT-591 / 이송택 / 긴급 사고` as a message-only item awaiting `확인`

## YT Spring Runtime Test (2026-03-12)
- After the earlier emergency message was acknowledged and the master queue became empty again, created a fresh live tractor-inspection call for the same test driver:
  - device: `codex-driver-emergency-20260312-591`
  - driver: `YT-591 / 이송택`
  - detail: `spring_break_3plus`
- Created call `yt_master_call_011367d0-e352-4f47-8ee2-5b51ae4e1ce3` with:
  - `reasonCode: "tractor_inspection"`
  - `reasonDetailLabel: "판스프링 3장 이상 파손"`
  - `handlingMode: "decision"`
  - `status: "pending"`
- Verified the same pending call in both live states:
  - driver current call
  - master `송일권` queue
- Current live result:
  - driver pending count: `1`
  - master pending count: `1`
  - master queue contains `YT-591 / 이송택 / 트랙터 점검 · 판스프링 3장 이상 파손`

## YT Message Acknowledged Queue Visibility Plan (2026-03-12)
- [x] Re-check where acknowledged message-only calls are currently filtered out of the master call list.
- [x] Keep acknowledged message-only calls visible in the master queue and update any now-wrong UI copy.
- [x] Run focused verification and record the result.

## YT Message Acknowledged Queue Visibility Review (2026-03-12)
- Updated `apps/server/src/services/ytMasterCall/service.ts` so the master queue no longer filters out `acknowledged` message-only calls. Only `cancelled` items are hidden now.
- Kept queue ordering unchanged:
  - active items (`pending`, `sent`) first
  - resolved items, including `acknowledged`, after that
- Updated `apps/mobile/app/yt-master-call.tsx` driver-side message receipt hint from `반장이 확인하면 자동으로 사라집니다.` to `반장이 확인하면 확인됨으로 표시됩니다.` so the copy matches the new behavior.
- Updated focused regressions in:
  - `apps/server/tests/yt-master-call-service.test.ts`
  - `apps/server/tests/yt-master-call-api.test.ts`
  so acknowledged message-only calls now remain visible in the master queue while `pendingCount` still drops to `0`.
- Verification:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/yt-master-call-service.test.ts tests/yt-master-call-api.test.ts`
  - `npm.cmd --workspace @gwct/server run typecheck`
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## YT Master Queue Control Plan (2026-03-12)
- [x] Re-check the current YT Master call-list state contract, queue ordering, and any existing mobile interaction primitives so sorting, hide, and archive changes can share one coherent model.
- [x] Add persisted queue-visibility actions on the backend for:
  - [x] left-swipe hide from the main master list
  - [x] archive move for eligible reasons only (`트랙터 점검`, `기타 사유`)
  - [x] archive restore support so archived calls are not trapped forever
- [x] Extend the live YT Master payload so the app receives:
  - [x] the active main queue
  - [x] tractor archive items
  - [x] other-reason archive items
- [x] Rework the mobile master list so it supports:
  - [x] newest-first default ordering
  - [x] a three-dot menu with list sort options
  - [x] immediate local re-sorting when the option changes
  - [x] swipe-left hide on main-list cards
  - [x] long-press archive on eligible cards
  - [x] archive viewer surfaces for tractor and other calls
- [x] Update focused YT Master server regressions, run verification, and record the result.

## YT Master Queue Control Review (2026-03-12)
- Added persistent visibility state to YT Master calls in the shared schema and server service:
  - hidden items leave the main master queue
  - archived items move into `tractorInspection` or `other` archive buckets
  - archived calls can be restored back into the live queue
- Reworked `apps/mobile/app/yt-master-call.tsx` so the master screen now:
  - defaults to newest-first ordering
  - exposes a three-dot menu for sort changes and archive entry points
  - re-sorts immediately on selection without waiting for a refetch
  - supports swipe-left hide on main-list cards
  - supports long-press archive on archive-eligible calls
  - shows archive sheets with restore actions for `트랙터 점검` and `기타 사유`
- Kept `화장실` and `긴급 사고` out of archive bins and routed them to swipe-hide only, matching the requested behavior.
- Added focused regressions in:
  - `apps/server/tests/yt-master-call-service.test.ts`
  - `apps/server/tests/yt-master-call-api.test.ts`
  covering hide, archive, restore, and unsupported archive attempts.
- Hardened the YT Master call test store so parallel service/API runs use separate test state files instead of racing on one shared JSON file.
- Verification:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/yt-master-call-service.test.ts tests/yt-master-call-api.test.ts`
  - `npm.cmd --workspace @gwct/server run typecheck`
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - `npx expo export --platform ios --output-dir dist-test --clear`

## YT Master Menu Density Plan (2026-03-12)
- [x] Re-check which menu style controls the vertical spacing between sort options in the master queue settings popover.
- [x] Tighten only the option row height/padding so the checklist feels denser without changing the menu structure.
- [x] Re-run mobile typecheck and record the result.

## YT Master Menu Density Review (2026-03-12)
- Tightened the vertical density of the `호출 목록 설정` sort/archive menu by reducing only the option row height and vertical padding in `apps/mobile/app/yt-master-call.tsx`.
- Left the menu structure, labels, counts, and actions unchanged so the adjustment stays local to spacing only.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## YT Master Swipe Simplification Plan (2026-03-12)
- [x] Re-check how the current master queue card splits swipe-hide and long-press archive.
- [x] Remove long-press archive and route swipe automatically to `보관` for archive-eligible reasons and `삭제` for the rest.
- [x] Re-run mobile typecheck and record the result.

## YT Master Swipe Simplification Review (2026-03-12)
- Removed long-press archive from the master queue card interaction in `apps/mobile/app/yt-master-call.tsx`.
- The swipe action now decides automatically by reason:
  - `트랙터 점검`, `기타 사유` -> `보관`
  - `화장실`, `긴급 사고` -> `삭제`
- Updated the swipe background label to show the actual action (`보관` or `삭제`) per card and updated the on-screen hint to match the simplified behavior.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## YT Master Menu Width Trim Plan (2026-03-12)
- [x] Re-check which popover container styles control the overall width and inner padding of the `호출 목록 설정` card.
- [x] Reduce only the card width and inner padding so the menu footprint shrinks without changing font sizes or interaction flow.
- [x] Re-run mobile typecheck and record the result.

## YT Master Menu Width Trim Review (2026-03-12)
- Reduced the overall footprint of the `호출 목록 설정` popover card in `apps/mobile/app/yt-master-call.tsx` by trimming only:
  - the card `maxWidth`
  - the sheet's horizontal/top/bottom padding
  - the option row's horizontal padding and icon/text gap
- Left fonts, labels, actions, and general visual style unchanged.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## YT Master Sort Menu Rework Plan (2026-03-12)
- [x] Re-check the current `호출 목록 설정` menu and identify the smallest state change that can support `이름 / 종류 / 날짜` plus direction toggles.
- [x] Rework the master queue header/menu so:
  - [x] the overflow button uses horizontal dots
  - [x] the menu title and `정렬 방식` label are removed
  - [x] `이름`, `종류`, `날짜` rows each toggle their own direction when tapped again
  - [x] the main header gets an up/down sort-direction button next to `호출 목록`
  - [x] the archive rows use folder-style archive icons with `YT` / `etc.` labels
- [x] Re-run mobile typecheck and record the result.

## YT Master Sort Menu Rework Review (2026-03-12)
- Reworked `apps/mobile/app/yt-master-call.tsx` so the master sort model is now:
  - sort field: `이름`, `종류`, `날짜`
  - sort direction: per-field toggle state
- Removed the overflow-menu title copy and section heading copy the user called out, and changed the overflow trigger from vertical dots to horizontal dots.
- Added a main-header sort-direction button beside `호출 목록` so operators can flip the current field between:
  - `오름차순 / 내림차순`
  - `최신 항목 순 / 오래된 항목 순`
- Updated the archive entries in the overflow menu to use folder-style icons with short labels:
  - `YT`
  - `etc.`
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## YT Master Header Layout Review (2026-03-12)
- Adjusted the master list header in `apps/mobile/app/yt-master-call.tsx` so:
  - the queue count badge now sits next to `호출 목록`
  - the sort-direction toggle now sits at the far right edge of the header
- Kept the sort behavior itself unchanged and verified with:
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## YT Master Sort Tap Close Review (2026-03-12)
- Updated `apps/mobile/app/yt-master-call.tsx` so tapping `이름`, `종류`, or `날짜` in the overflow sort menu now:
  - applies the sort immediately
  - toggles the same field's direction on repeat taps
  - closes the overflow card immediately after the tap
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## YT Master Menu Width Trim Follow-up Plan (2026-03-12)
- [x] Re-check the remaining menu footprint after the first width reduction and identify which container values still keep the overflow card too wide.
- [x] Reduce the overflow card width more aggressively without touching fonts, icon sizes, or overall menu behavior.
- [x] Re-run mobile typecheck and record the result.

## YT Master Menu Width Trim Follow-up Review (2026-03-12)
- Tightened the overflow card in `apps/mobile/app/yt-master-call.tsx` more aggressively by reducing:
  - modal left padding, so the available card space is narrower
  - menu sheet `maxWidth`
  - menu sheet horizontal/top/bottom padding
  - option-row horizontal and vertical padding
- Left fonts and icon sizes unchanged.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## YT Master Sort Reset Review (2026-03-12)
- Simplified the sort state in `apps/mobile/app/yt-master-call.tsx` to one active field plus one active direction.
- Updated field switching behavior so:
  - repeating the same selected field toggles its direction
  - switching to a different field resets that field to its default direction
    - `이름`, `종류` -> `오름차순`
    - `날짜` -> `최신 항목 순`
- Updated the overflow menu indicator so:
  - only the active field shows a simple left-side check mark
  - only the active field shows the grey direction sublabel
  - inactive fields show just the label
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## YT Master Sort Highlight Review (2026-03-12)
- Removed the blue selected-row background from the overflow sort menu in `apps/mobile/app/yt-master-call.tsx`.
- Kept the active-state cues limited to:
  - the simple left-side check mark
  - the grey direction sublabel on the active row
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## YT Master Day-Off Schedule Date Plan (2026-03-12)
- [x] Re-check the current `기타 사유 > 휴무일정` flow across shared schema, server create handling, and the mobile picker UI.
- [x] Add an attached holiday date value to the YT master-call payload/storage and include it in the displayed reason text.
- [x] Add a simple mobile month/day selection flow that opens when `휴무일정` is chosen and reuses the selected date in the call summary.
- [x] Re-run focused YT master-call tests/typechecks and record the review.

## YT Master Day-Off Schedule Date Review (2026-03-12)
- Extended the shared YT master-call schema in `packages/shared/src/schemas/domain.ts` with `reasonDetailValue` so `기타 사유 > 휴무일정` can carry a concrete date value.
- Added date-aware formatting and validation in the shared layer so:
  - `day_off_schedule` requires a valid `YYYY-MM-DD` date
  - the displayed detail label becomes `휴무일정 YYYY.MM.DD`
  - other reason details still reject stray extra values
- Updated the server create flow in:
  - `apps/server/src/services/ytMasterCall/service.ts`
  - `apps/server/src/routes/api.ts`
  so the selected holiday date is stored on the call, reflected in queue/current-call text, and included in the push raw payload.
- Reworked the mobile driver flow in `apps/mobile/app/yt-master-call.tsx` so tapping `휴무일정` in `기타 사유` opens a compact `월 / 일` selection modal for the current year, then applies that choice back into the selected reason summary before send.
- Added focused regression coverage in:
  - `apps/server/tests/yt-master-call-service.test.ts`
  - `apps/server/tests/yt-master-call-api.test.ts`
  for a dated `휴무일정` call and the outbound push/body text.
- Verification:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/yt-master-call-service.test.ts tests/yt-master-call-api.test.ts`
  - `npm.cmd --workspace @gwct/server run typecheck`
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - `npx expo export --platform ios --output-dir dist-test --clear` in `apps/mobile`

## YT Master Day-Off Modal Fix Plan (2026-03-12)
- [x] Re-check the current `휴무일정` tap path and confirm why the date picker can fail to appear.
- [x] Change the mobile flow so `휴무일정` closes the other-detail modal first, then opens only the date picker modal.
- [x] Re-run mobile verification and record the fix and lesson.

## YT Master Day-Off Modal Fix Review (2026-03-12)
- Root cause in `apps/mobile/app/yt-master-call.tsx`:
  - tapping `휴무일정` tried to open the date picker while the `기타 사유` detail modal was still open
  - that left the flow dependent on stacked React Native `Modal` behavior, which can fail to present the second modal reliably on device
- Fixed the flow so `휴무일정` now:
  - closes the other-detail modal first
  - opens only the date picker modal as the active surface
  - optionally returns to the `기타 사유` picker on cancel only when that picker launched the date modal
- Also wrapped the date-modal close handlers in no-arg lambdas so the mobile typecheck stays aligned with `Modal` / `Pressable` callback signatures.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - `npx expo export --platform ios --output-dir dist-test --clear` in `apps/mobile`

## YT Master Day-Off Range Plan (2026-03-12)
- [x] Re-check the current single-date holiday payload and the mobile date picker flow to identify the smallest clean way to support consecutive days.
- [x] Extend the shared/server/mobile flow so `휴무일정` can store either one date or a consecutive date range and render the right label everywhere.
- [x] Re-run focused YT tests, typechecks, and mobile bundle verification, then record the result.

## YT Master Day-Off Range Review (2026-03-12)
- Extended `packages/shared/src/schemas/domain.ts` so `day_off_schedule` now accepts:
  - one day: `YYYY-MM-DD`
  - consecutive range: `YYYY-MM-DD~YYYY-MM-DD`
- Updated shared label formatting so:
  - single day -> `휴무일정 YYYY.MM.DD`
  - range -> `휴무일정 YYYY.MM.DD~YYYY.MM.DD`
- Kept the server create/store path generic in:
  - `apps/server/src/services/ytMasterCall/service.ts`
  - `apps/server/src/routes/api.ts`
  so the new range value flows through the same `reasonDetailValue` and notification text path without a special branch.
- Reworked the mobile picker in `apps/mobile/app/yt-master-call.tsx` so operators can now choose:
  - `하루`
  - `연속`
  and, in range mode, switch between `시작일` and `마지막일` while the end date is clamped to stay on or after the start date.
- Added focused regressions in:
  - `apps/server/tests/yt-master-call-service.test.ts`
  - `apps/server/tests/yt-master-call-api.test.ts`
  for a consecutive `휴무일정` payload and the resulting push/body text.
- Verification:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/yt-master-call-service.test.ts tests/yt-master-call-api.test.ts`
  - `npm.cmd --workspace @gwct/server run typecheck`
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - `npx expo export --platform ios --output-dir dist-test --clear` in `apps/mobile`

## YT Master Day-Off Multi-Mark Plan (2026-03-12)
- [x] Re-check the just-added range-based holiday flow and identify the smallest change to convert it into multi-date marking instead.
- [x] Replace the range-style `휴무일정` flow with a month/day multi-select flow while keeping shared/server formatting compatible with existing stored single/range values.
- [x] Re-run focused YT tests, typechecks, and mobile bundle verification, then record the result.

## YT Master Day-Off Multi-Mark Review (2026-03-12)
- Reworked `apps/mobile/app/yt-master-call.tsx` so `휴무일정` no longer uses `하루 / 연속` range controls.
- The date modal now works as:
  - choose a month
  - tap as many day chips as needed to mark/unmark leave dates
  - apply the selected set back into the chosen `휴무일정`
- The mobile payload now stores selected dates as a comma-separated normalized list like:
  - `2026-03-25,2026-03-27,2026-04-02`
- Updated `packages/shared/src/schemas/domain.ts` so shared validation/formatting now accepts:
  - single date values
  - comma-separated multi-date values
  - legacy range values for backward-compatible display
- Updated focused YT regressions in:
  - `apps/server/tests/yt-master-call-service.test.ts`
  - `apps/server/tests/yt-master-call-api.test.ts`
  to assert the new multi-date payload and rendered label text.
- Verification:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/yt-master-call-service.test.ts tests/yt-master-call-api.test.ts`
  - `npm.cmd --workspace @gwct/server run typecheck`
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - `npx expo export --platform ios --output-dir dist-test --clear` in `apps/mobile`

## YT Master Day-Off Range Label Plan (2026-03-12)
- [x] Re-check the current multi-date holiday label formatting and identify the smallest shared change that can compress consecutive dates into a `~` range.
- [x] Update shared holiday label formatting so consecutive selected dates display as `시작일~끝일` while non-consecutive dates stay comma-separated.
- [x] Re-run focused verification and record the result.

## YT Master Day-Off Range Label Review (2026-03-12)
- Updated `packages/shared/src/schemas/domain.ts` so comma-separated `휴무일정` date lists are now formatted into consecutive segments before display.
- The shared formatter now renders examples like:
  - `2026-03-25,2026-03-26,2026-03-27,2026-04-02`
  - -> `2026.03.25~2026.03.27, 2026.04.02`
- Kept the saved raw value as the normalized comma-separated list, so the mobile multi-mark picker model did not need to change again.
- Updated focused regressions in:
  - `apps/server/tests/yt-master-call-service.test.ts`
  - `apps/server/tests/yt-master-call-api.test.ts`
  so both stored call labels and push bodies now assert the compressed `~` display for consecutive dates.
- Verification:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/yt-master-call-service.test.ts tests/yt-master-call-api.test.ts`
  - `npm.cmd --workspace @gwct/server run typecheck`
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## Bottom Tab SVG Crane Plan (2026-03-13)
- [x] Inspect the provided `c:\yadong\반장\5.svg` asset and confirm the current 4th bottom-tab icon wiring.
- [x] Add the SVG rendering support needed by the mobile app and create a tab icon component that preserves the provided crane geometry.
- [x] Update the 4th bottom tab to use the provided SVG icon with the visible label `Cranes`, then run focused mobile verification and document the result.

## Bottom Tab SVG Crane Review (2026-03-13)
- Added `react-native-svg` to `apps/mobile/package.json` so the mobile app can render the provided local SVG asset directly.
- Added `apps/mobile/components/CranesTabSvgIcon.tsx` using the exact path/shape data from `c:\yadong\반장\5.svg`, while letting the stroke/fill tint follow the tab's active/inactive color.
- Updated `apps/mobile/app/(tabs)/_layout.tsx` so the 4th bottom tab now renders that SVG icon and shows the visible label `Cranes`.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - `npx expo export --platform ios --output-dir dist-test --clear` in `apps/mobile`

## Bottom Tab SVG Crane Weight Follow-up Plan (2026-03-13)
- [x] Re-check why the provided SVG icon still reads weaker than the other bottom-tab icons after direct wiring.
- [x] Increase the same SVG's stroke and small filled details so the crane reads closer in weight to the other tab icons without changing the overall design.
- [x] Re-run focused mobile verification and record the result.

## Bottom Tab SVG Crane Weight Follow-up Review (2026-03-13)
- Updated `apps/mobile/components/CranesTabSvgIcon.tsx` so the same provided SVG now renders with heavier visual weight instead of the original thin line-art look.
- Increased the main crane stroke from `6` to `14`, enlarged the hook circle, softened the container corner radius slightly, and widened the container's inner vertical bars so the icon reads closer to the filled bottom-tab icons around it.
- Kept the geometry, tint-following behavior, route wiring, and visible `Cranes` label unchanged.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - `npx expo export --platform ios --output-dir dist-test --clear` in `apps/mobile`

## Crane Status Redesign Plan (2026-03-13)
- [x] Re-check the current `apps/mobile/app/cranes.tsx` data shape and confirm which live values can support the reference design.
- [x] Rebuild the Crane Status screen around a reference-style top overview, map/list toggle, terminal hero panel, summary board, and redesigned crane cards.
- [x] Run focused mobile verification and record the result.

## Crane Status Redesign Review (2026-03-13)
- Rebuilt `apps/mobile/app/cranes.tsx` from a plain live-row list into a reference-style `Terminal Overview` screen with a custom top header, `Map View / List View` toggle, updated stamp row, and richer card rhythm.
- Added a custom SVG berth illustration that mirrors the provided layout more closely by rendering yard stacks, a crane line, water, and a vessel silhouette using the actual crane work-state colors.
- Changed the data presentation model so the mobile screen groups `/api/cranes/live` rows per GC, aggregates remaining/discharge/load totals for multi-vessel cranes, and derives progress/summary values from those grouped cards instead of showing duplicate raw rows.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - `npx expo export --platform ios --output-dir dist-test --clear` in `apps/mobile`

## Crane Status Map Card Follow-up Plan (2026-03-13)
- [x] Re-check whether the apparent discharge/load mismatch comes from the server parser or from the mobile card formatting logic.
- [x] Shrink only the map-view GC cards so they keep the progress ring, updated stamp, and vessel count but show only remaining numeric values for `Remaining / Discharging / Loading`.
- [x] Re-run focused mobile verification and record the result.

## Crane Status Map Card Follow-up Review (2026-03-13)
- Checked the live `http://www.gwct.co.kr:8080/dashboard/?m=F&s=A` HTML again and re-ran the current parsers against it. The server-side parser still matches the page's `잔량` rows correctly; for example the live `GC185` parse resolves to `11 / 43 / 54`, and the aggregate `gwct_gc_remaining` snapshot matches that.
- The visible mismatch came from the mobile map cards, which were rendering `Discharging` and `Loading` as `합계(done) / total` style values derived from `dischargeDone` and `loadDone` instead of showing the `잔량` values the operators expect from that screen.
- Updated `apps/mobile/app/cranes.tsx` so map-view cards are much shorter and now keep only:
  - GC pill + status dot
  - progress ring
  - `Remaining`, `Discharging`, `Loading` with remaining counts only
  - footer `Updated` stamp + vessel count
- Left the richer copy intact for list view only.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - `npx expo export --platform ios --output-dir dist-test --clear` in `apps/mobile`

## Crane Status Remaining Alignment Follow-up Plan (2026-03-13)
- [x] Re-check the live GWCT `본선현황작업` table structure and confirm whether GC totals should come from `잔량` or `잔량 소계`.
- [x] Update the server parser/snapshot path and both map/list mobile cards so `Remaining / Discharging / Loading` all reflect remaining values only, while map cards drop the percent text and status dot.
- [x] Run focused parser tests, server/mobile typechecks, live HTML verification, and mobile export verification.

## Crane Status Remaining Alignment Follow-up Review (2026-03-13)
- Re-checked the current live `http://www.gwct.co.kr:8080/dashboard/?m=F&s=A` page and confirmed the real structure is:
  - `잔량` row: per-GC `양하 잔량 / 적하 잔량`
  - `잔량 소계` row: per-GC total remaining
- Root causes:
  - mobile list cards still showed `done / total` style values, so the user saw the wrong numbers in list view even after the earlier map-only cleanup
  - server parsing/persisting still derived `totalRemaining` by summing `양하 잔량 + 적하 잔량` instead of explicitly preferring the page's `잔량 소계` row
- Updated:
  - `apps/server/src/parsers/gwct.ts` to parse and prefer `잔량 소계` for `totalRemaining`
  - `apps/server/src/services/monitorService.ts` to persist parser-provided `totalRemaining` as `remainingSubtotal`
  - `apps/mobile/app/cranes.tsx` so both map/list cards show remaining counts only, and map cards remove the status dot and percent text while keeping the progress ring
- Verification:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/gc-parser.test.ts tests/gwct-work-status-parser.test.ts`
  - `npm.cmd --workspace @gwct/server run typecheck`
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - live HTML verification against the current GWCT page: `LIVE_OK checked=10`
  - `npx expo export --platform ios --output-dir dist-test --clear` in `apps/mobile`

## Crane Status Empty-State Cleanup Plan (2026-03-13)
- [x] Remove the remaining circular gauge from map-view GC cards.
- [x] Change missing `Remaining / Discharging / Loading` values from `-` to an empty display.
- [x] Re-run focused mobile verification and record the result.

## Crane Status Empty-State Cleanup Review (2026-03-13)
- Updated `apps/mobile/app/cranes.tsx` so map-view GC cards no longer render the circular progress gauge at all.
- Changed the shared mobile metric formatter for this screen so missing GC values now render as an empty string instead of `-`, which removes the placeholder dash in both map and list cards.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - `npx expo export --platform ios --output-dir dist-test --clear` in `apps/mobile`

## Crane Status Percentage Verification Plan (2026-03-13)
- [x] Re-check the current summary/card percent formulas against the live GWCT `본선현황작업` table values.
- [x] Fix any formula path that does not exactly reflect `합계` versus remaining values from the live page.
- [x] Re-run focused verification and record the result.

## Crane Status Percentage Verification Review (2026-03-13)
- Verified the current summary formulas in `apps/mobile/app/cranes.tsx` against the live GWCT page by re-parsing the current `본선현황작업` HTML and reproducing the screen's percentage math.
- Found one issue during verification: when a GC had a known `잔량 소계` and one side of `양하 잔량 / 적하 잔량` was blank, the mobile summary was treating that blank as unknown instead of inferring `0`, which made `양하 퍼센트` fall back incorrectly.
- Updated `apps/mobile/app/cranes.tsx` so summary percentage math now normalizes a missing side to `0` when the other side and `잔량 소계` make that exact split determinable.
- Live verification after the fix produced:
  - overall percent: `74%`
  - discharge percent: `100%`
  - load percent: `65%`
  - active GC card progress: `GC185 72%`, `GC186 74%`, `GC187 75%`
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - live GWCT formula replay via `npx tsx` against `http://www.gwct.co.kr:8080/dashboard/?m=F&s=A`
  - `npx expo export --platform ios --output-dir dist-test --clear` in `apps/mobile`

## Crane Status Progress Semantics Fix Plan (2026-03-13)
- [x] Re-check whether the `75%` app progress came from using the wrong GWCT table row for completed work.
- [x] Update the GWCT work-status parser so `dischargeDone/loadDone` come from the page's `완료` row instead of the `합계` row, then keep the existing remaining/subtotal path intact.
- [x] Re-run focused parser tests, typechecks, and live formula verification.

## Crane Status Progress Semantics Fix Review (2026-03-13)
- Root cause of the large progress error was confirmed in `apps/server/src/parsers/gwct.ts`: the parser was filling `dischargeDone` / `loadDone` from the page's `합계` row, so the app was effectively computing progress as `합계 / (합계 + 잔량)` instead of `완료 / (완료 + 잔량)` or `완료 / 합계`.
- Updated the parser so `dischargeDone` / `loadDone` now come from the `완료` row while `dischargeRemaining` / `loadRemaining` still come from `잔량` and `totalRemaining` still prefers `잔량 소계`.
- This means:
  - remaining-count detection still follows the same live source path as before the redesign (`/api/cranes/live` backed by `gwct_gc_remaining`, `gwct_work_status`, `gwct_equipment_status`)
  - only the progress/completion semantics changed, because the previous implementation was reading the wrong row for `done`
- Current live verification after the parser fix produced:
  - `합계`: 양하 `96`, 적하 `196`
  - `완료`: 양하 `96`, 적하 `105`
  - `잔량 소계`: `91`
  - derived overall progress: `201 / (201 + 91) = 69%`
- Verification:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/gwct-work-status-parser.test.ts tests/gc-parser.test.ts`
  - `npm.cmd --workspace @gwct/server run typecheck`
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - live GWCT formula replay via `npx tsx` against `http://www.gwct.co.kr:8080/dashboard/?m=F&s=A`

## Crane Status Progress Follow-up Plan (2026-03-13)
- [x] Re-verify that summary `Discharged` and `Loaded` percentages still use `완료 / (완료 + 잔량)` against the current live GWCT table.
- [x] Remove the extra status dot above the ring gauge in list-view GC cards.
- [x] Run focused mobile verification and record the result.

## Crane Status Progress Follow-up Review (2026-03-13)
- Replayed the current live `http://www.gwct.co.kr:8080/dashboard/?m=F&s=A` work-status table through the same parser and mobile summary math.
- Confirmed the summary percentages are already correct and do not need code changes:
  - `overallPercent = (dischargeDone + loadDone) / ((dischargeDone + loadDone) + totalRemaining)`
  - `dischargePercent = dischargeDone / (dischargeDone + dischargeRemaining)`
  - `loadPercent = loadDone / (loadDone + loadRemaining)`
- Current live verification at check time produced:
  - `완료`: 양하 `96`, 적하 `123`
  - `잔량`: 양하 `0`, 적하 `73`
  - `잔량 소계`: `73`
  - derived percentages: overall `75%`, discharge `100%`, load `63%`
- Updated `apps/mobile/app/cranes.tsx` to remove the list-view status dot above the ring gauge while leaving the ring itself and the compact map cards unchanged.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - live GWCT formula replay via `npx tsx` against `http://www.gwct.co.kr:8080/dashboard/?m=F&s=A`

## Crane Status Percent Rounding Plan (2026-03-13)
- [x] Audit the mobile crane percentage display helper for any rounding-up behavior.
- [x] Change percentage display so crane progress never rounds up before real completion.
- [x] Re-run focused verification for edge-case percentages and mobile typecheck.

## Crane Status Percent Rounding Review (2026-03-13)
- Confirmed the crane screen percentage display was still using `Math.round`, which could show `11%` for `10.999...` and `100%` for `99.5%` style values.
- Updated `apps/mobile/app/cranes.tsx` so the shared crane percentage clamp now uses `Math.floor` instead.
- This means:
  - `10.999...%` displays as `10%`
  - `99.999...%` displays as `99%`
  - exact `100%` still displays as `100%`
- Verification:
  - edge-case formula replay via `node` for `10.999999999999`, `99.999999999999`, and exact `100`
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## Crane Status Three-State UI Plan (2026-03-13)
- [x] Audit every mobile presentation path that still exposes `Attention`, `Checking`, or `Unknown`.
- [x] Collapse visible crane-state presentation to `Working / Scheduled / Idle` while keeping the underlying server work-state logic intact.
- [x] Re-run focused mobile verification and record the new grouping behavior.

## Crane Status Three-State UI Review (2026-03-13)
- Updated `apps/mobile/app/cranes.tsx` so the crane screen now presents only three visible statuses:
  - `Working`
  - `Scheduled`
  - `Idle`
- Internal server/live row states remain unchanged (`active`, `scheduled`, `checking`, `unknown`, `idle`), but the mobile presentation now folds:
  - `checking -> Scheduled`
  - `unknown -> Scheduled`
- Applied that folding consistently to:
  - summary chip counts
  - card badge colors and labels
  - card status hint copy
  - map illustration palette colors
- Removed the separate `Attention` summary chip entirely.
- Verification:
  - searched `apps/mobile/app/cranes.tsx` to confirm no remaining `Attention` / `Checking` presentation strings
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## Crane Status Idle Mapping Follow-up Plan (2026-03-13)
- [x] Verify why empty non-working cranes were still surfacing as `Scheduled` after the three-state UI change.
- [x] Update the mobile display-state mapping so empty `unknown` cranes with no crew and no live work evidence render as `Idle`.
- [x] Re-run focused verification against the current live GC rows and mobile typecheck.

## Crane Status Idle Mapping Follow-up Review (2026-03-13)
- Root cause: current live rows for `GC181-184` and `GC188-190` were still internal `unknown` because the GWCT sources had no remaining/work row data for them, but the mobile three-state helper was folding every non-`active` and non-`idle` state into `Scheduled`.
- Updated `apps/mobile/app/cranes.tsx` so display-state mapping now treats an internal `unknown` row as `Idle` when all of the following are true:
  - no crew is assigned
  - no vessel is attached
  - no done values exist
  - no remaining values exist
- This keeps real queued work as `Scheduled` while letting truly empty cranes render as `Idle`.
- Live verification after the fix showed:
  - `GC185-187`: `Scheduled`
  - `GC181-184`, `GC188-190`: `Idle`
  - displayed summary counts: `Working 0 / Scheduled 3 / Idle 7`
- Verification:
  - live GWCT replay via `npx tsx` using the current parser + live-row builder + mobile display-state rules
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## Crane Status Map Berth Order Plan (2026-03-13)
- [x] Re-check the current map-view berth order used for GC181~190.
- [x] Update the map illustration so the visual order is `GC190` on the far left through `GC181` on the far right.
- [x] Re-run focused verification to confirm active cranes color the corrected physical slots.

## Crane Status Map Berth Order Review (2026-03-13)
- Updated `apps/mobile/app/cranes.tsx` so the map illustration now uses a dedicated reversed berth order for rendering only:
  - leftmost berth position: `GC190`
  - rightmost berth position: `GC181`
- Live row matching still keys by actual `gcNo`, so active/scheduled colors now land on the correct physical crane slots instead of the mirrored positions.
- With the current live state where `GC185-187` have remaining work, the active map coloring now falls on the reversed berth positions that correspond to those crane numbers.
- Verification:
  - inspected the map render path and confirmed the berth array now uses reversed GC order
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## Crane Status View Memory Plan (2026-03-13)
- [x] Inspect how the `Map View / List View` toggle is currently stored on the cranes screen.
- [x] Preserve the user's last selected cranes view across screen re-entry instead of resetting to `Map View` on every mount.
- [x] Run focused mobile verification and record the behavior change.

## Crane Status View Memory Review (2026-03-13)
- Root cause: `apps/mobile/app/cranes.tsx` initialized `viewMode` with a hard-coded `useState("map")`, so every remount of the screen reset the segmented control back to `Map View`.
- Updated the cranes screen to keep the last selected view mode in module scope and use that as the next screen-mount default.
- Result:
  - switch to `List View`, leave the screen, and return: it stays on `List View`
  - switch back to `Map View`, leave the screen, and return: it stays on `Map View`
- Verification:
  - inspected the cranes screen state path to confirm the mount default now comes from the remembered selection instead of a hard-coded `"map"`
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## Crane Status Done-Carry Progress Fix Plan (2026-03-13)
- [x] Reproduce the current progress mismatch by comparing raw GWCT work-status rows against the server live-row builder and mobile percentage math.
- [x] Fix the live-row builder so completed GC done values are preserved even after the same GC's remaining reaches zero.
- [x] Add regression coverage and re-run focused server/mobile verification plus live replay.

## Crane Status Done-Carry Progress Fix Review (2026-03-13)
- Root cause: `apps/server/src/services/gc/workState.ts` was building live rows only from positive-remaining work-status rows, so once a GC's remaining reached `0` its `완료` values were dropped from the live API even though those completed moves still belong in total progress.
- Updated the live-row builder to:
  - keep informative work rows that still carry `dischargeDone/loadDone` even when remaining is no longer positive
  - infer `totalRemaining = 0` for done-only rows with no remaining snapshot
  - roll completed done totals into the single GC live row when only one active row remains for that GC
- Added regression coverage in `apps/server/tests/gc-work-state.test.ts` for:
  - a fully completed GC that must retain its done totals at `remaining = 0`
  - a GC that still has one remaining row but also needs done totals from a completed row on the same crane
- Live replay after the fix produced:
  - `dischargeDone = 96`
  - `loadDone = 194`
  - `totalRemaining = 2`
  - derived overall progress: `290 / (290 + 2) = 99%`
- Verification:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/gc-work-state.test.ts tests/gc-assignment-store.test.ts tests/gwct-work-status-parser.test.ts`
  - `npm.cmd --workspace @gwct/server run typecheck`
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - live GWCT replay via `npx tsx` against `http://www.gwct.co.kr:8080/dashboard/?m=F&s=A`

## Crane Status Recent-Complete Map Highlight Plan (2026-03-13)
- [x] Add a map-view-only highlight for cranes that have just transitioned from work-in-progress to idle.
- [x] Keep that highlight red for about 5 minutes, then let the crane fall back to the normal idle color.
- [x] Re-run focused mobile verification and a transition-window simulation.

## Crane Status Recent-Complete Map Highlight Review (2026-03-13)
- Updated `apps/mobile/app/cranes.tsx` so the map view now remembers recent crane completions in runtime memory.
- Behavior:
  - when a crane transitions from a non-idle display state to `Idle`, its map crane silhouette turns red
  - that red highlight lasts for `5 minutes`
  - after the window expires, the crane falls back to the normal idle palette
  - if the same crane starts working again before the window ends, the red highlight is cleared immediately
- Scope:
  - applied only to the map-view crane silhouette colors
  - list cards, summary chips, and yard/ship colors keep their existing logic
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - transition-window simulation via `node` confirmed:
    - completion mark exists at transition time
    - still present at `+4 minutes`
    - removed at `+6 minutes`

## Crane Status Recent-Complete Card Ordering Plan (2026-03-13)
- [x] Reuse the recent-completion window so newly completed crane cards stay at the top temporarily.
- [x] Keep those cards pinned only during the same 5-minute window, then return them to the normal GC ordering.
- [x] Update discharge/load summary meter colors and run focused mobile verification.

## Crane Status Recent-Complete Card Ordering Review (2026-03-13)
- Updated `apps/mobile/app/cranes.tsx` so crane cards now use a display-only sort that promotes recently completed cranes to the top while they are inside the existing 5-minute completion window.
- After the 5-minute window expires, those cranes fall back to the normal card order again, which keeps the idle group in GC order.
- Changed the summary progress meter colors to:
  - `Discharged`: yellow
  - `Loaded`: orange
- Left the overall/completion ring colors unchanged.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - `node` sort replay confirmed recent-complete cards sort ahead of the base order and drop back once the recent set is empty

## Crane Status Initial Idle-Complete Promotion Follow-up Review (2026-03-13)
- Root cause of the remaining issue: the recent-completion list was only populated when the screen observed a live `non-idle -> idle` transition, so cranes that were already idle-complete when the user first opened the screen still stayed in the normal bottom idle block.
- Updated `apps/mobile/app/cranes.tsx` so an idle card is also promoted into the 5-minute recent-completion bucket on first observation when all of the following are true:
  - display state is `Idle`
  - `totalRemaining === 0`
  - `totalDone > 0`
- This lets already-finished cranes like `GC185` / `GC187` surface immediately at the top on first entry, while still expiring back to the normal order after the shared 5-minute window.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - `node` first-observation simulation confirmed `GC185` and `GC187` are inserted into the recent set immediately while `GC186` stays out

## Crane Status Shared Recent-Timing Check Review (2026-03-13)
- Re-checked the current mobile implementation to confirm the map crane highlight and card-top promotion are driven by the exact same recent-completion source of truth.
- Verified:
  - the 5-minute recent window is defined once in `apps/mobile/app/cranes.tsx`
  - the shared `recentCompletionCraneIds` set is built once from that window
  - card ordering uses that shared set through `sortCraneCardsForDisplay(...)`
  - the map crane palette also uses that same shared set inside `TerminalMapIllustration`
- Result: start timing and expiry timing are already identical for the map red crane highlight and the card top-promotion behavior because both read from the same `recentCompletionCraneIds` set.
- No additional code change was required for this check.

## Crane Status Four-Tier Card Sort Plan (2026-03-13)
- [x] Replace the current recent-complete-first card sort with the explicit priority order requested by operations.
- [x] Keep GC number ordering within each priority bucket.
- [x] Run focused mobile verification and a sort replay that proves the four-tier order.

## Crane Status Four-Tier Card Sort Review (2026-03-13)
- Updated `apps/mobile/app/cranes.tsx` so crane cards now sort with one explicit display rank:
  - `1. Working`
  - `2. Scheduled`
  - `3. Recent-complete Idle`
  - `4. General Idle`
- Within each bucket, cards now fall back to `GC181 -> GC190` order.
- This means recent-complete idle cards no longer outrank active or scheduled cranes.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - `node` sort replay confirmed:
    - active cards stay first
    - scheduled cards stay second
    - recent-complete idle cards come after scheduled
    - remaining idle cards stay last in GC order

## Crane Status Same-GC Split Card Order Plan (2026-03-13)
- [x] Stop collapsing same-GC multi-vessel live rows into one rendered card when the user wants the scheduled vessel shown in its own lower-priority slot.
- [x] Keep summary chips and berth-map coloring crane-grouped so one GC still drives one map crane and one summary state.
- [x] Verify the new display ordering with a focused sort replay and mobile typecheck, then document the outcome.

## Crane Status Same-GC Split Card Order Review (2026-03-13)
- Updated `apps/mobile/app/cranes.tsx` to separate crane-level aggregation from rendered list cards:
  - summary chips, hero vessel text, recent-completion timing, and berth-map coloring still use one grouped card per GC
  - rendered map/list cards now use one card per live row so the same GC can appear in different status buckets
- Result:
  - if `GC184` has one `Working` vessel row and one `Scheduled` vessel row, those now render as two cards
  - the `Working` card stays in the working block
  - the `Scheduled` card falls into the scheduled block instead of staying glued to the working card just because the GC number matches
- Added stable per-row `cardKey` values so duplicate same-GC cards render without React key collisions.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - focused `node` sort replay confirmed ordering like:
    - `GC183 active`
    - `GC184 active`
    - `GC184 scheduled`
    - `GC190 idle`

## Crane Status Zero-Work Progress Bug Plan (2026-03-13)
- [x] Compare current GWCT `본선작업현황` live values against the `/api/cranes/live` payload and mobile summary math to isolate why queued-only work is rendering as `20%`.
- [x] Fix the incorrect carry-over or fallback path so progress stays `0%` until the live `완료` rows actually increase.
- [x] Run focused verification against the current live snapshot shape plus type/tests, then record the review.

## Crane Status Zero-Work Progress Bug Review (2026-03-13)
- Root cause was cross-source skew, not the live GWCT parser itself.
  - Replaying the current live `http://www.gwct.co.kr:8080/dashboard/?m=F&s=A` HTML through `parseGwctWorkStatus(...)` produced only queued rows with `dischargeDone/loadDone = null`.
  - The bad `20%` came from `/api/cranes/live` combining a newer `gwct_gc_remaining` snapshot with an older `gwct_work_status` snapshot whose completed `POS QINGDAO` rows were still in the DB.
- Updated `apps/server/src/services/gc/workState.ts` so `buildGcCraneLiveRows(...)` now drops `gwct_work_status` rows entirely when their capture time is too far away from the GC remaining snapshot, instead of mixing incompatible generations and inflating `done`.
- Added a regression test in `apps/server/tests/gc-work-state.test.ts` that proves a much newer GC snapshot plus an older done-only work-status row now yields `done = null` and `0%` progress.
- Verification:
  - replayed the current live GWCT HTML through the parser and confirmed current rows are queued-only with no completed counts
  - `npm.cmd --workspace @gwct/server run test -- --run tests/gc-work-state.test.ts`
  - `npm.cmd --workspace @gwct/server run typecheck`
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - local reproduction using current latest snapshots now reports `totalDone: 0`, `overallPercent: 0`

## Crane Status Recent-Complete Black Marker Plan (2026-03-13)
- [x] Change the shared recent-completion window from 5 minutes to 1 minute so the map crane highlight and card promotion expire together after 60 seconds.
- [x] Replace the recent-complete berth-map crane color with black while keeping the same shared recent state logic.
- [x] Verify that a crane leaving idle again immediately clears the recent-complete state instead of waiting for the timer, then document the review.

## Crane Status Recent-Complete Black Marker Review (2026-03-13)
- Updated `apps/mobile/app/cranes.tsx` so the shared recent-completion window is now `60 seconds` instead of `5 minutes`.
- The berth-map recent-complete crane palette is now black/charcoal instead of red, while card ordering still uses the same shared recent-completion set.
- Tightened the local prune interval to `1 second` so the 1-minute expiry is not delayed by the old 15-second timer.
- The immediate-clear behavior for resumed work remains intact because the shared recent set is still deleted as soon as a grouped crane display state becomes non-idle.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - focused `node` timing replay confirmed:
    - recent-complete entry remains present at `+59 seconds`
    - disappears at `+61 seconds`
    - disappears immediately when the same crane returns to `scheduled`

## Crane Status Card Berth Label Plan (2026-03-13)
- [x] Pull berth data from the live schedule list into the cranes screen without disturbing the existing crane live API flow.
- [x] Replace the small bottom-right `vessels` count on crane cards with a `Berth` label derived from the scheduled vessel.
- [x] Verify the mobile screen still typechecks and document the review.

## Crane Status Card Berth Label Review (2026-03-13)
- Updated `apps/mobile/app/cranes.tsx` so the screen now also reads `API_URLS.vessels` and builds a `vesselName -> berth` lookup from the live schedule list.
- Crane card models now carry `berthLabel`, and the old bottom-right `n vessels` footer text has been replaced with `Berth {선석}` when a berth is available.
- Manual refresh on the screen now refreshes both the crane feed and the vessel schedule feed together so the berth label stays aligned with the current vessel rows.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## Crane Status Berth Footer Copy Review (2026-03-13)
- Adjusted the crane card footer copy in `apps/mobile/app/cranes.tsx` so the berth number now comes first and the suffix is lowercase, matching the old `n vessels` reading pattern.
- The footer now renders as `{선석} berth` instead of `Berth {선석}`.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## Crane Status Map Vessel Tone Plan (2026-03-13)
- [x] Add a vessel-based tone variant layer to the berth map so different vessels are distinguishable even when they share the same state color family.
- [x] Keep the existing state families and recent-complete black override intact while applying only brightness/shade variation per vessel group.
- [x] Run focused mobile verification and document the review.

## Crane Status Map Vessel Tone Review (2026-03-13)
- Updated `apps/mobile/app/cranes.tsx` so berth-map palettes now apply one of several brightness variants per distinct vessel while keeping the original state families:
  - same vessel across multiple cranes keeps the same tone
  - different vessels step through brighter/darker variants inside the same active/scheduled/idle family
  - recent-complete cranes still override to the shared black palette first
- The tone variation is map-only; list cards, summary chips, and the rest of the status colors are unchanged.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## Crane Status Directional Map Tone Review (2026-03-13)
- Refined the berth-map tone logic so it now shades each contiguous vessel cluster from right to left instead of giving one fixed tone per vessel.
- Within the same vessel cluster:
  - the rightmost crane is the darkest
  - each crane further left becomes progressively softer
- Recent-complete black override still wins first, and the directional tone logic remains map-only.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## Crane Status Cluster Tone Correction Review (2026-03-13)
- Corrected the berth-map tone model again after verifying the live grouping expectation.
- The right rule is:
  - one shared tone per contiguous vessel cluster
  - rightmost vessel cluster = darkest
  - next cluster to the left = softer
  - next cluster to the left = softer again
- This means a live shape like `GC182~185`, `GC186`, `GC187~188` should render as exactly three tones, not per-crane shading inside those groups.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## Crane Status Idle Yard Gray Review (2026-03-13)
- Corrected the map yard-stack coloring so idle/no-work berth sections no longer inherit the vessel-toned crane palette.
- Idle-side yard containers now render in neutral gray, while working/scheduled/recent-complete sections keep their existing colored map palettes.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## Crane Status Scheduled Yard Gray Review (2026-03-13)
- Narrowed the berth-map yard-stack coloring further after confirming that non-working scheduled berths were still reading as active blue.
- Yard stacks now stay colored only for `Working` and recent-complete sections.
- `Scheduled` and `Idle` berth sections both fall back to neutral gray in the yard area, while the crane silhouettes themselves still keep their own map status colors.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## Crane Status Yard Middle-Slot Gray Review (2026-03-13)
- Corrected the yard-area interpretation again after the user clarified they only wanted the middle container slot grayed out, not the whole yard block.
- The berth-map yard stacks now keep the existing colored/random top and bottom slots, while only the middle slot falls back to neutral gray for non-working sections.
- Active and recent-complete sections still use their normal colored middle slot.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`

## Crane Status Progress Alert Integration Plan (2026-03-13)
- [x] Extend the existing monitor settings model and server alert pipeline to store percentage-based crane progress and total progress thresholds.
- [x] Detect percentage threshold crossings from the live Crane Status data so alerts reuse the current server-side notification/event flow.
- [x] Add in-screen long-press configuration on crane cards and the Total Progress panel for map/list usage, then verify end-to-end behavior and document the review.

## Crane Status Progress Alert Integration Review (2026-03-13)
- Extended the shared monitor settings model with per-GC `gcProgressMonitors` and one `gcTotalProgressMonitor`, then exposed both through the existing `/api/monitors/config` route instead of creating a second alert path.
- Added grouped crane-progress and total-progress crossing detection on the server so the new alerts reuse the current alert event, SSE, deep-link, and push-notification flow into the `Cranes` screen.
- Updated `apps/mobile/app/cranes.tsx` so both crane cards and the `Total Progress` panel accept a long-press, open an in-screen percentage picker, and save those thresholds back through the monitor config API.
- Added visible `Alert {n}%` badges on configured crane cards and on the total-progress panel so operators can see active thresholds without leaving the screen.
- Verification:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/threshold.test.ts tests/monitor-config-api.test.ts`
  - `npm.cmd --workspace @gwct/server run test -- --run tests/integration-alert.test.ts tests/threshold.test.ts tests/monitor-config-api.test.ts`
  - `npm.cmd --workspace @gwct/server run typecheck`
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - `npm.cmd --workspace @gwct/shared run typecheck`
  - `npx expo export --platform ios --output-dir dist-test --clear`

## Crane Status Progress Gauge Picker Refinement Plan (2026-03-13)
- [x] Replace the current percentage alert preset buttons with a horizontal scrub gauge that updates the threshold live while the user drags.
- [x] Support finer 0.1% threshold precision inside the final 1% range and align the server alert crossing logic with that precision.
- [x] Re-run the focused server/mobile verification set and document the refinement review.

## Crane Status Progress Gauge Picker Refinement Review (2026-03-13)
- Replaced the percent alert picker buttons/chips in `apps/mobile/app/cranes.tsx` with a horizontal scrub gauge that updates the visible threshold live while the user drags left and right.
- The gauge now uses integer steps through `1%~99%` and switches to `99.1%~99.9%` inside the final 1% band before `100%`, matching the finer control the user requested.
- Extended the shared/server progress threshold path so progress monitor rules can store decimal thresholds and the alert crossing logic now compares against precise progress percentages rather than the floored display percent.
- Verification:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/threshold.test.ts tests/monitor-config-api.test.ts tests/integration-alert.test.ts`
  - `npm.cmd --workspace @gwct/server run typecheck`
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - `npm.cmd --workspace @gwct/shared run typecheck`
  - `npx expo export --platform ios --output-dir dist-test --clear`

## Crane Status Gauge Surface Simplification Plan (2026-03-13)
- [x] Remove the lower tick/ruler portion of the progress alert picker and make the top gauge card itself the only horizontal scrub surface.
- [x] Keep decimal precision only in the final 1% zone before completion while preserving the existing server-side decimal threshold support.
- [x] Reduce configured-state indication to a single small alarm badge on the top-right of configured crane cards and verify the mobile build again.

## Crane Status Gauge Surface Simplification Review (2026-03-13)
- Simplified the progress alert modal again so the single top gauge card is now the only interactive scrub surface; the lower ruler/tick strip has been removed entirely.
- Horizontal dragging on that gauge card updates the alert threshold live, and the value still only exposes decimal precision in the final 1% zone before `100%`.
- Replaced the previous text badge treatment on crane cards with one compact alarm icon badge at the top-right of each configured crane card; the Total Progress panel keeps long-press setup but no longer shows the text badge.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - `npx expo export --platform ios --output-dir dist-test --clear`

## Crane Status Scrub Fix Review (2026-03-13)
- Fixed the non-working progress scrub interaction in `apps/mobile/app/cranes.tsx` by removing the initialization effect that was pushing the value back to the starting threshold after every drag update.
- Tightened the scrub gauge card vertically by reducing its padding, gap, and copy sizing so it reads less like a thick block while preserving the same drag surface and final-1% decimal behavior.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - `npx expo export --platform ios --output-dir dist-test --clear`

## Crane Status Gauge Default & Full-Fill Plan (2026-03-13)
- [x] Change the default progress alert threshold to `100%` for unconfigured crane and total-progress monitors.
- [x] Ensure the scrub gauge visually fills completely at `100%` instead of stopping short.
- [x] Preserve decimal precision only in the final `1%` before completion, then re-run focused verification and document the review.

## Crane Status Gauge Default & Full-Fill Review (2026-03-13)
- Changed the unconfigured progress alert default from `80%` to `100%` in both the mobile fallback rule and the server monitor-settings default so newly opened crane/total-progress alarms start from full completion.
- Updated the scrub gauge fill rendering so the `100%` state uses a dedicated full-fill style instead of relying on the generic percentage width calculation, which was visually stopping short.
- Kept the existing decimal rule scoped to the final `1%` before completion (`99.1%~99.9%`) while leaving `1%~99%` on whole-number steps.
- Verification:
  - `npm.cmd --workspace @gwct/server run typecheck`
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - `npx expo export --platform ios --output-dir dist-test --clear`

## Crane Status Scrub Precision Correction Plan (2026-03-13)
- [x] Move progress-alarm decimal precision from the old `99.x%` band to the actual low-end `1% 이하` band.
- [x] Refactor the gauge drag interaction so it nudges the current value in fine relative steps instead of jumping to the finger position.
- [x] Re-run focused server/mobile verification and record the review once the new threshold behavior passes.

## Crane Status Scrub Precision Correction Review (2026-03-13)
- Corrected the progress-alarm threshold rule so decimal precision now lives only in the low-end `0.1%~1.0%` band; values above `1%` snap to whole numbers on both the mobile picker and the server monitor-config path.
- Rebuilt the mobile gauge drag interaction as a relative scrub from the current displayed value instead of an absolute finger-position mapper, and slowed it to one threshold step per fixed drag distance so small adjustments stop overshooting.
- Kept the `100%` full-fill state and compact single-card picker layout intact while updating the helper copy to match the new low-end decimal rule.
- Verification:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/threshold.test.ts tests/monitor-config-api.test.ts`
  - `npm.cmd --workspace @gwct/shared run typecheck`
  - `npm.cmd --workspace @gwct/server run typecheck`
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - `npx expo export --platform ios --output-dir dist-test --clear`

## Crane Status Scrub Acceleration Plan (2026-03-13)
- [x] Add consecutive-drag acceleration to the relative progress scrub so repeated quick swipes move the threshold faster.
- [x] Keep the first drag precise and preserve the same low-end `0.1%` stepping at `1%` and below.
- [x] Re-run mobile verification and record the review after the interaction compiles cleanly.

## Crane Status Scrub Acceleration Review (2026-03-13)
- Kept the gauge on the same relative-scrub model, but added a consecutive-drag streak window so the first drag stays precise while quick follow-up swipes speed up the same value-change logic.
- The picker now increases its internal acceleration multiplier when another drag starts within `900ms` of the previous release, with a capped speed-up so it feels faster without becoming uncontrollable.
- Preserved the existing `1% 이하` decimal stepping and updated the hint copy so the behavior matches the new accelerated interaction.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - `npx expo export --platform ios --output-dir dist-test --clear`

## Crane Status Total Progress Badge Plan (2026-03-13)
- [x] Reuse the existing compact alarm badge on the `Total Progress` summary panel when its monitor is enabled.
- [x] Run mobile verification and record the review once the summary badge compiles cleanly.

## Crane Status Total Progress Badge Review (2026-03-13)
- Added the same compact alarm badge to the `Total Progress` summary panel so its long-press-configured alert now has visible armed-state feedback just like the individual crane cards.
- Reused the existing `CraneAlarmBadge` component instead of introducing a second badge style, and aligned the summary title row so the badge sits cleanly on the right edge of the panel.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - `npx expo export --platform ios --output-dir dist-test --clear`

## Crane Status Stop-Reason Map Link Plan (2026-03-13)
- [x] Reuse the GC Cabin/Under `stopReason` signal on the Cranes screen by reading the equipment latest feed alongside the existing crane/vessel feeds.
- [x] Override only the berth-map crane silhouette palette to red when the matching GC currently has a stop reason, without recoloring the rest of the map illustration.
- [x] Re-run mobile verification and record the review once the map-link change compiles cleanly.

## Crane Status Stop-Reason Map Link Review (2026-03-13)
- Wired the Cranes screen to the existing equipment latest feed so map rendering now knows which GC numbers currently carry a `stopReason`, instead of inventing a second stop-state detector.
- Added a dedicated stop-reason red palette only for the berth-map crane silhouette; yard stacks, ship blocks, and the rest of the illustration still follow the existing normal/recent-complete color rules.
- Verified against the live equipment feed that the current stop-reason GCs are `187` (`붐 UP/DOWN`) and `188` (`본선접안대기(검역,라싱해체 등)`), which are now the cranes that should render red on the map.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - `npx expo export --platform ios --output-dir dist-test --clear`

## Crane Status Boom-Up Map Variant Plan (2026-03-13)
- [x] Detect the specific `붐 UP/DOWN` stop reason from the same equipment stop-reason lookup already feeding the map red override.
- [x] Swap the normal berth-map boom geometry for a raised-boom silhouette only on those cranes, while leaving other stop reasons on the regular red crane shape.
- [x] Re-run mobile verification and record the review once the shape variant compiles cleanly.

## Crane Status Boom-Up Map Variant Review (2026-03-13)
- Added an exact `붐 UP/DOWN` stop-reason check on top of the existing stop-reason map lookup so only that reason changes the berth-map crane geometry.
- Those cranes now keep the same red stop palette but switch from the normal boom profile to a raised-boom silhouette with a taller mast and lifted upper boom path; other stop reasons still use the standard red crane shape.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - `npx expo export --platform ios --output-dir dist-test --clear`

## Crane Status Boom Direction Correction Plan (2026-03-13)
- [x] Flip the `붐 UP/DOWN` raised-boom geometry so the lifted boom sits on the waterside/ship side instead of reading as a landside lift.
- [x] Re-run mobile verification and record the review once the corrected silhouette compiles cleanly.

## Crane Status Boom Direction Correction Review (2026-03-13)
- Corrected the `붐 UP/DOWN` raised-boom branch so the lifted boom now rises on the waterside/ship side of the berth-map crane instead of reading as a landside mast lift.
- Kept the same stop-reason red palette and only flipped the boom geometry and support lines for that exact branch.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - `npx expo export --platform ios --output-dir dist-test --clear`

## Crane Status Boom Variant Rollback Plan (2026-03-13)
- [x] Remove the special `붐 UP/DOWN` raised-boom silhouette branch and return all stop-reason cranes to the same standard map crane shape.
- [x] Re-run mobile verification and record the rollback review once the silhouette reset compiles cleanly.

## Crane Status Boom Variant Rollback Review (2026-03-13)
- Removed the special `붐 UP/DOWN` raised-boom silhouette branch so every stop-reason crane now uses the same standard map crane shape again.
- Kept the existing stop-reason red color override and equipment-feed linkage intact; only the extra geometry branch was rolled back.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - `npx expo export --platform ios --output-dir dist-test --clear`

## Crane Status Stop-Reason Card Color Plan (2026-03-13)
- [x] Reuse the existing equipment stop-reason lookup to flag lower crane cards whose GC currently has a stop reason.
- [x] Override those cards' accent tone to red so they no longer stay on the normal green/blue status palette.
- [x] Re-run mobile verification and record the review once the card-color change compiles cleanly.

## Crane Status Stop-Reason Card Color Review (2026-03-13)
- Reused the same GC stop-reason lookup already feeding the berth map so lower crane cards now know when their GC is currently stopped.
- Those cards now swap their accent tone to a red stop palette, which changes the crane ID pill, ring/progress accent, and berth footer accent without changing the rest of the card content.
- Verification:
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - `npx expo export --platform ios --output-dir dist-test --clear`

## Crane Status Threshold Decimal Revert Plan (2026-03-13)
- [x] Restore the progress-alert decimal threshold rule from the low-end `1% 이하` band back to the final `99%~100%` band in the shared helper and mobile scrub step table.
- [x] Re-align the server monitor-config validation and focused tests to the restored `99.x%` threshold behavior.
- [x] Re-run focused server/mobile verification and record the review once the reverted threshold rule passes cleanly.

## Crane Status Threshold Decimal Revert Review (2026-03-13)
- Reverted the progress-alert decimal threshold rule back to the final `99.1%~99.9%` band in the shared threshold helper, so values below `99%` are whole-number steps again and the server monitor config follows the same rule.
- Reworked the mobile scrub step-index mapping to match that restored layout: integer steps from `1%` through `99%`, decimal steps only through the final `99.x%` band, and `100%` as the full-completion endpoint.
- Updated the picker helper copy and restored the focused server tests/config-route expectations to `99.5/99.7/99.8/99.9` thresholds.
- Verification:
  - `npm.cmd --workspace @gwct/server run test -- --run tests/threshold.test.ts tests/monitor-config-api.test.ts`
  - `npm.cmd --workspace @gwct/shared run typecheck`
  - `npm.cmd --workspace @gwct/server run typecheck`
  - `npm.cmd --workspace @gwct/mobile run typecheck`
  - `npx expo export --platform ios --output-dir dist-test --clear`
