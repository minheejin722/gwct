# Known Risks

## 1) Source DOM Drift
- Risk: GWCT/YS HTML structure changes break selectors.
- Mitigation: centralized selectors + fixture regression tests + parse diagnostics.

## 2) Playwright Runtime Dependency
- Risk: browser binary missing on new machine.
- Mitigation: provide fixture mode and install Playwright browsers during setup (`npx playwright install`).

## 3) Alert Noise / Dedupe Tuning
- Risk: excessive repeated alerts in unstable source windows.
- Mitigation: dedupe key + cooldown; configurable cooldown via env.

## 4) YS Suspension Phrase Variants
- Risk: operations team posts new wording not covered by patterns.
- Mitigation: keyword patterns centralized in `selectors/ys.ts`; add fixtures for new phrases.

## 5) Expo Push Operational Limits
- Risk: push delivery can fail due token/project/account configuration.
- Mitigation: provider abstraction, notification logs, SSE fallback for foreground session.

## 6) Time Interpretation
- Risk: ambiguous date strings without year from source pages.
- Mitigation: KST parser normalizes all known formats and assumes current KST year for month/day-only values.
