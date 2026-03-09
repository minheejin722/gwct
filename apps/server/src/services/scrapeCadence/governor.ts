import { load } from "cheerio";
import type { EquipmentLoginStatus, SourceId, VesselScheduleItem } from "@gwct/shared";
import type { FastifyBaseLogger } from "fastify";
import { parseSeoulDate } from "../../lib/time.js";
import type { NormalizedSnapshotBundle } from "../../parsers/types.js";
import type { SourceDefinition } from "../../scraper/sources.js";

const FUTURE_ETA_GAP_MS = 90 * 60 * 1000;
const MAX_IDLE_ACTIVE_LOGINS = 2;
const REQUIRED_IDLE_STABLE_OBSERVATIONS = 2;

const RELAXED_INTERVALS: Partial<Record<SourceId, number>> = {
  gwct_schedule_list: 600_000,
  gwct_work_status: 600_000,
  gwct_gc_remaining: 600_000,
  gwct_equipment_status: 600_000,
};

const MANAGED_SOURCES = new Set<SourceId>([
  "gwct_schedule_list",
  "gwct_work_status",
  "gwct_gc_remaining",
  "gwct_equipment_status",
]);

type CadenceMode = "fast" | "relaxed";

interface ScheduleSignal {
  ready: boolean;
  observedAt: string | null;
  firstEta: string | null;
  etaGapMs: number | null;
  precedingGreenCount: number;
}

interface WorkSignal {
  ready: boolean;
  observedAt: string | null;
  rowCount: number;
  nearestEta: string | null;
  nearestEtaGapMs: number | null;
}

interface EquipmentSignal {
  ready: boolean;
  observedAt: string | null;
  eligibleCount: number;
  activeCount: number;
  idleStableObservations: number;
  activeFingerprints: string[];
}

function clean(text: string | null | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

function normalizeLabel(raw: string): string {
  return clean(raw).replace(/[\/:()\-]/g, "").replace(/\s+/g, "");
}

function parseNumeric(raw: string | null | undefined): number | null {
  if (!raw) {
    return null;
  }
  const matched = raw.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  if (!matched) {
    return null;
  }
  const value = Number(matched[0]);
  return Number.isFinite(value) ? value : null;
}

function findHeaderIndex(headers: string[], candidates: string[]): number {
  const normalizedHeaders = headers.map((header) => normalizeLabel(header));
  for (const candidate of candidates) {
    const normalizedCandidate = normalizeLabel(candidate);
    const exact = normalizedHeaders.indexOf(normalizedCandidate);
    if (exact >= 0) {
      return exact;
    }
    const partial = normalizedHeaders.findIndex((value) => value.includes(normalizedCandidate));
    if (partial >= 0) {
      return partial;
    }
  }
  return -1;
}

function isOperationalEquipmentId(equipmentId: string): boolean {
  const normalized = equipmentId.toUpperCase().replace(/\s+/g, "");
  return (
    /^GC\d+$/.test(normalized) ||
    /^LEASE\d+$/.test(normalized) ||
    /^REPAIR\d+$/.test(normalized) ||
    /^RS\d+$/.test(normalized) ||
    /^TC\d+$/.test(normalized) ||
    /^TH\d+$/.test(normalized) ||
    /^YT\d+$/.test(normalized)
  );
}

function isNormalLogin(row: EquipmentLoginStatus): boolean {
  return Boolean(row.operatorName && row.loginText && !row.stopReason);
}

function activeFingerprint(row: EquipmentLoginStatus): string {
  return [
    row.equipmentId.toUpperCase().replace(/\s+/g, ""),
    clean(row.operatorName),
    clean(row.loginText),
  ].join("|");
}

function fingerprintKey(fingerprints: string[]): string {
  return [...fingerprints].sort().join("||");
}

function hasNewFingerprint(current: string[], baseline: Set<string>): boolean {
  return current.some((value) => !baseline.has(value));
}

function toKstDateParts(input: string) {
  const date = new Date(input);
  const shifted = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

function toUtcIsoFromKst(year: number, month: number, day: number, hour: number, minute: number): string {
  return new Date(Date.UTC(year, month - 1, day, hour - 9, minute, 0)).toISOString();
}

function addKstDays(parts: ReturnType<typeof toKstDateParts>, days: number) {
  const base = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, 0, 0, 0));
  return {
    year: base.getUTCFullYear(),
    month: base.getUTCMonth() + 1,
    day: base.getUTCDate(),
  };
}

function nextShiftBoundaryIso(asOf: string): string {
  const parts = toKstDateParts(asOf);

  if (parts.hour < 6 || (parts.hour === 6 && parts.minute < 45)) {
    return toUtcIsoFromKst(parts.year, parts.month, parts.day, 6, 45);
  }

  if (parts.hour < 18 || (parts.hour === 18 && parts.minute < 45)) {
    return toUtcIsoFromKst(parts.year, parts.month, parts.day, 18, 45);
  }

  const nextDay = addKstDays(parts, 1);
  return toUtcIsoFromKst(nextDay.year, nextDay.month, nextDay.day, 6, 45);
}

function deriveScheduleSignal(vessels: VesselScheduleItem[], seenAt: string): ScheduleSignal {
  const first = vessels[0];
  if (!first) {
    return {
      ready: false,
      observedAt: seenAt,
      firstEta: null,
      etaGapMs: null,
      precedingGreenCount: 0,
    };
  }

  const rowColor = clean(first.rawLabelMap?._rowColor).toLowerCase();
  const precedingGreenCount = Number(first.rawLabelMap?._precedingGreenCount || 0) || 0;
  const etaMs = first.eta ? Date.parse(first.eta) : Number.NaN;
  const seenAtMs = Date.parse(seenAt);
  const etaGapMs = Number.isFinite(etaMs) && Number.isFinite(seenAtMs) ? etaMs - seenAtMs : null;

  return {
    ready: rowColor === "yellow" && precedingGreenCount > 0 && etaGapMs !== null && etaGapMs >= FUTURE_ETA_GAP_MS,
    observedAt: seenAt,
    firstEta: first.eta,
    etaGapMs,
    precedingGreenCount,
  };
}

function deriveWorkSignal(html: string, seenAt: string): WorkSignal {
  const $ = load(html);
  const tables = $("table.AA_list").toArray();
  const seenAtMs = Date.parse(seenAt);

  for (const table of tables) {
    const headers = $(table)
      .find("tr")
      .first()
      .find("th")
      .map((_, th) => clean($(th).text()))
      .get();

    if (!headers.length) {
      continue;
    }

    const etaIdx = findHeaderIndex(headers, ["입항일시", "입항 일시"]);
    const progressIdx = findHeaderIndex(headers, ["진행률"]);
    if (etaIdx < 0 || progressIdx < 0) {
      continue;
    }

    const rows = $(table)
      .find("tr")
      .slice(1)
      .toArray()
      .map((row) =>
        $(row)
          .find("td")
          .map((_, td) => clean($(td).text()))
          .get(),
      )
      .filter((cells) => cells.length > Math.max(etaIdx, progressIdx));

    const summaries = rows
      .map((cells) => {
        const eta = parseSeoulDate(cells[etaIdx] || null);
        const progressPercent = parseNumeric(cells[progressIdx]);
        if (!eta || progressPercent === null) {
          return null;
        }
        const etaMs = Date.parse(eta);
        return {
          eta,
          progressPercent,
          etaGapMs: Number.isFinite(etaMs) && Number.isFinite(seenAtMs) ? etaMs - seenAtMs : null,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    if (!summaries.length) {
      continue;
    }

    const nearestEtaGapMs = summaries.reduce<number | null>((current, row) => {
      if (row.etaGapMs === null) {
        return current;
      }
      if (current === null) {
        return row.etaGapMs;
      }
      return Math.min(current, row.etaGapMs);
    }, null);
    const nearestEta =
      nearestEtaGapMs === null
        ? null
        : summaries.find((row) => row.etaGapMs === nearestEtaGapMs)?.eta || null;

    return {
      ready: summaries.every((row) => row.progressPercent <= 0 && row.etaGapMs !== null && row.etaGapMs >= FUTURE_ETA_GAP_MS),
      observedAt: seenAt,
      rowCount: summaries.length,
      nearestEta,
      nearestEtaGapMs,
    };
  }

  return {
    ready: false,
    observedAt: seenAt,
    rowCount: 0,
    nearestEta: null,
    nearestEtaGapMs: null,
  };
}

function deriveEquipmentSignal(
  equipment: EquipmentLoginStatus[],
  previousFingerprintKey: string | null,
  previousStableObservations: number,
  seenAt: string,
): EquipmentSignal {
  const eligible = equipment.filter((row) => isOperationalEquipmentId(row.equipmentId));
  const activeFingerprints = eligible.filter(isNormalLogin).map(activeFingerprint);
  const activeKey = fingerprintKey(activeFingerprints);
  const stableIdleObservations =
    activeFingerprints.length <= MAX_IDLE_ACTIVE_LOGINS
      ? activeKey === previousFingerprintKey
        ? previousStableObservations + 1
        : 1
      : 0;

  return {
    ready:
      eligible.length > 0 &&
      activeFingerprints.length <= MAX_IDLE_ACTIVE_LOGINS &&
      stableIdleObservations >= REQUIRED_IDLE_STABLE_OBSERVATIONS,
    observedAt: seenAt,
    eligibleCount: eligible.length,
    activeCount: activeFingerprints.length,
    idleStableObservations: stableIdleObservations,
    activeFingerprints: [...activeFingerprints].sort(),
  };
}

export class GwctCadenceGovernor {
  private mode: CadenceMode = "fast";
  private holdFastUntilShiftBoundaryAt: string | null = null;
  private relaxedUntilShiftBoundaryAt: string | null = null;
  private relaxedBaselineActiveFingerprints = new Set<string>();
  private lastEquipmentFingerprintKey: string | null = null;
  private scheduleSignal: ScheduleSignal = {
    ready: false,
    observedAt: null,
    firstEta: null,
    etaGapMs: null,
    precedingGreenCount: 0,
  };
  private workSignal: WorkSignal = {
    ready: false,
    observedAt: null,
    rowCount: 0,
    nearestEta: null,
    nearestEtaGapMs: null,
  };
  private equipmentSignal: EquipmentSignal = {
    ready: false,
    observedAt: null,
    eligibleCount: 0,
    activeCount: 0,
    idleStableObservations: 0,
    activeFingerprints: [],
  };

  constructor(private readonly logger: Pick<FastifyBaseLogger, "info">) {}

  observe(input: { source: SourceId; seenAt: string; html: string; bundle: NormalizedSnapshotBundle }): void {
    if (!MANAGED_SOURCES.has(input.source)) {
      return;
    }

    const seenAtMs = Date.parse(input.seenAt);
    if (!Number.isFinite(seenAtMs)) {
      return;
    }

    this.releaseHoldIfExpired(seenAtMs);
    this.exitRelaxedIfShiftBoundaryPassed(seenAtMs);

    if (input.source === "gwct_schedule_list") {
      this.scheduleSignal = deriveScheduleSignal(input.bundle.vessels, input.seenAt);
    }

    if (input.source === "gwct_work_status") {
      this.workSignal = deriveWorkSignal(input.html, input.seenAt);
    }

    if (input.source === "gwct_equipment_status") {
      this.equipmentSignal = deriveEquipmentSignal(
        input.bundle.equipment,
        this.lastEquipmentFingerprintKey,
        this.equipmentSignal.idleStableObservations,
        input.seenAt,
      );
      this.lastEquipmentFingerprintKey = fingerprintKey(this.equipmentSignal.activeFingerprints);
    }

    if (this.mode === "relaxed" && input.source === "gwct_equipment_status") {
      const currentActive = this.equipmentSignal.activeFingerprints;
      if (
        currentActive.length > 0 &&
        hasNewFingerprint(currentActive, this.relaxedBaselineActiveFingerprints)
      ) {
        const activeCount = this.equipmentSignal.activeCount;
        this.holdFastUntilShiftBoundaryAt = nextShiftBoundaryIso(input.seenAt);
        this.clearSignalsForFreshCycle();
        this.setMode("fast", input.seenAt, "equipment_login_activity", {
          holdFastUntilShiftBoundaryAt: this.holdFastUntilShiftBoundaryAt,
          activeCount,
        });
        return;
      }
    }

    const shouldRelax = this.shouldRelax(seenAtMs);

    if (this.mode === "relaxed" && !shouldRelax) {
      this.relaxedUntilShiftBoundaryAt = null;
      this.relaxedBaselineActiveFingerprints = new Set();
      this.setMode("fast", input.seenAt, "signals_no_longer_match", {
        scheduleReady: this.scheduleSignal.ready,
        workReady: this.workSignal.ready,
        equipmentReady: this.equipmentSignal.ready,
      });
      return;
    }

    if (this.mode === "fast" && shouldRelax) {
      this.relaxedUntilShiftBoundaryAt = nextShiftBoundaryIso(input.seenAt);
      this.relaxedBaselineActiveFingerprints = new Set(this.equipmentSignal.activeFingerprints);
      this.setMode("relaxed", input.seenAt, "early_off_duty_detected", {
        relaxedUntilShiftBoundaryAt: this.relaxedUntilShiftBoundaryAt,
        firstScheduleEta: this.scheduleSignal.firstEta,
        workEta: this.workSignal.nearestEta,
        activeEquipmentCount: this.equipmentSignal.activeCount,
      });
    }
  }

  intervalMsFor(sourceDef: SourceDefinition, asOf = new Date()): number {
    const asOfMs = asOf.getTime();
    if (Number.isFinite(asOfMs)) {
      this.releaseHoldIfExpired(asOfMs);
      this.exitRelaxedIfShiftBoundaryPassed(asOfMs);
    }

    if (this.mode !== "relaxed" || !MANAGED_SOURCES.has(sourceDef.source)) {
      return sourceDef.intervalMs;
    }

    const relaxedIntervalMs = RELAXED_INTERVALS[sourceDef.source] ?? sourceDef.intervalMs;
    if (!this.relaxedUntilShiftBoundaryAt || !Number.isFinite(asOfMs)) {
      return relaxedIntervalMs;
    }

    const boundaryMs = Date.parse(this.relaxedUntilShiftBoundaryAt);
    if (!Number.isFinite(boundaryMs)) {
      return relaxedIntervalMs;
    }

    return Math.max(0, Math.min(relaxedIntervalMs, boundaryMs - asOfMs));
  }

  snapshot() {
    return {
      mode: this.mode,
      holdFastUntilShiftBoundaryAt: this.holdFastUntilShiftBoundaryAt,
      relaxedUntilShiftBoundaryAt: this.relaxedUntilShiftBoundaryAt,
      scheduleSignal: { ...this.scheduleSignal },
      workSignal: { ...this.workSignal },
      equipmentSignal: {
        ...this.equipmentSignal,
        activeFingerprints: [...this.equipmentSignal.activeFingerprints],
      },
    };
  }

  private shouldRelax(asOfMs: number): boolean {
    if (this.holdFastUntilShiftBoundaryAt) {
      const holdMs = Date.parse(this.holdFastUntilShiftBoundaryAt);
      if (Number.isFinite(holdMs) && asOfMs < holdMs) {
        return false;
      }
    }

    return this.scheduleSignal.ready && this.workSignal.ready && this.equipmentSignal.ready;
  }

  private releaseHoldIfExpired(asOfMs: number): void {
    if (!this.holdFastUntilShiftBoundaryAt) {
      return;
    }

    const holdMs = Date.parse(this.holdFastUntilShiftBoundaryAt);
    if (Number.isFinite(holdMs) && asOfMs >= holdMs) {
      this.holdFastUntilShiftBoundaryAt = null;
    }
  }

  private exitRelaxedIfShiftBoundaryPassed(asOfMs: number): void {
    if (!this.relaxedUntilShiftBoundaryAt) {
      return;
    }

    const boundaryMs = Date.parse(this.relaxedUntilShiftBoundaryAt);
    if (!Number.isFinite(boundaryMs) || asOfMs < boundaryMs) {
      return;
    }

    const occurredAt = new Date(asOfMs).toISOString();
    const relaxedUntilShiftBoundaryAt = this.relaxedUntilShiftBoundaryAt;
    this.clearSignalsForFreshCycle();
    this.setMode("fast", occurredAt, "shift_boundary", {
      relaxedUntilShiftBoundaryAt,
    });
  }

  private clearSignalsForFreshCycle(): void {
    this.relaxedUntilShiftBoundaryAt = null;
    this.relaxedBaselineActiveFingerprints = new Set();
    this.scheduleSignal = {
      ready: false,
      observedAt: null,
      firstEta: null,
      etaGapMs: null,
      precedingGreenCount: 0,
    };
    this.workSignal = {
      ready: false,
      observedAt: null,
      rowCount: 0,
      nearestEta: null,
      nearestEtaGapMs: null,
    };
    this.equipmentSignal = {
      ready: false,
      observedAt: null,
      eligibleCount: 0,
      activeCount: 0,
      idleStableObservations: 0,
      activeFingerprints: [],
    };
    this.lastEquipmentFingerprintKey = null;
  }

  private setMode(nextMode: CadenceMode, occurredAt: string, reason: string, details: Record<string, unknown>): void {
    if (this.mode === nextMode) {
      return;
    }

    this.mode = nextMode;
    this.logger.info(
      {
        mode: nextMode,
        reason,
        occurredAt,
        details,
      },
      "gwct scrape cadence mode changed",
    );
  }
}
