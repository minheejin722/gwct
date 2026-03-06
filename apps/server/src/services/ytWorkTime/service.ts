import type {
  YTUnitSnapshot,
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
  const nowKst = toKstParts(now);
  const todayDayStart = kstDate(nowKst.year, nowKst.month, nowKst.day, DAY_SHIFT_START.hour, DAY_SHIFT_START.minute);
  const todayNightStart = kstDate(
    nowKst.year,
    nowKst.month,
    nowKst.day,
    NIGHT_SHIFT_START.hour,
    NIGHT_SHIFT_START.minute,
  );
  const today0000 = kstDate(nowKst.year, nowKst.month, nowKst.day, 0);
  const today0100 = kstDate(nowKst.year, nowKst.month, nowKst.day, 1);
  const today1200 = kstDate(nowKst.year, nowKst.month, nowKst.day, 12);
  const today1300 = kstDate(nowKst.year, nowKst.month, nowKst.day, 13);

  if (mode === "day") {
    if (now < todayDayStart || now >= todayNightStart) {
      throw new ShiftWindowError(`주간근무 카운팅은 ${DAY_SHIFT_WINDOW_LABEL} 사이에만 시작할 수 있습니다.`);
    }

    return {
      mode,
      shiftWindowStartedAt: todayDayStart.toISOString(),
      endsAt: todayNightStart.toISOString(),
      breaks: [
        {
          label: "점심 휴식",
          startAt: today1200.toISOString(),
          endAt: today1300.toISOString(),
        },
      ],
    };
  }

  if (now >= todayNightStart) {
    const tomorrow = addDays(todayNightStart, 1);
    const tomorrowDayStart = kstDate(
      toKstParts(tomorrow).year,
      toKstParts(tomorrow).month,
      toKstParts(tomorrow).day,
      NIGHT_SHIFT_END.hour,
      NIGHT_SHIFT_END.minute,
    );
    const nextMidnight = kstDate(
      toKstParts(tomorrow).year,
      toKstParts(tomorrow).month,
      toKstParts(tomorrow).day,
      0,
    );
    const next0100 = kstDate(
      toKstParts(tomorrow).year,
      toKstParts(tomorrow).month,
      toKstParts(tomorrow).day,
      1,
    );
    return {
      mode,
      shiftWindowStartedAt: todayNightStart.toISOString(),
      endsAt: tomorrowDayStart.toISOString(),
      breaks: [
        {
          label: "자정 휴식",
          startAt: nextMidnight.toISOString(),
          endAt: next0100.toISOString(),
        },
      ],
    };
  }

  if (now < todayDayStart) {
    const yesterday = addDays(todayNightStart, -1);
    const yesterdayNightStart = kstDate(
      toKstParts(yesterday).year,
      toKstParts(yesterday).month,
      toKstParts(yesterday).day,
      NIGHT_SHIFT_START.hour,
      NIGHT_SHIFT_START.minute,
    );
    return {
      mode,
      shiftWindowStartedAt: yesterdayNightStart.toISOString(),
      endsAt: todayDayStart.toISOString(),
      breaks: [
        {
          label: "자정 휴식",
          startAt: today0000.toISOString(),
          endAt: today0100.toISOString(),
        },
      ],
    };
  }

  throw new ShiftWindowError(`야간근무 카운팅은 ${NIGHT_SHIFT_WINDOW_LABEL} 사이에만 시작할 수 있습니다.`);
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
  const current = await loadYtWorkSessionState();
  if (!current) {
    return;
  }

  const next = applyYtWorkSnapshot(current, units, observedAt);
  if (JSON.stringify(current) === JSON.stringify(next)) {
    return;
  }
  await saveYtWorkSessionState(next);
}

export async function getYtWorkSessionView(
  asOf: string,
  latestYtCapturedAt: string | null,
  hasLiveSnapshot: boolean,
): Promise<YTWorkSessionResponse> {
  const current = await loadYtWorkSessionState();
  const finalized = current ? finalizeIfExpired(current, asOf) : null;
  if (current && finalized && JSON.stringify(current) !== JSON.stringify(finalized)) {
    await saveYtWorkSessionState(finalized);
  }

  return {
    session: materializeYtWorkSession(finalized, asOf),
    latestYtCapturedAt,
    hasLiveSnapshot,
  };
}

export function isYtWorkShiftWindowError(error: unknown): boolean {
  return error instanceof ShiftWindowError;
}
