# GWCT Alert MVP (npm-only, SQLite-first)

DOM-first operations alert system for GWCT terminal monitoring.

- Scrapes public pages with Playwright full page navigation.
- Parses normalized domain objects (not raw HTML diff as primary signal).
- Generates change events and sends alerts via SSE + Expo push.
- Includes Expo iPhone-first app screens for monitoring and settings.

## Monorepo Structure
- `apps/server`: Fastify + Playwright + Prisma(SQLite)
- `apps/mobile`: Expo Router React Native app
- `packages/shared`: shared Zod schemas/events/types
- `docs`: plan/architecture/selector/deployment/risks
- `tasks`: tracked execution checklist and lessons

## Target Sources
- GWCT schedule list: `http://www.gwct.co.kr:8080/dashboard/?m=H&s=A`
- GWCT schedule chart (`m=I&s=A`) is excluded from scraping/monitoring.
- GWCT work status: `http://www.gwct.co.kr:8080/dashboard/?m=F&s=A`
- GWCT GC remaining subtotal monitor: `http://www.gwct.co.kr:8080/dashboard/?m=F&s=A` (`gwct_gc_remaining`)
- GWCT equipment status: `http://www.gwct.co.kr:8080/dashboard/?m=D&s=A`
- YS forecast: `http://www.yspilot.co.kr/forecast`
- YS notice: `http://www.yspilot.co.kr/boards/lists/notice`

## Core Alert Rules
- Schedule list focus ETA change (`gwct_eta_changed`, baseline-first, top `N` only)
- GC remaining subtotal threshold crossing (`gc_remaining_low`, GC별 on/off + 기준값)
- Equipment focus changes on GC180~GC190 (`gc_driver_*`, `gc_hk_*`, `gc_stop_reason_*`, `gc_login_time_changed`, on/off)
- YT logged-in count threshold state machine (`yt_count_low`, `yt_count_recovered`, on/off)
- YS suspension/weather alert (`ALL_SUSPENDED`, `RESUMED`, `TEXT_CHANGED`, on/off)
  - Primary signal: `배선팀근무`
  - `전체 도선 중단` / `All Pilotage Suspended` (including malformed parenthesis variants) => `ALL_SUSPENDED`

All monitor features are user-configurable and persisted. Default boot configuration is disabled.

## Prerequisites
- Node.js 22+
- npm 11+
- (for live mode) Playwright browser binaries

## Setup
```bash
npm install
copy apps\\server\\.env.example apps\\server\\.env
copy apps\\mobile\\.env.example apps\\mobile\\.env
npm --workspace @gwct/server run prisma:generate
npm --workspace @gwct/server run prisma:push
```

`apps/mobile/.env` example for iPhone-on-LAN testing:
```bash
EXPO_PUBLIC_API_BASE_URL=http://192.168.35.73:4000
EXPO_PUBLIC_LOCAL_SSE_ALERTS=true
```

## Run
```bash
npm run dev
```

Or separately:
```bash
npm run dev:server
npm run mobile
```

Windows-friendly custom port (`4001`) using `cross-env`:
```bash
npm run dev:server:4001
```

Run both server+mobile on `4001` (mobile API URL injected):
```bash
npm run dev:4001
```

## Configuration
- Server port defaults to `4000` and uses runtime expression `process.env.PORT ?? 4000`.
- Mobile API base URL uses `EXPO_PUBLIC_API_BASE_URL` (see `apps/mobile/.env.example`).
- Local foreground SSE notifications are enabled by default in mobile; set `EXPO_PUBLIC_LOCAL_SSE_ALERTS=false` to disable duplicate local alerts when push is already sufficient.
- Persistent monitor settings file:
  - `apps/server/data/config/monitor_settings.json`
  - `gwctEtaMonitor`: `enabled`, `trackingCount(1~11)`
  - `gcRemainingMonitors`: `181~190` each `enabled`, `threshold`
  - `equipmentMonitor.yt`: `enabled`, `threshold`, `stateInitialized`, `state`
  - `equipmentMonitor.gcStaff`: `enabled`
  - `yeosuPilotageMonitor`: `enabled`, `lastRawText`, `lastNormalizedState`, `lastChangedAt`

### Data Retention Cleanup
- Cleanup scheduler runs automatically when server is on.
- Default interval: every `15` minutes.
- Default policy:
  - transient debug/runtime data TTL: `15` minutes.
  - append-only snapshot history tables: keep latest `2` seenAt groups per source.
  - user-facing event history is preserved (not auto-deleted by retention cleanup).
- Raw snapshot persistence policy (`RAW_SNAPSHOT_PERSIST`):
  - `off`: do not store raw HTML snapshots.
  - `errors_only` (default): store raw snapshot only when diagnostics exist or scrape fails.
  - `all`: store every scrape snapshot.
- SQLite compaction policy (`DB_COMPACTION_MODE`):
  - `incremental` (default): run `PRAGMA incremental_vacuum(...)` on each cleanup pass.
  - `manual`: skip scheduled compaction (manual full vacuum only via admin cleanup API).
  - `off`: do not compact.
- Server env keys (`apps/server/.env`):
  - `CLEANUP_ENABLED=true`
  - `CLEANUP_INTERVAL_MINUTES=15`
  - `TRANSIENT_RETENTION_MINUTES=15`
  - `RAW_SNAPSHOT_PERSIST=errors_only`
  - `DB_COMPACTION_MODE=incremental`
  - `DB_INCREMENTAL_VACUUM_PAGES=256`
- Manual one-shot cleanup endpoint (debug token required):
  - `POST /api/admin/cleanup/run`
  - optional body `{ "fullVacuum": true }` for explicit one-time full `VACUUM`.

## iPhone Test URL
- `http://192.168.35.73:4000/api/equipment/latest`

## GC Remaining Subtotal Monitor
- Source page: `http://www.gwct.co.kr:8080/dashboard/?m=F&s=A`
- Parsed target: GC `181~190` only.
- `remainingSubtotal` definition: `(양하 잔량 + 적하 잔량)` per GC.
- Latest snapshot payload keeps `dischargeRemaining`, `loadRemaining`, `remainingSubtotal`.
- Alert rule: enabled GC only, downward crossing `previousSubtotal > threshold && currentSubtotal <= threshold`.
- Latest dump file (overwrite every successful scrape):
  - `apps/server/data/latest/gwct_gc_remaining.json`
- Partial missing pairs are debug-logged; full unavailability is warn-logged.

## Schedule11 ETA Focus Monitor
- Source page: `http://www.gwct.co.kr:8080/dashboard/?m=H&s=A` only.
- Row colors: class-first (`bg_closed`/`bg_on`/`bg_yet`) with color-distance fallback (`green/yellow/cyan/unknown`).
- Watch window rule:
  - start at first yellow row (`bg_on`) and track first 11 non-green rows.
  - if yellow row is missing, start from first non-green row.
- User monitor setting:
  - `trackingCount` (`1~11`) controls actual event watch range from the top of this window.
  - `enabled=false` disables ETA events while snapshots keep updating.
- Extracted columns: `모선항차`, `선박명`, `입항 일시`.
- ETA compare key: normalized `YYYY-MM-DDTHH:mm` in KST.
- Latest dump file (overwrite every successful scrape):
  - `apps/server/data/latest/gwct_schedule_list_focus.json`
- Summary log:
  - `[SCHEDULE11] 1) ... | 2) ...` (max 11 rows).
- Baseline rule:
  - first observed window is baseline only (no ETA-change event).
  - `SCHEDULE_ALERT_ON_WINDOW_ENTER=true` enables optional alert on newly entered voyages.

## Equipment Focus Monitor
- Source page: `http://www.gwct.co.kr:8080/dashboard/?m=D&s=A`.
- YT count rule:
  - `YT` 장비 행 중 기사명(`driverName`)이 공란/placeholder(`""`, `-`, `—`, `N/A`)이 아닌 행 수를 `ytCount`로 집계.
- YT state machine rule (single threshold):
  - `NORMAL -> LOW`: `ytCount <= threshold` => `yt_count_low` 1회
  - `LOW -> NORMAL`: `ytCount >= threshold` => `yt_count_recovered` 1회
  - first run (or re-initialization) stores baseline only, no event.
- YT monitor `enabled=false`이면 이벤트/알림이 발생하지 않음.
- GC focus rule:
  - 대상: `GC180~GC190` (표기 변형 `G/C 180`, `GC-180` 포함 정규화)
  - 감지: `driverName`, `hkName`, `loginTime`, `stopReason` 변화
- GC focus monitor도 별도 `enabled`로 on/off 제어.
- Latest dump file:
  - `apps/server/data/latest/gwct_equipment_status_focus.json`
- Summary log:
  - `[EQUIP] YT=28 | GC188 driver=... hk=... stop=... | ...`

## Test / Validation
```bash
npm run typecheck
npm test
npm run scrape:once
npm run replay:fixtures
```

## API Endpoints
- `GET /api/dashboard/summary`
- `GET /api/vessels/live`
- `GET /api/cranes/live`
- `GET /api/schedule/focus/latest`
- `GET /api/gc/latest`
- `GET /api/gc/thresholds`
- `POST /api/gc/thresholds`
- `GET /api/equipment/live`
- `GET /api/equipment/latest`
- `GET /api/equipment/config`
- `POST /api/equipment/config`
- `GET /api/yt/live`
- `GET /api/weather/live`
- `GET /api/monitors/config`
- `POST /api/monitors/config`
- `GET /api/monitors/status`
- `GET /api/monitors/gwct-eta`
- `POST /api/monitors/gwct-eta`
- `GET /api/monitors/gc-remaining`
- `POST /api/monitors/gc-remaining`
- `GET /api/monitors/equipment`
- `POST /api/monitors/equipment`
- `GET /api/monitors/yeosu`
- `POST /api/monitors/yeosu`
- `GET /api/alerts`
- `GET /api/events`
- `POST /api/devices/register`
- `PATCH /api/settings/device/:deviceId`
- `GET /api/stream/events` (SSE)
- `POST /api/admin/scrape/once` (requires `x-debug-token`)
- `POST /api/admin/cleanup/run` (requires `x-debug-token`)
- `GET /api/debug/snapshots/latest` (requires `x-debug-token`)
- `GET /api/debug/parse-errors` (requires `x-debug-token`)

### Monitor Config API Examples
PowerShell (`iwr`):
```powershell
# 전체 모니터 설정 조회
iwr http://127.0.0.1:4000/api/monitors/config

# GWCT ETA: N=7로 저장 + 활성화 (Confirm)
$gwct = @{
  gwctEtaMonitor = @{
    enabled = $true
    trackingCount = 7
  }
} | ConvertTo-Json -Depth 6
iwr http://127.0.0.1:4000/api/monitors/config -Method POST -ContentType "application/json" -Body $gwct

# GC188: 기준값 10으로 저장 + 활성화 (Confirm)
$gc188 = @{
  gcRemainingMonitors = @{
    "188" = @{
      enabled = $true
      threshold = 10
    }
  }
} | ConvertTo-Json -Depth 6
iwr http://127.0.0.1:4000/api/monitors/config -Method POST -ContentType "application/json" -Body $gc188

# GC188 비활성화 (Cancel)
$gc188Off = @{
  gcRemainingMonitors = @{
    "188" = @{
      enabled = $false
    }
  }
} | ConvertTo-Json -Depth 6
iwr http://127.0.0.1:4000/api/monitors/config -Method POST -ContentType "application/json" -Body $gc188Off
```

curl:
```bash
curl http://127.0.0.1:4000/api/monitors/gwct-eta

curl -X POST http://127.0.0.1:4000/api/monitors/equipment \
  -H 'content-type: application/json' \
  -d '{"yt":{"enabled":true,"threshold":25}}'

curl -X POST http://127.0.0.1:4000/api/monitors/yeosu \
  -H 'content-type: application/json' \
  -d '{"enabled":false}'
```

Legacy compatibility endpoints (`/api/gc/thresholds`, `/api/equipment/config`) are still available.

## iPhone / Push Manual Steps (Required)
1. Run server: `npm run dev:server` (or `npm run dev:4001` if needed).
2. Set mobile env: `EXPO_PUBLIC_API_BASE_URL=http://192.168.35.73:4000`.
3. Run mobile: `npm run mobile`.
4. Open Expo Go on iPhone and scan QR from terminal.
5. 앱의 `모니터링` 탭에서 기능별로 Confirm/Cancel 및 기준값을 설정.
6. Verify endpoints from iPhone network:
   - `http://192.168.35.73:4000/api/equipment/latest`
   - `http://192.168.35.73:4000/api/monitors/status`

## Live Mode Notes
- Default server mode in `.env` is `live`; fixture mode is available for offline development.
- If Playwright browser is missing, install:
```bash
npx playwright install chromium
```

## Selector / Parser Assumptions You May Need to Tweak
- YS `배선팀근무` row label appears under `th.bg` or `td.bg` and value under `td.datatype1`.
- GWCT work-status crane parsing assumes per-vessel tables include `G/C ###` headers and rows named `합계`, `잔량`.
- YT logged-in count currently treats status words (`고장`, `수리`, `예비장비`, `운전원교대`, `점검`) as non-login.

## Docs
- `docs/plan.md`
- `docs/architecture.md`
- `docs/selector-strategy.md`
- `docs/deployment.md`
- `docs/known-risks.md`
