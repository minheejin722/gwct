import type {
  YTUnitSnapshot,
  YTWorkDriverSummary,
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
  const today0700 = kstDate(nowKst.year, nowKst.month, nowKst.day, 7);
  const today1900 = kstDate(nowKst.year, nowKst.month, nowKst.day, 19);
  const today0000 = kstDate(nowKst.year, nowKst.month, nowKst.day, 0);
  const today0100 = kstDate(nowKst.year, nowKst.month, nowKst.day, 1);
  const today1200 = kstDate(nowKst.year, nowKst.month, nowKst.day, 12);
  const today1300 = kstDate(nowKst.year, nowKst.month, nowKst.day, 13);

  if (mode === "day") {
    if (now < today0700 || now >= today1900) {
      throw new ShiftWindowError("주간근무 카운팅은 07:00~19:00 사이에만 시작할 수 있습니다.");
    }

    return {
      mode,
      shiftWindowStartedAt: today0700.toISOString(),
      endsAt: today1900.toISOString(),
      breaks: [
        {
          label: "점심 휴식",
          startAt: today1200.toISOString(),
          endAt: today1300.toISOString(),
        },
      ],
    };
  }

  if (now >= today1900) {
    const tomorrow = addDays(today1900, 1);
    const tomorrow0700 = kstDate(
      toKstParts(tomorrow).year,
      toKstParts(tomorrow).month,
      toKstParts(tomorrow).day,
      7,
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
      shiftWindowStartedAt: today1900.toISOString(),
      endsAt: tomorrow0700.toISOString(),
      breaks: [
        {
          label: "자정 휴식",
          startAt: nextMidnight.toISOString(),
          endAt: next0100.toISOString(),
        },
      ],
    };
  }

  if (now < today0700) {
    const yesterday = addDays(today1900, -1);
    const yesterday1900 = kstDate(
      toKstParts(yesterday).year,
      toKstParts(yesterday).month,
      toKstParts(yesterday).day,
      19,
    );
    return {
      mode,
      shiftWindowStartedAt: yesterday1900.toISOString(),
      endsAt: today0700.toISOString(),
      breaks: [
        {
          label: "자정 휴식",
          startAt: today0000.toISOString(),
          endAt: today0100.toISOString(),
        },
      ],
    };
  }

  throw new ShiftWindowError("야간근무 카운팅은 19:00~07:00 사이에만 시작할 수 있습니다.");
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
      const closed = closeSegment(entry, session.endsAt, session.breaks);
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
    const latestNamed = namedUnits.get(driverKey) || null;
    const activeUnit = activeUnits.get(driverKey) || null;
    const trackedYtNo = existing.activeYtNo || existing.latestYtNo;
    const latestByYtNoCandidate = trackedYtNo ? ytUnitsByNo.get(trackedYtNo) || null : null;
    const latestByYtNo =
      latestByYtNoCandidate && !normalizeDriverName(latestByYtNoCandidate.driverName) ? latestByYtNoCandidate : null;
    const latestObserved = latestNamed || latestByYtNo;
    let nextEntry = { ...existing };

    if (nextEntry.currentSegmentStartedAt && !activeUnit) {
      nextEntry = closeSegment(nextEntry, cutoffAt, finalized.breaks);
      nextEntry.latestState = latestObserved?.semanticState || "logged_out";
      nextEntry.latestStopReason = latestObserved?.stopReason || nextEntry.latestStopReason;
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
      nextEntry.latestStopReason = latestObserved.stopReason || nextEntry.latestStopReason;
      nextEntry.latestYtNo = latestObserved.ytNo;
    } else {
      nextEntry.latestState = "logged_out";
      // Preserve the last observed stop reason so a full logout still carries
      // the final operational trace seen before the driver disappeared.
    }

    nextEntry.driverName = latestNamed?.driverName || nextEntry.driverName;
    nextEntry.lastSeenAt = observedAt;
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
  const liveWorkedMs =
    entry.currentSegmentStartedAt
      ? effectiveWorkedMs(entry.currentSegmentStartedAt, asOf, breaks)
      : 0;
  const totalWorkedMs = entry.totalWorkedMs + liveWorkedMs;
  const totalWorkedMinutes = Math.floor(totalWorkedMs / 60_000);

  return {
    driverKey: entry.driverKey,
    driverName: entry.driverName,
    latestYtNo: entry.latestYtNo,
    activeYtNo: entry.activeYtNo,
    totalWorkedMs,
    totalWorkedMinutes,
    totalWorkedLabel: formatWorkedDuration(totalWorkedMs),
    currentSegmentStartedAt: entry.currentSegmentStartedAt,
    latestState: entry.latestState,
    latestStopReason: entry.latestStopReason,
    firstSeenAt: entry.firstSeenAt,
    lastSeenAt: entry.lastSeenAt,
    lastWorkedAt: entry.lastWorkedAt,
    segments: entry.segments,
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
      if (right.totalWorkedMs !== left.totalWorkedMs) {
        return right.totalWorkedMs - left.totalWorkedMs;
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
