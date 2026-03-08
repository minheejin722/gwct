# Lessons

## 2026-03-01
- When user specifies environment constraints (npm-only, no Docker), lock them into architecture before scaffolding.
- For YS Pilot weather alerts, treat `/forecast` `배선팀근무` as primary suspension signal and notices as secondary evidence.
- For DOM scraping tasks with strict field semantics, verify the live page structure first and anchor parser logic to explicit labels (`G/C 181~190`, `작업 구분`, `잔량`) to prevent false positives.
- For schedule monitoring requests, avoid broad diff categories by default and implement source-specific event logic (e.g., ETA-only) with a baseline-first guard to prevent alert floods.

## 2026-03-02
- When `expo-doctor` reports duplicate native modules in a workspace repo, first verify non-mobile workspaces have no Expo/React Native direct deps, then regenerate install artifacts from scratch (`delete root node_modules + package-lock`, `npm install`) before introducing overrides.
- For live operational dashboards, do not classify partial null business values as parser failures by default; reserve WARN/parse-error diagnostics for structural parse failures or all-values-missing states.
- During QA, do not run state-mutating server scripts (`scrape:once`, `replay:fixtures`) in parallel against the same SQLite DB; run them sequentially to avoid foreign-key race noise.
- For monitor on/off requirements, gate event emission in the server event pipeline (not in parser/scraper) so snapshots/diagnostics continue while user-facing events/alerts stop.
- On Windows PowerShell, avoid default `Set-Content` encoding for source files; always force UTF-8 (`-Encoding utf8` or explicit `UTF8Encoding`) to prevent TypeScript/source corruption.
- For Expo monorepo runtime validation, do not rely on `expo-doctor` alone; verify with an actual Metro bundle (`expo export` or live bundle request) because Babel/transitive module gaps can still pass doctor checks.
- In this repo, if iPhone red screen shows missing Babel modules from `expo-router/entry.js`, fix mobile Babel stack first (`@babel/core`, `babel-preset-expo`, required plugins) and confirm `expo export --platform ios` succeeds before retesting Expo Go.

## 2026-03-04
- In npm workspace monorepos where `@gwct/shared` exports TS source directly, NodeNext-style internal `.js` import suffixes can break Expo Metro resolution; keep Node entry intact and add a `react-native` conditional export to a native entry file that uses extensionless internal imports.

## 2026-03-06
- For GWCT equipment GC rows, do not infer helper/under-man from an `HK` prefix. The parser must treat the first name line as driver and the second non-empty line as helper because the live page can show a plain helper name with no `HK(...)` marker.
- When the user corrects operational terminology, change user-facing labels/messages end-to-end (`server event text + mobile UI`) while preserving internal field names and event types unless the data contract itself needs to change.
- For GC181~190 operational state, do not equate `remainingSubtotal > 0` with active work. If subtotal remains but Cabin/Under/login are all absent in equipment status, classify the crane as `작업 예정` instead of `작업중`.
- When the user points to a specific visible UI card in a screenshot, remove that entry point only unless they explicitly ask to delete the underlying feature too.
- For operational list screens, sort by semantic urgency before numeric equipment order, and if multiple backend states are not meaningfully distinct to operators, collapse them into one user-facing label and style at the UI layer.
- On phone-focused operational status screens, default to dense one-line label/value rows and trim decorative whitespace aggressively when the user asks for higher information density; the target is quick scanability, not roomy card aesthetics.
- For live equipment-status screens, keep per-screen filtering and ordering rules explicit in the UI layer: exclude out-of-scope units locally, use shape/color status marks for fast scanning, and only fall back to raw numeric order when every visible unit is in the same inactive state.
- When operators ask for icon-only status presentation, remove visible status text from both summary and row badges, keep the semantic names only for accessibility/internal mapping, and enlarge the icons enough that color/shape carry the meaning at a glance.
- When operational users want personnel replacement alerts worded as `교대`, prefer updating existing change-event titles/messages over inventing new event types unless the semantic transition itself truly expands.
- In dense two-row mobile cards, if the user wants upper/lower fields to align vertically, do not add one-off left padding to only the lower row; keep the column container as the single alignment source.
- For screens entered directly from the home cards, treat the header-left control as a home-return affordance, not a generic stack back button; apply the custom button only to those top-level destinations and leave deeper sub-screens with normal back behavior.
- For custom header nav buttons, avoid combining a filled circle with a contrasting border if the user wants a simple circular glyph; use a single outline or a single fill, not both.
- If the user asks to roll back only the arrow glyph in a custom nav button, keep the container styling and revert just the glyph shape to the native-looking chevron instead of undoing the whole button change.
- If the user says to return to the original state, revert the full visible behavior to the pre-change baseline instead of interpreting it as a partial style tweak.
- For oversized summary cards on the home screen, scale the headline label and numeric value to match the available whitespace before changing layout structure; operators usually want stronger visual hierarchy, not a new card design.
- If the user immediately cancels a just-made visual tweak, revert that exact tweak completely instead of iterating further on the same direction.
- For GWCT vessel schedule work, do not trust raw ISO timestamps or implicit DB row order in the mobile UI. Always verify the live `m=H&s=A` table columns and row colors, then return KST display fields plus explicit watch-window order/color metadata from the server.
- When a menu screen is meant to navigate to multiple operational tools, present each destination as a clearly separated tappable card with its own visual affordance instead of leaving items as bare stacked text; operators should read it as a button list at a glance.
- If the backend already resolves an operational state like `작업 예정`, do not repeat the full reasoning sentence in every status card unless the user explicitly wants that rationale visible; the badge/state label should stay primary and cards should remain compact.
- For GWCT `m=F&s=A` crane tables, do not map discharge/load cells using the first header-row column index when each `G/C nnn` header spans two body columns. Parse the GC order separately and address body cells as `1 + gcIndex * 2`, or trailing GC rows will inherit earlier cranes' remaining values.

## 2026-03-07
- When using official board-list pages as a fallback signal source for live operational state, never let historical titles drive the current state indefinitely. Scan multiple recent rows, but add an explicit recency guard so old suspension notices remain reference text only and do not override the live forecast.
- For menu-card screens where the whole card is already tappable, do not keep a trailing chevron by default if the user wants a calmer layout; use vertical spacing and card hierarchy to signal affordance instead of duplicating tap cues.
- When the user cares about first-screen fit on a phone, reduce oversized hero/header sections before compressing the actual action cards; clipped bottom actions look worse than slightly denser intro copy.
- For dense card lists on phone screens, when the user asks for only a slight visual breathing adjustment, change the local gap between the specific elements first (for example icon row vs title block) instead of touching global card height or screen padding again.
- When a tab screen needs to visually blend into a light page and keep iPhone status-bar glyphs readable, do not change the global tab header theme. Override that specific tab's header background/tint to the screen palette instead.
- In Expo Router tabs, do not try to surface a bottom-tab destination by inventing a `*-tab` screen name that has no file. A visible tab must point at a real route inside the `(tabs)` group, or the button may never appear at runtime.
- For phone-sized ranking cards that contain timestamps, do not place two full datetime fields in the same horizontal row. Stack them vertically in separate blocks and remove secondary fields the user does not need before trying to squeeze long text into one line.
- When the user wants a state word to read as a standalone badge/value, remove the visible field label (`상태`) instead of repeating both label and value. Put exception detail like stop reasons inline only for the non-normal states, and push lower-priority metrics like segment counts to the bottom.
- When the user specifies an exact compact metadata order for a card row, preserve that row structure literally. Do not "improve" it by demoting one field like `세그먼트` to a separate line if the requested scan order was `YT / 상태 / (사유) / 세그먼트`.
- For persisted operational summary screens, `logged_out` should not automatically erase the last meaningful stop reason. If the source row disappears after a stopped state, preserve the final observed reason so operators can still see why the session ended.
- On accumulated work-summary cards, do not keep showing a previous stop timestamp once the operator has started a new active segment. Preserve the historical data in state, but hide stale stop-time UI unless the current semantic state is actually inactive.
- For YT work-time accumulation, do not key the current-state lookup only by `driverName`. GWCT can expose a `logged_out` YT row with `driverName=null` and a meaningful `stopReason`, so the accumulator must fall back to the tracked `YT 번호` to preserve logout reasons.
- When adding a `YT 번호` fallback to preserve driverless logout reasons, constrain it to driverless rows only. Otherwise a same-YT driver handoff can leak the new active driver state into the old driver's accumulated session.
- When the user asks to remove decorative punctuation from an inline operational label, remove the literal characters at the render site and keep only the spacing/color emphasis. Do not preserve wrappers like parentheses unless the user explicitly asked for them.
- When a user-facing operational annotation must survive `DELETE /api/events`, do not derive it only from `alertEvent` history. Persist that state in a dedicated backend store that the clear-events path does not touch, and let the live API read from that store first.
- When you lighten a single tab header to blend into the page, also check whether that screen still uses hard-coded body colors. If it does, move the body to the shared theme palette too, or the header/body seam will become more visible instead of less.
- When the user asks to remove a specific punctuation mark from helper copy, change only that exact character and leave the rest of the sentence structure alone.
- For YT Count UI, do not let a raw `logged_out` equipment row with an empty operator erase the last known driver name in the latest snapshot. Keep raw diff semantics untouched, but merge the previous snapshot's driver name for the same `YT 번호` into the UI-facing latest snapshot so `Cabin` still shows who last drove it.
- For YT Count latest snapshots, store the first logout observation time separately from the raw `loginText`, preserve it across repeated `logged_out` polls, and clear it only when the same YT becomes active again. The mobile row should switch its third label between `로그인` and `로그아웃` instead of always reusing `로그인`.
- For YT unit alerts, do not treat `logged_out -> active` as `다시 로그인` based on YT 번호 alone. Compare the last known driver identity too: same driver => `다시 로그인`, different same-company driver => `교대`, different company-prefix driver => `주야 교대`, and unknown prior driver => plain `로그인`.
- For Work session shift rules, do not leave day/night boundaries duplicated as raw `07:00/19:00` literals across service logic and UI helper copy. Centralize the shift start/end constants in the backend and update the UI copy/tests in the same change whenever operations correct the boundary times.

## 2026-03-08
- When the user retracts newly added Work control UI and asks for fully implicit backend behavior, remove the control surface end-to-end (`state store`, `API`, `screen buttons/cards`) instead of keeping unused toggles or hidden fallback paths.
