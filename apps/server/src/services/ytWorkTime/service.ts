import type {
  YTUnitSnapshot,
  YTWorkAutoMode,
  YTWorkAutomationState,
  YTWorkDriverSummary,
  YTWorkStopReasonCounter,
  YTWorkStopReasonCounterKind,
  YTWorkSession,
  YTWorkSessionBreak,
  YTWorkSessionResponse,
  YTWorkSessionStatus,
  YTWorkShiftMode,
  YTSemanticState,
} from "@gwct/shared";
import {
  defaultYtWorkAutomationState,
  loadYtWorkAutomationState,
  saveYtWorkAutomationState,
  type StoredYtWorkAutomation,
} from "./automationStore.js";
import { loadYtWorkTimeRawState, saveYtWorkTimeRawState } from "./store.js";

const KST_TIMEZONE = "Asia/Seoul";
const KST_OFFSET = "+09:00";
const DAY_SHIFT_START = { hour: 6, minute: 45 } as const;
const DAY_SHIFT_END = { hour: 18, minute: 45 } as const;
const NIGHT_SHIFT_START = DAY_SHIFT_END;
const NIGHT_SHIFT_END = DAY_SHIFT_START;
const DAY_SHIFT_WINDOW_LABEL = "06:45~18:45";
const NIGHT_SHIFT_WINDOW_LABEL = "18:45~06:45";

type TrackedStopReasonRule = {
  kind: YTWorkStopReasonCounterKind;
  label: string;
  pattern: RegExp;
  adjustmentMinutes: number;
};

const TRACKED_STOP_REASON_RULES: TrackedStopReasonRule[] = [
  {
    kind: "over_high",
    label: "오바하이",
    pattern: /오바/u,
    adjustmentMinutes: 35,
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

class ShiftWindowError extends Error {}

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
    const lunchEnd = kstDate(parts.year, parts.month, parts.day, 13);
    return [
      {
        label: "점심 휴식",
        startAt: lunchStart.toISOString(),
        endAt: lunchEnd.toISOString(),
      },
    ];
  }

  const nextDay = addDays(startOfDayFor(shiftStart), 1);
  const parts = toKstParts(nextDay);
  const midnight = kstDate(parts.year, parts.month, parts.day, 0);
  const oneAm = kstDate(parts.year, parts.month, parts.day, 1);
  return [
    {
      label: "자정 휴식",
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

function getFirstShiftStartAtOrAfter(mode: YTWorkShiftMode, referenceAt: string): string | null {
  const referenceDate = new Date(referenceAt);
  if (!isValidDate(referenceDate)) {
    return null;
  }

  const sameDayCandidate =
    mode === "day"
      ? dayShiftStartFor(referenceDate)
      : nightShiftStartFor(referenceDate);

  if (sameDayCandidate.getTime() >= referenceDate.getTime()) {
    return sameDayCandidate.toISOString();
  }

  const nextDay = addDays(referenceDate, 1);
  const nextCandidate =
    mode === "day"
      ? dayShiftStartFor(nextDay)
      : nightShiftStartFor(nextDay);
  return nextCandidate.toISOString();
}

function buildReservedShiftWindow(mode: YTWorkShiftMode, armedAt: string | null): ShiftWindow | null {
  const targetStartAt = getFirstShiftStartAtOrAfter(mode, armedAt || new Date().toISOString());
  if (!targetStartAt) {
    return null;
  }
  return buildShiftWindowFromStart(mode, new Date(targetStartAt));
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

function buildAutomationOffState(updatedAt: string | null = null): StoredYtWorkAutomation {
  return {
    ...defaultYtWorkAutomationState(),
    updatedAt,
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
  const normalized = normalizeStopReason(reason);
  if (!matched || !normalized || state === "active") {
    return null;
  }
  return `${state}:${matched.kind}:${normalized}`;
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

function buildShiftWindow(mode: YTWorkShiftMode, now: Date): ShiftWindow {
  const shiftWindow = getShiftWindowForObservedAt(now.toISOString());
  if (!shiftWindow) {
    throw new ShiftWindowError("유효하지 않은 시각입니다.");
  }

  if (shiftWindow.mode !== mode) {
    const label = mode === "day" ? DAY_SHIFT_WINDOW_LABEL : NIGHT_SHIFT_WINDOW_LABEL;
    const modeLabel = mode === "day" ? "주간근무" : "야간근무";
    throw new ShiftWindowError(`${modeLabel} 카운팅은 ${label} 사이에만 시작할 수 있습니다.`);
  }

  return shiftWindow;
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
  const shiftWindow = buildShiftWindow(mode, new Date(observedAt));
  const drivers = Object.fromEntries(
    sortByYtNoThenName(units)
      .map((unit) => seedDriverEntry(unit, observedAt))
      .filter((entry): entry is StoredYtWorkDriver => Boolean(entry))
      .map((entry) => [entry.driverKey, entry]),
  );

  return {
    version: 1,
    mode,
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
    const latestObserved = latestNamed || latestByYtNo;
    const normalizedObservedStopReason = normalizeStopReason(latestObserved?.stopReason);
    let nextEntry = { ...existingEntry };

    if (nextEntry.currentSegmentStartedAt && !activeUnit) {
      nextEntry = closeSegment(nextEntry, cutoffAt, finalized.breaks);
      nextEntry.latestState = latestObserved?.semanticState || "logged_out";
      nextEntry.latestStopReason = normalizedObservedStopReason || nextEntry.latestStopReason;
      nextEntry.latestYtNo = latestObserved?.ytNo || nextEntry.latestYtNo;
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

function reservedModeToShiftMode(mode: YTWorkAutoMode): YTWorkShiftMode | null {
  if (mode === "reserve_day") {
    return "day";
  }
  if (mode === "reserve_night") {
    return "night";
  }
  return null;
}

function expireYtWorkAutomationState(
  automation: StoredYtWorkAutomation,
  asOf: string,
): StoredYtWorkAutomation {
  const reservedShiftMode = reservedModeToShiftMode(automation.mode);
  if (!reservedShiftMode || !automation.armedAt) {
    return automation;
  }

  const reservedWindow = buildReservedShiftWindow(reservedShiftMode, automation.armedAt);
  if (!reservedWindow) {
    return buildAutomationOffState(asOf);
  }

  if (compareIsoTimes(asOf, reservedWindow.endsAt) >= 0) {
    return buildAutomationOffState(asOf);
  }

  return automation;
}

export function reconcileYtWorkSnapshotState(
  session: StoredYtWorkSession | null,
  automation: StoredYtWorkAutomation,
  units: YTUnitSnapshot[],
  observedAt: string,
): {
  session: StoredYtWorkSession | null;
  automation: StoredYtWorkAutomation;
} {
  const nextAutomation = expireYtWorkAutomationState(automation, observedAt);
  const nextSession = session ? applyYtWorkSnapshot(session, units, observedAt) : null;
  const currentWindow = getShiftWindowForObservedAt(observedAt);
  if (!currentWindow || nextAutomation.mode === "off") {
    return {
      session: nextSession,
      automation: nextAutomation,
    };
  }

  if (nextAutomation.mode === "full_auto") {
    if (isSessionActiveForWindow(nextSession, currentWindow)) {
      return {
        session: nextSession,
        automation: nextAutomation,
      };
    }

    return {
      session: startYtWorkSessionState(currentWindow.mode, observedAt, units),
      automation: nextAutomation,
    };
  }

  const reservedShiftMode = reservedModeToShiftMode(nextAutomation.mode);
  const reservedWindow = reservedShiftMode && nextAutomation.armedAt
    ? buildReservedShiftWindow(reservedShiftMode, nextAutomation.armedAt)
    : null;

  if (!reservedShiftMode || !reservedWindow) {
    return {
      session: nextSession,
      automation: buildAutomationOffState(observedAt),
    };
  }

  if (compareIsoTimes(observedAt, reservedWindow.shiftWindowStartedAt) < 0) {
    return {
      session: nextSession,
      automation: nextAutomation,
    };
  }

  if (compareIsoTimes(observedAt, reservedWindow.endsAt) >= 0) {
    return {
      session: nextSession,
      automation: buildAutomationOffState(observedAt),
    };
  }

  return {
    session: isSessionActiveForWindow(nextSession, reservedWindow)
      ? nextSession
      : startYtWorkSessionState(reservedShiftMode, observedAt, units),
    automation: buildAutomationOffState(observedAt),
  };
}

export function materializeYtWorkAutomationState(
  automation: StoredYtWorkAutomation,
  session: StoredYtWorkSession | null,
  asOf: string,
): YTWorkAutomationState {
  const activeSession = session ? finalizeIfExpired(session, asOf) : null;
  if (automation.mode === "off") {
    return {
      mode: "off",
      status: "off",
      armedAt: null,
      nextStartAt: null,
      nextMode: null,
    };
  }

  if (automation.mode === "full_auto") {
    const currentWindow = getShiftWindowForObservedAt(asOf);
    if (!currentWindow) {
      return {
        mode: automation.mode,
        status: "armed",
        armedAt: automation.armedAt,
        nextStartAt: null,
        nextMode: null,
      };
    }

    const isRunning = isSessionActiveForWindow(activeSession, currentWindow);
    return {
      mode: automation.mode,
      status: isRunning ? "running" : "armed",
      armedAt: automation.armedAt,
      nextStartAt: isRunning ? currentWindow.endsAt : currentWindow.shiftWindowStartedAt,
      nextMode: isRunning ? (currentWindow.mode === "day" ? "night" : "day") : currentWindow.mode,
    };
  }

  const reservedShiftMode = reservedModeToShiftMode(automation.mode);
  const reservedWindow = reservedShiftMode && automation.armedAt
    ? buildReservedShiftWindow(reservedShiftMode, automation.armedAt)
    : null;

  return {
    mode: automation.mode,
    status:
      reservedWindow && isSessionActiveForWindow(activeSession, reservedWindow)
        ? "running"
        : "armed",
    armedAt: automation.armedAt,
    nextStartAt: reservedWindow?.shiftWindowStartedAt || null,
    nextMode: reservedShiftMode,
  };
}

export async function setYtWorkAutomationMode(
  mode: YTWorkAutoMode,
  updatedAt: string,
): Promise<StoredYtWorkAutomation> {
  const next =
    mode === "off"
      ? buildAutomationOffState(updatedAt)
      : {
          version: 1 as const,
          mode,
          armedAt: updatedAt,
          updatedAt,
        };
  await saveYtWorkAutomationState(next);
  return next;
}

export async function loadYtWorkSessionState(): Promise<StoredYtWorkSession | null> {
  return loadYtWorkTimeRawState<StoredYtWorkSession>();
}

export async function saveYtWorkSessionState(session: StoredYtWorkSession): Promise<void> {
  await saveYtWorkTimeRawState(session);
}

export async function startYtWorkSession(
  mode: YTWorkShiftMode,
  observedAt: string,
  units: YTUnitSnapshot[],
): Promise<YTWorkSession> {
  const session = startYtWorkSessionState(mode, observedAt, units);
  await saveYtWorkSessionState(session);
  return materializeYtWorkSession(session, observedAt)!;
}

export async function observeYtWorkSnapshot(units: YTUnitSnapshot[], observedAt: string): Promise<void> {
  const [currentSession, currentAutomation] = await Promise.all([
    loadYtWorkSessionState(),
    loadYtWorkAutomationState(),
  ]);
  const next = reconcileYtWorkSnapshotState(currentSession, currentAutomation, units, observedAt);

  const sessionChanged = JSON.stringify(currentSession) !== JSON.stringify(next.session);
  const automationChanged = JSON.stringify(currentAutomation) !== JSON.stringify(next.automation);

  if (!sessionChanged && !automationChanged) {
    return;
  }

  if (sessionChanged && next.session) {
    await saveYtWorkSessionState(next.session);
  }
  if (automationChanged) {
    await saveYtWorkAutomationState(next.automation);
  }
}

export async function getYtWorkSessionView(
  asOf: string,
  latestYtCapturedAt: string | null,
  hasLiveSnapshot: boolean,
): Promise<YTWorkSessionResponse> {
  const [currentSession, currentAutomation] = await Promise.all([
    loadYtWorkSessionState(),
    loadYtWorkAutomationState(),
  ]);
  const finalizedSession = currentSession ? finalizeIfExpired(currentSession, asOf) : null;
  const finalizedAutomation = expireYtWorkAutomationState(currentAutomation, asOf);

  if (currentSession && finalizedSession && JSON.stringify(currentSession) !== JSON.stringify(finalizedSession)) {
    await saveYtWorkSessionState(finalizedSession);
  }
  if (JSON.stringify(currentAutomation) !== JSON.stringify(finalizedAutomation)) {
    await saveYtWorkAutomationState(finalizedAutomation);
  }

  return {
    session: materializeYtWorkSession(finalizedSession, asOf),
    automation: materializeYtWorkAutomationState(finalizedAutomation, finalizedSession, asOf),
    latestYtCapturedAt,
    hasLiveSnapshot,
  };
}

export function isYtWorkShiftWindowError(error: unknown): boolean {
  return error instanceof ShiftWindowError;
}
