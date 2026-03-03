# Selector Strategy

## Principles
- Do not hardcode selectors inline inside business logic.
- Keep selectors in `apps/server/src/parsers/selectors/*`.
- Parse into normalized objects, then diff normalized records (not full HTML blobs).

## Source Selector Files
- `selectors/gwct.ts`
  - Schedule list table (`m=H`)
  - Schedule chart detail (`m=I`)
  - Work status crane tables (`m=F`)
  - Equipment table (`m=D`)
- `selectors/ys.ts`
  - Forecast/status table rows and duty labels
  - Notice board rows
  - Suspension keyword patterns

## YS Critical Selector
- Forecast row parsing checks `th.bg, td.bg` label cells.
- `배선팀근무` label row reads the adjacent `td.datatype1` as `dispatchTeamDutyText`.
- This text drives suspension state classification.

## Diagnostics on Parse Failure
- Persist `ParseError` with parser name/reason.
- Persist latest raw HTML hash and fetch metadata in `RawSnapshot`.
- Debug endpoints:
  - `/api/debug/snapshots/latest`
  - `/api/debug/parse-errors`

## Tuning Procedure
1. Capture latest HTML via debug snapshot.
2. Confirm changed DOM fragment.
3. Update selector config only.
4. Add/adjust parser fixture.
5. Re-run parser + integration tests.
