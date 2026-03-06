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
