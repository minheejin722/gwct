import type {
  YTUnitSnapshot,
  YTWorkDriverSummary,
  YTWorkShiftIndicator,
  YTWorkStopReasonCounter,
  YTWorkStopReasonCounterKind,
  YTWorkSession,
  YTWorkSessionBreak,
  YTWorkSessionResponse,
  YTWorkSessionStatus,
  YTWorkShiftMode,
  YTSemanticState,
} from "@gwct/shared";
import { loadYtWorkTimeRawState, saveYtWorkTimeRawState } from "./store.js";

const KST_TIMEZONE = "Asia/Seoul";
const KST_OFFSET = "+09:00";
const DAY_SHIFT_START = { hour: 6, minute: 45 } as const;
const DAY_SHIFT_END = { hour: 18, minute: 45 } as const;
const NIGHT_SHIFT_START = DAY_SHIFT_END;
const SHIFT_LOGIN_GRACE_MS = 30 * 60 * 1000;

type TrackedStopReasonRule = {
  kind: YTWorkStopReasonCounterKind;
  label: string;
  pattern: RegExp;
  adjustmentMinutes: number;
  keepsWorkingDuringInactivity?: boolean;
};

const TRACKED_STOP_REASON_RULES: TrackedStopReasonRule[] = [
  {
    kind: "over_high",
    label: "오바하이",
    pattern: /\bB\s*\/?\s*BULK\b|오바(?:잇|하이)?|와이어|OVER[\s-]?HEIGHT/iu,
    adjustmentMinutes: 30,
    keepsWorkingDuringInactivity: true,
  },
  {
    kind: "cabin_shuttle",
    label: "캐빈셔틀",
    pattern: /캐빈\s*셔틀/u,
    adjustmentMinutes: 0,
  },
  {
    kind: "ship_work_request_stop",
    label: "본선작업요청중단",
    pattern: /본선\s*작업/u,
    adjustmentMinutes: 0,
  },
  {
    kind: "restroom",
    label: "화장실",
    pattern: /화장실/u,
    adjustmentMinutes: -15,
  },
];

interface StoredYtWorkDriver {
  driverKey: string;
  driverName: string;
  latestYtNo: string | null;
  activeYtNo: string | null;
  totalWorkedMs: number;
  currentSegmentStartedAt: string | null;
  latestState: YTSemanticState;
  latestStopReason: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  lastWorkedAt: string | null;
  segments: number;
  stopReasonCountMap: Record<YTWorkStopReasonCounterKind, number>;
  lastCountedStopReasonKey: string | null;
}

interface StoredYtWorkSession {
  version: 1;
  mode: YTWorkShiftMode;
  status: YTWorkSessionStatus;
  shiftWindowStartedAt: string;
  startedAt: string;
  endsAt: string;
  completedAt: string | null;
  observedAt: string;
  timezone: string;
  breaks: YTWorkSessionBreak[];
  drivers: Record<string, StoredYtWorkDriver>;
}

interface ShiftWindow {
  mode: YTWorkShiftMode;
  shiftWindowStartedAt: string;
  endsAt: string;
  breaks: YTWorkSessionBreak[];
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function toKstParts(date: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: KST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const raw = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return {
    year: Number(raw.year),
    month: Number(raw.month),
    day: Number(raw.day),
    hour: Number(raw.hour),
    minute: Number(raw.minute),
    second: Number(raw.second),
  };
}

function kstDate(year: number, month: number, day: number, hour: number, minute = 0, second = 0): Date {
  return new Date(`${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}${KST_OFFSET}`);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function isValidDate(date: Date): boolean {
  return Number.isFinite(date.getTime());
}

function compareIsoTimes(left: string | null | undefined, right: string | null | undefined): number {
  const leftMs = left ? new Date(left).getTime() : Number.NaN;
  const rightMs = right ? new Date(right).getTime() : Number.NaN;
  if (!Number.isFinite(leftMs) || !Number.isFinite(rightMs)) {
    return 0;
  }
  if (leftMs === rightMs) {
    return 0;
  }
  return leftMs < rightMs ? -1 : 1;
}

function startOfDayFor(date: Date): Date {
  const parts = toKstParts(date);
  return kstDate(parts.year, parts.month, parts.day, 0);
}

function dayShiftStartFor(date: Date): Date {
  const parts = toKstParts(date);
  return kstDate(parts.year, parts.month, parts.day, DAY_SHIFT_START.hour, DAY_SHIFT_START.minute);
}

function nightShiftStartFor(date: Date): Date {
  const parts = toKstParts(date);
  return kstDate(parts.year, parts.month, parts.day, NIGHT_SHIFT_START.hour, NIGHT_SHIFT_START.minute);
}

function shiftBreaksForWindow(mode: YTWorkShiftMode, shiftStart: Date): YTWorkSessionBreak[] {
  if (mode === "day") {
    const parts = toKstParts(shiftStart);
    const lunchStart = kstDate(parts.year, parts.month, parts.day, 12);
    const lunchEnd = kstDate(parts.year, parts.month, parts.day, 12, 40);
    return [
      {
        label: "?먯떖 ?댁떇",
        startAt: lunchStart.toISOString(),
        endAt: lunchEnd.toISOString(),
      },
    ];
  }

  const nextDay = addDays(startOfDayFor(shiftStart), 1);
  const parts = toKstParts(nextDay);
  const midnight = kstDate(parts.year, parts.month, parts.day, 0);
  const oneAm = kstDate(parts.year, parts.month, parts.day, 0, 40);
  return [
    {
      label: "?먯젙 ?댁떇",
      startAt: midnight.toISOString(),
      endAt: oneAm.toISOString(),
    },
  ];
}

function buildShiftWindowFromStart(mode: YTWorkShiftMode, shiftStart: Date): ShiftWindow {
  const endsAt =
    mode === "day"
      ? nightShiftStartFor(shiftStart)
      : dayShiftStartFor(addDays(shiftStart, 1));

  return {
    mode,
    shiftWindowStartedAt: shiftStart.toISOString(),
    endsAt: endsAt.toISOString(),
    breaks: shiftBreaksForWindow(mode, shiftStart),
  };
}

function getShiftWindowForObservedAt(observedAt: string): ShiftWindow | null {
  const observedDate = new Date(observedAt);
  if (!isValidDate(observedDate)) {
    return null;
  }

  const dayWindow = buildShiftWindowFromStart("day", dayShiftStartFor(observedDate));
  const observedMs = observedDate.getTime();
  const dayStartMs = new Date(dayWindow.shiftWindowStartedAt).getTime();
  const dayEndMs = new Date(dayWindow.endsAt).getTime();

  if (observedMs >= dayStartMs && observedMs < dayEndMs) {
    return dayWindow;
  }

  const nightStart = observedDate >= nightShiftStartFor(observedDate)
    ? nightShiftStartFor(observedDate)
    : nightShiftStartFor(addDays(observedDate, -1));
  return buildShiftWindowFromStart("night", nightStart);
}

export function getYtWorkShiftWindowForObservedAt(observedAt: string): {
  mode: YTWorkShiftMode;
  shiftWindowStartedAt: string;
  endsAt: string;
  breaks: YTWorkSessionBreak[];
} | null {
  const shiftWindow = getShiftWindowForObservedAt(observedAt);
  if (!shiftWindow) {
    return null;
  }
  return {
    mode: shiftWindow.mode,
    shiftWindowStartedAt: shiftWindow.shiftWindowStartedAt,
    endsAt: shiftWindow.endsAt,
    breaks: shiftWindow.breaks,
  };
}

function isSessionActiveForWindow(session: StoredYtWorkSession | null, shiftWindow: ShiftWindow | null): boolean {
  if (!session || !shiftWindow || session.status !== "active") {
    return false;
  }
  return (
    session.mode === shiftWindow.mode &&
    session.shiftWindowStartedAt === shiftWindow.shiftWindowStartedAt &&
    session.endsAt === shiftWindow.endsAt
  );
}

function isMaterializedSessionForWindow(session: YTWorkSession | null, shiftWindow: ShiftWindow | null): boolean {
  if (!session || !shiftWindow || session.status !== "active") {
    return false;
  }

  return (
    session.mode === shiftWindow.mode &&
    session.shiftWindowStartedAt === shiftWindow.shiftWindowStartedAt &&
    session.endsAt === shiftWindow.endsAt
  );
}

function isWithinBreakWindow(asOf: string, breaks: YTWorkSessionBreak[]): boolean {
  const asOfMs = new Date(asOf).getTime();
  if (!Number.isFinite(asOfMs)) {
    return false;
  }

  return breaks.some((breakWindow) => {
    const startMs = new Date(breakWindow.startAt).getTime();
    const endMs = new Date(breakWindow.endAt).getTime();
    return Number.isFinite(startMs) && Number.isFinite(endMs) && asOfMs >= startMs && asOfMs < endMs;
  });
}

function hasActiveDriver(session: YTWorkSession | null): boolean {
  if (!session) {
    return false;
  }

  return session.drivers.some((driver) => isDriverCollectingWork(driver.latestState, driver.currentSegmentStartedAt, driver.latestStopReason));
}

function buildShiftIndicator(
  state: YTWorkShiftIndicator["state"],
  reason: YTWorkShiftIndicator["reason"],
  mode: YTWorkShiftMode | null,
  label: string,
  detail: string | null,
): YTWorkShiftIndicator {
  return {
    state,
    reason,
    mode,
    label,
    detail,
  };
}

function normalizeDriverName(value: string | null | undefined): string | null {
  const normalized = (value || "").trim().replace(/\s+/g, " ");
  return normalized.length ? normalized : null;
}

function buildDriverKey(driverName: string): string {
  return driverName.replace(/\s+/g, " ").trim().toUpperCase();
}

function normalizeStopReason(value: string | null | undefined): string | null {
  const normalized = (value || "").trim().replace(/\s+/g, " ");
  return normalized.length ? normalized : null;
}

function createEmptyStopReasonCountMap(): Record<YTWorkStopReasonCounterKind, number> {
  return {
    over_high: 0,
    cabin_shuttle: 0,
    ship_work_request_stop: 0,
    restroom: 0,
  };
}

function matchTrackedStopReason(reason: string | null | undefined): TrackedStopReasonRule | null {
  const normalized = normalizeStopReason(reason);
  if (!normalized) {
    return null;
  }
  return TRACKED_STOP_REASON_RULES.find((rule) => rule.pattern.test(normalized)) || null;
}

function buildTrackedStopReasonKey(
  state: YTSemanticState,
  reason: string | null | undefined,
): string | null {
  const matched = matchTrackedStopReason(reason);
  if (!matched || state === "active") {
    return null;
  }
  return matched.kind;
}

function shouldKeepWorkingDuringInactivity(
  state: YTSemanticState,
  reason: string | null | undefined,
): boolean {
  if (state === "active") {
    return false;
  }
  const matched = matchTrackedStopReason(reason);
  return Boolean(matched?.keepsWorkingDuringInactivity);
}

function isDriverCollectingWork(
  state: YTSemanticState,
  currentSegmentStartedAt: string | null,
  stopReason: string | null | undefined,
): boolean {
  if (!currentSegmentStartedAt) {
    return false;
  }
  return state === "active" || shouldKeepWorkingDuringInactivity(state, stopReason);
}

function isWithinAwaitingLoginWindow(asOf: string, shiftWindow: ShiftWindow): boolean {
  const asOfMs = new Date(asOf).getTime();
  if (!Number.isFinite(asOfMs)) {
    return false;
  }

  const shiftGraceDeadlineMs = new Date(shiftWindow.shiftWindowStartedAt).getTime() + SHIFT_LOGIN_GRACE_MS;
  if (Number.isFinite(shiftGraceDeadlineMs) && asOfMs < shiftGraceDeadlineMs) {
    return true;
  }

  return shiftWindow.breaks.some((breakWindow) => {
    const breakEndMs = new Date(breakWindow.endAt).getTime();
    return Number.isFinite(breakEndMs) && asOfMs >= breakEndMs && asOfMs < breakEndMs + SHIFT_LOGIN_GRACE_MS;
  });
}

function applyTrackedStopReasonCounter(
  entry: StoredYtWorkDriver,
  nextState: YTSemanticState,
  stopReason: string | null | undefined,
): StoredYtWorkDriver {
  if (nextState === "active") {
    return {
      ...entry,
      lastCountedStopReasonKey: null,
    };
  }

  const matched = matchTrackedStopReason(stopReason);
  const reasonKey = buildTrackedStopReasonKey(nextState, stopReason);
  if (!matched || !reasonKey || entry.lastCountedStopReasonKey === reasonKey) {
    return entry;
  }

  return {
    ...entry,
    stopReasonCountMap: {
      ...entry.stopReasonCountMap,
      [matched.kind]: (entry.stopReasonCountMap[matched.kind] || 0) + 1,
    },
    lastCountedStopReasonKey: reasonKey,
  };
}

function materializeStopReasonCounters(
  counts: Record<YTWorkStopReasonCounterKind, number>,
): YTWorkStopReasonCounter[] {
  return TRACKED_STOP_REASON_RULES.map((rule) => ({
    kind: rule.kind,
    label: rule.label,
    count: counts[rule.kind] || 0,
  })).filter((item) => item.count > 0);
}

function formatSignedDuration(totalMinutes: number): string | null {
  if (!Number.isInteger(totalMinutes) || totalMinutes === 0) {
    return null;
  }
  const sign = totalMinutes > 0 ? "+" : "-";
  const absolute = Math.abs(totalMinutes);
  const hours = Math.floor(absolute / 60);
  const minutes = absolute % 60;
  return `${sign}${hours}시간 ${minutes}분`;
}

function calculateStopReasonAdjustmentMinutes(
  counts: Record<YTWorkStopReasonCounterKind, number>,
): number {
  return TRACKED_STOP_REASON_RULES.reduce((total, rule) => {
    return total + (counts[rule.kind] || 0) * rule.adjustmentMinutes;
  }, 0);
}

function withDriverDefaults(entry: StoredYtWorkDriver): StoredYtWorkDriver {
  return {
    ...entry,
    latestStopReason: normalizeStopReason(entry.latestStopReason),
    stopReasonCountMap: {
      ...createEmptyStopReasonCountMap(),
      ...(entry.stopReasonCountMap || {}),
    },
    lastCountedStopReasonKey: entry.lastCountedStopReasonKey || null,
  };
}

function formatWorkedDuration(totalWorkedMs: number): string {
  const totalMinutes = Math.max(0, Math.floor(totalWorkedMs / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}시간 ${minutes}분`;
}

function sortByYtNoThenName<T extends { ytNo: string; driverName: string | null }>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    const leftNo = Number(left.ytNo.replace(/^\D+/, ""));
    const rightNo = Number(right.ytNo.replace(/^\D+/, ""));
    if (Number.isFinite(leftNo) && Number.isFinite(rightNo) && leftNo !== rightNo) {
      return leftNo - rightNo;
    }
    return (left.driverName || "").localeCompare(right.driverName || "");
  });
}

function overlapMs(startMs: number, endMs: number, breakStartMs: number, breakEndMs: number): number {
  const overlapStart = Math.max(startMs, breakStartMs);
  const overlapEnd = Math.min(endMs, breakEndMs);
  return Math.max(0, overlapEnd - overlapStart);
}

function effectiveWorkedMs(startAt: string, endAt: string, breaks: YTWorkSessionBreak[]): number {
  const startMs = new Date(startAt).getTime();
  const endMs = new Date(endAt).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return 0;
  }

  let total = endMs - startMs;
  for (const breakWindow of breaks) {
    total -= overlapMs(startMs, endMs, new Date(breakWindow.startAt).getTime(), new Date(breakWindow.endAt).getTime());
  }
  return Math.max(0, total);
}

function buildWorkSessionState(
  shiftWindow: ShiftWindow,
  observedAt: string,
  units: YTUnitSnapshot[],
): StoredYtWorkSession {
  const drivers = Object.fromEntries(
    sortByYtNoThenName(units)
      .map((unit) => seedDriverEntry(unit, observedAt))
      .filter((entry): entry is StoredYtWorkDriver => Boolean(entry))
      .map((entry) => [entry.driverKey, entry]),
  );

  return {
    version: 1,
    mode: shiftWindow.mode,
    status: "active",
    shiftWindowStartedAt: shiftWindow.shiftWindowStartedAt,
    startedAt: observedAt,
    endsAt: shiftWindow.endsAt,
    completedAt: null,
    observedAt,
    timezone: KST_TIMEZONE,
    breaks: shiftWindow.breaks,
    drivers,
  };
}

function seedDriverEntry(unit: YTUnitSnapshot, observedAt: string): StoredYtWorkDriver | null {
  const driverName = normalizeDriverName(unit.driverName);
  if (!driverName || unit.semanticState !== "active") {
    return null;
  }

  return {
    driverKey: buildDriverKey(driverName),
    driverName,
    latestYtNo: unit.ytNo,
    activeYtNo: unit.ytNo,
    totalWorkedMs: 0,
    currentSegmentStartedAt: observedAt,
    latestState: "active",
    latestStopReason: null,
    firstSeenAt: observedAt,
    lastSeenAt: observedAt,
    lastWorkedAt: null,
    segments: 0,
    stopReasonCountMap: createEmptyStopReasonCountMap(),
    lastCountedStopReasonKey: null,
  };
}

function closeSegment(entry: StoredYtWorkDriver, endAt: string, breaks: YTWorkSessionBreak[]): StoredYtWorkDriver {
  if (!entry.currentSegmentStartedAt) {
    return entry;
  }

  const workedMs = effectiveWorkedMs(entry.currentSegmentStartedAt, endAt, breaks);
  return {
    ...entry,
    totalWorkedMs: entry.totalWorkedMs + workedMs,
    currentSegmentStartedAt: null,
    activeYtNo: null,
    lastWorkedAt: endAt,
    segments: entry.segments + 1,
  };
}

function finalizeIfExpired(session: StoredYtWorkSession, asOf: string): StoredYtWorkSession {
  if (session.status !== "active") {
    return session;
  }

  const endMs = new Date(session.endsAt).getTime();
  const asOfMs = new Date(asOf).getTime();
  if (!Number.isFinite(endMs) || !Number.isFinite(asOfMs) || asOfMs < endMs) {
    return session;
  }

  const finalizedDrivers = Object.fromEntries(
    Object.entries(session.drivers).map(([key, entry]) => {
      const closed = closeSegment(withDriverDefaults(entry), session.endsAt, session.breaks);
      return [
        key,
        {
          ...closed,
          latestState: closed.latestState === "active" ? "logged_out" : closed.latestState,
          latestStopReason: closed.latestState === "active" ? null : closed.latestStopReason,
        },
      ];
    }),
  );

  return {
    ...session,
    status: "completed",
    completedAt: session.endsAt,
    observedAt: session.endsAt,
    drivers: finalizedDrivers,
  };
}

function buildNamedUnitMap(units: YTUnitSnapshot[]): Map<string, YTUnitSnapshot> {
  const map = new Map<string, YTUnitSnapshot>();
  for (const unit of sortByYtNoThenName(units)) {
    const driverName = normalizeDriverName(unit.driverName);
    if (!driverName) {
      continue;
    }
    const key = buildDriverKey(driverName);
    if (!map.has(key)) {
      map.set(key, {
        ...unit,
        driverName,
      });
    }
  }
  return map;
}

function buildYtNoUnitMap(units: YTUnitSnapshot[]): Map<string, YTUnitSnapshot> {
  const map = new Map<string, YTUnitSnapshot>();
  for (const unit of sortByYtNoThenName(units)) {
    if (!map.has(unit.ytNo)) {
      map.set(unit.ytNo, unit);
    }
  }
  return map;
}

export function startYtWorkSessionState(
  mode: YTWorkShiftMode,
  observedAt: string,
  units: YTUnitSnapshot[],
): StoredYtWorkSession {
  const shiftWindow = getShiftWindowForObservedAt(observedAt);
  if (!shiftWindow || shiftWindow.mode !== mode) {
    throw new Error(`Observed time does not match ${mode} shift window.`);
  }
  return buildWorkSessionState(shiftWindow, observedAt, units);
}

export function applyYtWorkSnapshot(
  session: StoredYtWorkSession,
  units: YTUnitSnapshot[],
  observedAt: string,
): StoredYtWorkSession {
  const finalized = finalizeIfExpired(session, observedAt);
  if (compareIsoTimes(observedAt, finalized.observedAt) <= 0) {
    return finalized;
  }
  if (finalized.status !== "active") {
    return finalized;
  }

  const cutoffAt = new Date(observedAt).getTime() > new Date(finalized.endsAt).getTime() ? finalized.endsAt : observedAt;
  const namedUnits = buildNamedUnitMap(units);
  const ytUnitsByNo = buildYtNoUnitMap(units);
  const activeUnits = new Map(
    [...namedUnits.entries()].filter(([, unit]) => unit.semanticState === "active"),
  );

  const nextDrivers: Record<string, StoredYtWorkDriver> = {};

  for (const [driverKey, existing] of Object.entries(finalized.drivers)) {
    const existingEntry = withDriverDefaults(existing);
    const latestNamed = namedUnits.get(driverKey) || null;
    const activeUnit = activeUnits.get(driverKey) || null;
    const trackedYtNo = existingEntry.activeYtNo || existingEntry.latestYtNo;
    const latestByYtNoCandidate = trackedYtNo ? ytUnitsByNo.get(trackedYtNo) || null : null;
    const latestByYtNo =
      latestByYtNoCandidate && !normalizeDriverName(latestByYtNoCandidate.driverName) ? latestByYtNoCandidate : null;
    const trackedYtDriverName = normalizeDriverName(latestByYtNoCandidate?.driverName);
    const hasTrackedYtHandoff =
      Boolean(trackedYtDriverName) && buildDriverKey(trackedYtDriverName as string) !== driverKey;
    const latestObserved = latestNamed || latestByYtNo;
    const normalizedObservedStopReason = normalizeStopReason(latestObserved?.stopReason);
    let nextEntry = { ...existingEntry };

    if (nextEntry.currentSegmentStartedAt && !activeUnit) {
      const observedInactiveState = latestObserved?.semanticState || nextEntry.latestState;
      const observedStopReason = normalizedObservedStopReason || nextEntry.latestStopReason;
      const keepWorking =
        !hasTrackedYtHandoff && shouldKeepWorkingDuringInactivity(observedInactiveState, observedStopReason);

      if (keepWorking) {
        nextEntry.activeYtNo = null;
        nextEntry.latestState = observedInactiveState;
        nextEntry.latestStopReason = observedStopReason;
        nextEntry.latestYtNo = latestObserved?.ytNo || nextEntry.latestYtNo;
      } else {
        nextEntry = closeSegment(nextEntry, cutoffAt, finalized.breaks);
        nextEntry.latestState = latestObserved?.semanticState || "logged_out";
        nextEntry.latestStopReason = normalizedObservedStopReason || nextEntry.latestStopReason;
        nextEntry.latestYtNo = latestObserved?.ytNo || nextEntry.latestYtNo;
      }
    } else if (!nextEntry.currentSegmentStartedAt && activeUnit) {
      nextEntry.currentSegmentStartedAt = cutoffAt;
      nextEntry.activeYtNo = activeUnit.ytNo;
      nextEntry.latestYtNo = activeUnit.ytNo;
      nextEntry.latestState = "active";
      nextEntry.latestStopReason = null;
    } else if (nextEntry.currentSegmentStartedAt && activeUnit) {
      nextEntry.activeYtNo = activeUnit.ytNo;
      nextEntry.latestYtNo = activeUnit.ytNo;
      nextEntry.latestState = "active";
      nextEntry.latestStopReason = null;
    } else if (latestObserved) {
      nextEntry.latestState = latestObserved.semanticState;
      nextEntry.latestStopReason = normalizedObservedStopReason || nextEntry.latestStopReason;
      nextEntry.latestYtNo = latestObserved.ytNo;
    } else {
      nextEntry.latestState = "logged_out";
      // Preserve the last observed stop reason so a full logout still carries
      // the final operational trace seen before the driver disappeared.
    }

    nextEntry.driverName = latestNamed?.driverName || nextEntry.driverName;
    nextEntry.lastSeenAt = observedAt;
    nextEntry = applyTrackedStopReasonCounter(nextEntry, nextEntry.latestState, nextEntry.latestStopReason);
    nextDrivers[driverKey] = nextEntry;
  }

  for (const [driverKey, activeUnit] of activeUnits.entries()) {
    if (nextDrivers[driverKey]) {
      continue;
    }
    const driverName = normalizeDriverName(activeUnit.driverName);
    if (!driverName) {
      continue;
    }
    nextDrivers[driverKey] = {
      driverKey,
      driverName,
      latestYtNo: activeUnit.ytNo,
      activeYtNo: activeUnit.ytNo,
      totalWorkedMs: 0,
      currentSegmentStartedAt: cutoffAt,
      latestState: "active",
      latestStopReason: null,
      firstSeenAt: observedAt,
      lastSeenAt: observedAt,
      lastWorkedAt: null,
      segments: 0,
      stopReasonCountMap: createEmptyStopReasonCountMap(),
      lastCountedStopReasonKey: null,
    };
  }

  return {
    ...finalized,
    observedAt,
    drivers: nextDrivers,
  };
}

function buildDriverSummary(
  entry: StoredYtWorkDriver,
  asOf: string,
  breaks: YTWorkSessionBreak[],
): YTWorkDriverSummary {
  const normalizedEntry = withDriverDefaults(entry);
  const liveWorkedMs =
    normalizedEntry.currentSegmentStartedAt
      ? effectiveWorkedMs(normalizedEntry.currentSegmentStartedAt, asOf, breaks)
      : 0;
  const totalWorkedMs = normalizedEntry.totalWorkedMs + liveWorkedMs;
  const totalWorkedMinutes = Math.floor(totalWorkedMs / 60_000);
  const adjustmentDeltaMinutes = calculateStopReasonAdjustmentMinutes(normalizedEntry.stopReasonCountMap);
  const adjustmentDeltaMs = adjustmentDeltaMinutes * 60_000;
  const adjustedWorkedMs = Math.max(0, totalWorkedMs + adjustmentDeltaMs);
  const adjustedWorkedMinutes = Math.floor(adjustedWorkedMs / 60_000);

  return {
    driverKey: normalizedEntry.driverKey,
    driverName: normalizedEntry.driverName,
    latestYtNo: normalizedEntry.latestYtNo,
    activeYtNo: normalizedEntry.activeYtNo,
    totalWorkedMs,
    totalWorkedMinutes,
    totalWorkedLabel: formatWorkedDuration(totalWorkedMs),
    adjustedWorkedMs,
    adjustedWorkedMinutes,
    adjustedWorkedLabel: formatWorkedDuration(adjustedWorkedMs),
    adjustmentDeltaMs,
    adjustmentDeltaMinutes,
    adjustmentDeltaLabel: formatSignedDuration(adjustmentDeltaMinutes),
    currentSegmentStartedAt: normalizedEntry.currentSegmentStartedAt,
    latestState: normalizedEntry.latestState,
    latestStopReason: normalizedEntry.latestStopReason,
    firstSeenAt: normalizedEntry.firstSeenAt,
    lastSeenAt: normalizedEntry.lastSeenAt,
    lastWorkedAt: normalizedEntry.lastWorkedAt,
    segments: normalizedEntry.segments,
    stopReasonCounters: materializeStopReasonCounters(normalizedEntry.stopReasonCountMap),
  };
}

export function materializeYtWorkSession(
  session: StoredYtWorkSession | null,
  asOf: string,
): YTWorkSession | null {
  if (!session) {
    return null;
  }

  const finalized = finalizeIfExpired(session, asOf);
  const cappedAsOf =
    new Date(asOf).getTime() > new Date(finalized.endsAt).getTime() ? finalized.endsAt : asOf;

  const drivers = Object.values(finalized.drivers)
    .map((entry) => buildDriverSummary(entry, cappedAsOf, finalized.breaks))
    .sort((left, right) => {
      if (right.adjustedWorkedMs !== left.adjustedWorkedMs) {
        return right.adjustedWorkedMs - left.adjustedWorkedMs;
      }
      if (right.totalWorkedMs !== left.totalWorkedMs) {
        return right.totalWorkedMs - left.totalWorkedMs;
      }
      const firstSeenComparison = compareIsoTimes(left.firstSeenAt, right.firstSeenAt);
      if (firstSeenComparison !== 0) {
        return firstSeenComparison;
      }
      const currentSegmentComparison = compareIsoTimes(left.currentSegmentStartedAt, right.currentSegmentStartedAt);
      if (currentSegmentComparison !== 0) {
        return currentSegmentComparison;
      }
      return left.driverName.localeCompare(right.driverName);
    });

  return {
    mode: finalized.mode,
    status: finalized.status,
    shiftWindowStartedAt: finalized.shiftWindowStartedAt,
    startedAt: finalized.startedAt,
    endsAt: finalized.endsAt,
    completedAt: finalized.completedAt,
    observedAt: finalized.observedAt,
    timezone: finalized.timezone,
    breaks: finalized.breaks,
    drivers,
  };
}

export function deriveYtWorkShiftIndicator(
  session: YTWorkSession | null,
  asOf: string,
  hasLiveSnapshot: boolean,
): YTWorkShiftIndicator {
  const currentWindow = getShiftWindowForObservedAt(asOf);

  if (!currentWindow || !hasLiveSnapshot) {
    return buildShiftIndicator("idle", "no_snapshot", currentWindow?.mode || null, "공백", "집계 데이터 대기 중");
  }

  if (!isMaterializedSessionForWindow(session, currentWindow)) {
    return buildShiftIndicator("idle", "no_snapshot", currentWindow.mode, "공백", "현재 교대 데이터 대기 중");
  }

  if (isWithinBreakWindow(asOf, currentWindow.breaks)) {
    return buildShiftIndicator(
      "paused",
      "break_time",
      currentWindow.mode,
      "일시 정지",
      currentWindow.mode === "day" ? "점심 휴식 12:00 - 12:40" : "새벽 휴식 00:00 - 00:40",
    );
  }

  if (hasActiveDriver(session)) {
    return buildShiftIndicator(
      "collecting",
      "active_shift",
      currentWindow.mode,
      "집계중",
      currentWindow.mode === "day" ? "주간 자동 집계" : "야간 자동 집계",
    );
  }

  if (isWithinAwaitingLoginWindow(asOf, currentWindow)) {
    return buildShiftIndicator("paused", "awaiting_login", currentWindow.mode, "일시 정지", "로그인 대기 중");
  }

  return buildShiftIndicator("paused", "team_off", currentWindow.mode, "일시 정지", "30분 이상 무로그인");
}

export function reconcileYtWorkSnapshotState(
  session: StoredYtWorkSession | null,
  units: YTUnitSnapshot[],
  observedAt: string,
): StoredYtWorkSession | null {
  const currentWindow = getShiftWindowForObservedAt(observedAt);
  const currentSession = session ? finalizeIfExpired(session, observedAt) : null;

  if (currentSession && compareIsoTimes(observedAt, currentSession.observedAt) <= 0) {
    return currentSession;
  }

  if (!currentWindow) {
    return currentSession;
  }

  if (currentSession && isSessionActiveForWindow(currentSession, currentWindow)) {
    return applyYtWorkSnapshot(currentSession, units, observedAt);
  }

  return buildWorkSessionState(currentWindow, observedAt, units);
}

export async function loadYtWorkSessionState(): Promise<StoredYtWorkSession | null> {
  return loadYtWorkTimeRawState<StoredYtWorkSession>();
}

export async function saveYtWorkSessionState(session: StoredYtWorkSession): Promise<void> {
  await saveYtWorkTimeRawState(session);
}

export async function observeYtWorkSnapshot(units: YTUnitSnapshot[], observedAt: string): Promise<void> {
  const currentSession = await loadYtWorkSessionState();
  const nextSession = reconcileYtWorkSnapshotState(currentSession, units, observedAt);
  if (!nextSession || JSON.stringify(currentSession) === JSON.stringify(nextSession)) {
    return;
  }
  await saveYtWorkSessionState(nextSession);
}

export async function getYtWorkSessionView(
  asOf: string,
  latestYtCapturedAt: string | null,
  hasLiveSnapshot: boolean,
): Promise<YTWorkSessionResponse> {
  const currentSession = await loadYtWorkSessionState();
  const finalizedSession = currentSession ? finalizeIfExpired(currentSession, asOf) : null;

  if (currentSession && finalizedSession && JSON.stringify(currentSession) !== JSON.stringify(finalizedSession)) {
    await saveYtWorkSessionState(finalizedSession);
  }

  const materializedSession = materializeYtWorkSession(finalizedSession, asOf);

  return {
    session: materializedSession,
    latestYtCapturedAt,
    hasLiveSnapshot,
    shiftStatus: deriveYtWorkShiftIndicator(materializedSession, asOf, hasLiveSnapshot),
  };
}

