import type {
  CraneStatus,
  EquipmentLoginStatus,
  SourceId,
  YTUnitTransitionKind,
  YTUnitSnapshot,
  VesselScheduleItem,
  WeatherNoticeSnapshot,
  YTCountSnapshot,
} from "@gwct/shared";
import { summarizeGwctEtaChange } from "@gwct/shared";
import type { AlertEventInput } from "../db/repository.js";
import { compareIso, formatKst, parseSeoulDate } from "../lib/time.js";
import { buildYtUnitSnapshotFromEquipment } from "../services/equipment/ytUnits.js";
import type {
  EquipmentYtMonitorConfig,
  GcRemainingMonitorRule,
  YtMonitorState,
} from "../services/monitorConfig/store.js";

function byKey<T>(items: T[], keyOf: (item: T) => string): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) {
    map.set(keyOf(item), item);
  }
  return map;
}

function stringValue(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

const EMPTY_TEXT_MARKERS = new Set(["-", "—", "N/A", "NA"]);
const NON_DRIVER_WORDS = /^(고장|수리|예비장비|운전원교대|운전원 교대|점검|주유)$/;

function normalizeOptionalValue(value: string | null | undefined): string | null {
  const normalized = stringValue(value);
  if (!normalized) {
    return null;
  }
  const compactUpper = normalized.replace(/\s+/g, "").toUpperCase();
  if (EMPTY_TEXT_MARKERS.has(compactUpper)) {
    return null;
  }
  return normalized;
}

function normalizeDriverValue(value: string | null | undefined): string | null {
  const normalized = normalizeOptionalValue(value);
  if (!normalized) {
    return null;
  }
  if (NON_DRIVER_WORDS.test(normalized)) {
    return null;
  }
  return normalized;
}

function createEvent(input: AlertEventInput): AlertEventInput {
  return input;
}

const TIME_FIELDS: Array<keyof VesselScheduleItem> = [
  "eta",
  "etb",
  "ata",
  "etd",
  "atd",
  "workStartAt",
  "workEndAt",
  "importCutoffAt",
];

export function diffVesselItems(
  prev: VesselScheduleItem[],
  curr: VesselScheduleItem[],
  source: SourceId,
  occurredAt: string,
): AlertEventInput[] {
  const events: AlertEventInput[] = [];
  const prevMap = byKey(prev, (item) => item.vesselKey);
  const currMap = byKey(curr, (item) => item.vesselKey);

  for (const [vesselKey, currItem] of currMap) {
    const prevItem = prevMap.get(vesselKey);
    if (!prevItem) {
      events.push(
        createEvent({
          category: "VESSEL",
          type: "NEW_VESSEL",
          source,
          dedupeKey: `vessel:new:${vesselKey}`,
          title: "신규 선박 스케줄",
          message: `${currItem.vesselName} (${currItem.berth || "미정"}) 신규 등록`,
          beforeValue: null,
          afterValue: currItem.eta || currItem.etd || currItem.status,
          payload: { vesselKey, vesselName: currItem.vesselName },
          occurredAt,
        }),
      );
      continue;
    }

    if (stringValue(prevItem.berth) !== stringValue(currItem.berth)) {
      events.push(
        createEvent({
          category: "VESSEL",
          type: "BERTH_CHANGED",
          source,
          dedupeKey: `vessel:berth:${vesselKey}:${currItem.berth || "none"}`,
          title: "선석 변경",
          message: `${currItem.vesselName} 선석 변경`,
          beforeValue: prevItem.berth,
          afterValue: currItem.berth,
          payload: { vesselKey, vesselName: currItem.vesselName, field: "berth" },
          occurredAt,
        }),
      );
    }

    if (stringValue(prevItem.status) !== stringValue(currItem.status)) {
      events.push(
        createEvent({
          category: "VESSEL",
          type: "STATUS_CHANGED",
          source,
          dedupeKey: `vessel:status:${vesselKey}:${currItem.status || "none"}`,
          title: "선박 상태 변경",
          message: `${currItem.vesselName} 상태 변경`,
          beforeValue: prevItem.status,
          afterValue: currItem.status,
          payload: { vesselKey, vesselName: currItem.vesselName, field: "status" },
          occurredAt,
        }),
      );
    }

    for (const field of TIME_FIELDS) {
      const prevVal = prevItem[field] as string | null;
      const currVal = currItem[field] as string | null;
      if (stringValue(prevVal) === stringValue(currVal)) {
        continue;
      }
      const delta = compareIso(currVal, prevVal);
      let type = "FIELD_CHANGED";
      let title = "스케줄 변경";
      if (delta !== null) {
        if (delta < 0) {
          type = "TIME_PULLED_FORWARD";
          title = "스케줄 당김";
        } else if (delta > 0) {
          type = "TIME_DELAYED";
          title = "스케줄 지연";
        }
      }

      events.push(
        createEvent({
          category: "VESSEL",
          type,
          source,
          dedupeKey: `vessel:time:${vesselKey}:${String(field)}:${currVal || "none"}`,
          title,
          message: `${currItem.vesselName} ${String(field)} 변경`,
          beforeValue: prevVal,
          afterValue: currVal,
          payload: { vesselKey, vesselName: currItem.vesselName, field },
          occurredAt,
        }),
      );
    }
  }

  for (const [vesselKey, prevItem] of prevMap) {
    if (currMap.has(vesselKey)) {
      continue;
    }

    events.push(
      createEvent({
        category: "VESSEL",
        type: "REMOVED_VESSEL",
        source,
        dedupeKey: `vessel:removed:${vesselKey}`,
        title: "선박 스케줄 제거",
        message: `${prevItem.vesselName} 항목이 목록에서 제거됨`,
        beforeValue: prevItem.eta || prevItem.etd,
        afterValue: null,
        payload: { vesselKey, vesselName: prevItem.vesselName },
        occurredAt,
      }),
    );
  }

  return events;
}

function normalizeEtaForCompare(item: VesselScheduleItem): string | null {
  const rawNormalized = item.rawLabelMap?._etaNormalized;
  if (typeof rawNormalized === "string" && rawNormalized.trim().length) {
    return rawNormalized.trim();
  }

  if (item.eta) {
    return formatKst(item.eta).slice(0, 16).replace(" ", "T");
  }

  const rawEta = item.rawLabelMap?.["입항 일시"] || item.rawLabelMap?.["입항일시"] || null;
  if (typeof rawEta === "string" && rawEta.trim().length) {
    const iso = parseSeoulDate(rawEta);
    if (iso) {
      return formatKst(iso).slice(0, 16).replace(" ", "T");
    }
  }

  return null;
}

function watchIndexFromItem(item: VesselScheduleItem): number | null {
  const raw = item.rawLabelMap?._watchIndex;
  if (typeof raw !== "string") {
    return null;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return null;
  }
  return parsed;
}

interface GwctEtaEventOptions {
  sourceUrl: string;
  emitOnWindowEntry?: boolean;
  trackingCount?: number;
}

export function detectGwctEtaChangedEvents(
  prev: VesselScheduleItem[],
  curr: VesselScheduleItem[],
  source: SourceId,
  occurredAt: string,
  options: GwctEtaEventOptions,
): AlertEventInput[] {
  const limit = Math.min(11, Math.max(1, options.trackingCount ?? 11));
  const inWindow = (item: VesselScheduleItem) => {
    const idx = watchIndexFromItem(item);
    if (idx === null) {
      return true;
    }
    return idx <= limit;
  };

  const prevWindow = prev.filter(inWindow);
  const currWindow = curr.filter(inWindow);
  const events: AlertEventInput[] = [];
  const prevMap = byKey(prevWindow, (item) => item.vesselKey);

  for (const currItem of currWindow) {
    const voyage = currItem.terminalVoyage || currItem.vesselKey;
    const currEta = normalizeEtaForCompare(currItem);
    const currentIndex = watchIndexFromItem(currItem);
    const previous = prevMap.get(currItem.vesselKey);

    if (!previous) {
      continue;
    }

    const prevEta = normalizeEtaForCompare(previous);
    if (prevEta === currEta) {
      continue;
    }
    if (!prevEta || !currEta) {
      continue;
    }

    const etaChange = summarizeGwctEtaChange(prevEta, currEta);
    if (!etaChange) {
      continue;
    }

    events.push(
      createEvent({
        category: "VESSEL",
        type: "gwct_eta_changed",
        source,
        dedupeKey: `gwct:eta:${voyage}:${etaChange.currentEta}`,
        title: `ETA 변경 (${voyage})`,
        message: `${currItem.vesselName} ${etaChange.humanMessage}`,
        beforeValue: etaChange.previousEta,
        afterValue: etaChange.currentEta,
        payload: {
          type: "gwct_eta_changed",
          voyage,
          vesselKey: currItem.vesselKey,
          vesselName: currItem.vesselName,
          previousEta: etaChange.previousEta,
          currentEta: etaChange.currentEta,
          deltaMinutes: etaChange.deltaMinutes,
          direction: etaChange.direction,
          crossedDate: etaChange.crossedDate,
          humanMessage: etaChange.humanMessage,
          indexInWatchWindow: currentIndex,
          trackingCount: limit,
          sourceUrl: options.sourceUrl,
          capturedAt: occurredAt,
        },
        occurredAt,
      }),
    );
  }

  return events;
}

export function detectCraneThresholdCrossings(
  prev: CraneStatus[],
  curr: CraneStatus[],
  thresholdMap: Map<string, number>,
  source: SourceId,
  occurredAt: string,
): AlertEventInput[] {
  const events: AlertEventInput[] = [];
  const prevMap = byKey(prev, (item) => item.craneId);

  for (const row of curr) {
    const threshold = thresholdMap.get(row.craneId) ?? 100;
    const currentRemaining = row.totalRemaining;
    if (currentRemaining === null) {
      continue;
    }
    const previous = prevMap.get(row.craneId);
    const previousRemaining = previous?.totalRemaining;
    if (previousRemaining === null || previousRemaining === undefined) {
      continue;
    }
    if (previousRemaining > threshold && currentRemaining <= threshold) {
      events.push(
        createEvent({
          category: "CRANE",
          type: "CRANE_THRESHOLD",
          source,
          dedupeKey: `crane:threshold:${row.craneId}:${threshold}`,
          title: `크레인 임계치 도달 (${row.craneId})`,
          message: `${row.craneId} 잔량 ${currentRemaining} <= 임계치 ${threshold}`,
          beforeValue: String(previousRemaining),
          afterValue: String(currentRemaining),
          payload: {
            craneId: row.craneId,
            vesselName: row.vesselName,
            threshold,
          },
          occurredAt,
        }),
      );
    }
  }

  return events;
}

function parseGcNumber(craneId: string): number | null {
  const matched = craneId.match(/GC\s*(\d+)/i);
  if (!matched) {
    return null;
  }
  const parsed = Number(matched[1]);
  return Number.isInteger(parsed) ? parsed : null;
}

interface GcLowEventOptions {
  sourceUrl: string;
}

export function detectGcRemainingLowEvents(
  prev: CraneStatus[],
  curr: CraneStatus[],
  monitorRules: Record<string, GcRemainingMonitorRule>,
  source: SourceId,
  occurredAt: string,
  options: GcLowEventOptions,
): AlertEventInput[] {
  const events: AlertEventInput[] = [];
  const prevMap = byKey(prev, (item) => item.craneId);

  for (const row of curr) {
    const gc = parseGcNumber(row.craneId);
    if (gc === null || gc < 181 || gc > 190) {
      continue;
    }

    const previous = prevMap.get(row.craneId);
    if (!previous) {
      continue;
    }

    const rule = monitorRules[String(gc)];
    if (!rule?.enabled) {
      continue;
    }

    const currentSubtotal = row.totalRemaining;
    const previousSubtotal = previous.totalRemaining;
    if (currentSubtotal === null || previousSubtotal === null || previousSubtotal === undefined) {
      continue;
    }

    const threshold = rule.threshold;
    if (!(previousSubtotal > threshold && currentSubtotal <= threshold)) {
      continue;
    }

    events.push(
      createEvent({
        category: "CRANE",
        type: "gc_remaining_low",
        source,
        dedupeKey: `gc:remaining:low:${gc}:${threshold}:${currentSubtotal}`,
        title: `GC${gc} 잔량 소계 임계치 도달`,
        message: `GC${gc} 잔량 소계 ${currentSubtotal} <= 기준값 ${threshold}`,
        beforeValue: String(previousSubtotal),
        afterValue: String(currentSubtotal),
        payload: {
          type: "gc_remaining_low",
          gc,
          craneId: row.craneId,
          threshold,
          currentSubtotal,
          previousSubtotal,
          breakdown: {
            discharge: row.dischargeRemaining,
            load: row.loadRemaining,
          },
          capturedAt: occurredAt,
          sourceUrl: options.sourceUrl,
        },
        occurredAt,
      }),
    );
  }

  return events;
}

export function diffEquipmentLogins(
  prev: EquipmentLoginStatus[],
  curr: EquipmentLoginStatus[],
  source: SourceId,
  occurredAt: string,
): AlertEventInput[] {
  const events: AlertEventInput[] = [];
  const prevMap = byKey(prev, (item) => item.equipmentId);

  for (const row of curr) {
    const old = prevMap.get(row.equipmentId);
    if (!old) {
      continue;
    }

    const oldOperator = stringValue(old.operatorName);
    const newOperator = stringValue(row.operatorName);
    const oldHelper = stringValue(old.helperName);
    const newHelper = stringValue(row.helperName);

    if (!oldOperator && newOperator) {
      events.push(
        createEvent({
          category: "EQUIPMENT",
          type: "EQUIPMENT_LOGIN",
          source,
          dedupeKey: `equipment:login:${row.equipmentId}:${newOperator}`,
          title: `장비 로그인 (${row.equipmentId})`,
          message: `${row.equipmentId} 기사 ${newOperator} 로그인`,
          beforeValue: oldOperator,
          afterValue: newOperator,
          payload: {
            equipmentId: row.equipmentId,
            operator: newOperator,
            helper: newHelper,
          },
          occurredAt,
        }),
      );
    }

    if (oldOperator && newOperator && oldOperator !== newOperator) {
      events.push(
        createEvent({
          category: "EQUIPMENT",
          type: "EQUIPMENT_OPERATOR_CHANGED",
          source,
          dedupeKey: `equipment:operator:${row.equipmentId}:${newOperator}`,
          title: `장비 기사 변경 (${row.equipmentId})`,
          message: `${row.equipmentId} 기사 ${oldOperator} -> ${newOperator}`,
          beforeValue: oldOperator,
          afterValue: newOperator,
          payload: {
            equipmentId: row.equipmentId,
            oldOperator,
            newOperator,
          },
          occurredAt,
        }),
      );
    }

    if (oldHelper && newHelper && oldHelper !== newHelper) {
      events.push(
        createEvent({
          category: "EQUIPMENT",
          type: "EQUIPMENT_HELPER_CHANGED",
          source,
          dedupeKey: `equipment:helper:${row.equipmentId}:${newHelper}`,
          title: `장비 보조 변경 (${row.equipmentId})`,
          message: `${row.equipmentId} 보조 ${oldHelper} -> ${newHelper}`,
          beforeValue: oldHelper,
          afterValue: newHelper,
          payload: {
            equipmentId: row.equipmentId,
            oldHelper,
            newHelper,
          },
          occurredAt,
        }),
      );
    }
  }

  return events;
}

interface GcEquipmentState {
  gc: number;
  equipmentId: string;
  driverName: string | null;
  hkName: string | null;
  loginTime: string | null;
  stopReason: string | null;
}

function parseGcNoFromEquipmentId(equipmentId: string): number | null {
  const compact = equipmentId.toUpperCase().replace(/\s+/g, "");
  const matched = compact.match(/^G\/?C-?(\d{3})$/);
  if (!matched) {
    return null;
  }
  const parsed = Number(matched[1]);
  if (!Number.isInteger(parsed) || parsed < 180 || parsed > 190) {
    return null;
  }
  return parsed;
}

function toGcEquipmentMap(items: EquipmentLoginStatus[]): Map<number, GcEquipmentState> {
  const map = new Map<number, GcEquipmentState>();

  for (const item of items) {
    const gc = parseGcNoFromEquipmentId(item.equipmentId);
    if (gc === null || map.has(gc)) {
      continue;
    }
    map.set(gc, {
      gc,
      equipmentId: `GC${gc}`,
      driverName: normalizeDriverValue(item.operatorName),
      hkName: normalizeOptionalValue(item.helperName),
      loginTime: normalizeOptionalValue(item.loginText),
      stopReason: normalizeOptionalValue(item.stopReason),
    });
  }

  return map;
}

function gcStateOrEmpty(map: Map<number, GcEquipmentState>, gc: number): GcEquipmentState {
  return (
    map.get(gc) || {
      gc,
      equipmentId: `GC${gc}`,
      driverName: null,
      hkName: null,
      loginTime: null,
      stopReason: null,
    }
  );
}

interface GcEquipmentEventOptions {
  sourceUrl: string;
}

export function detectGcEquipmentFocusEvents(
  prev: EquipmentLoginStatus[],
  curr: EquipmentLoginStatus[],
  source: SourceId,
  occurredAt: string,
  options: GcEquipmentEventOptions,
): AlertEventInput[] {
  const events: AlertEventInput[] = [];
  const prevMap = toGcEquipmentMap(prev);
  const currMap = toGcEquipmentMap(curr);

  for (let gc = 180; gc <= 190; gc += 1) {
    const before = gcStateOrEmpty(prevMap, gc);
    const after = gcStateOrEmpty(currMap, gc);

    const pushGcEvent = (
      type: string,
      title: string,
      message: string,
      beforeValue: string | null,
      afterValue: string | null,
      payload: Record<string, unknown>,
    ) => {
      events.push(
        createEvent({
          category: "EQUIPMENT",
          type,
          source,
          dedupeKey: `gc:${gc}:${type}:${beforeValue || "none"}:${afterValue || "none"}`,
          title,
          message,
          beforeValue,
          afterValue,
          payload: {
            type,
            gc,
            equipmentId: `GC${gc}`,
            driverName: after.driverName,
            hkName: after.hkName,
            loginTime: after.loginTime,
            capturedAt: occurredAt,
            sourceUrl: options.sourceUrl,
            ...payload,
          },
          occurredAt,
        }),
      );
    };

    if (!before.driverName && after.driverName) {
      pushGcEvent(
        "gc_driver_login",
        `GC${gc} 기사 로그인`,
        `GC${gc} 기사 ${after.driverName} 로그인`,
        null,
        after.driverName,
        {
          driverNameBefore: null,
          driverNameAfter: after.driverName,
        },
      );
    } else if (before.driverName && !after.driverName) {
      pushGcEvent(
        "gc_driver_logout",
        `GC${gc} 기사 로그아웃`,
        `GC${gc} 기사 ${before.driverName} 로그아웃`,
        before.driverName,
        null,
        {
          driverNameBefore: before.driverName,
          driverNameAfter: null,
        },
      );
    } else if (before.driverName && after.driverName && before.driverName !== after.driverName) {
      pushGcEvent(
        "gc_driver_changed",
        `GC${gc} 기사 변경`,
        `GC${gc} 기사 ${before.driverName} -> ${after.driverName}`,
        before.driverName,
        after.driverName,
        {
          driverNameBefore: before.driverName,
          driverNameAfter: after.driverName,
        },
      );
    }

    if (!before.hkName && after.hkName) {
      pushGcEvent(
        "gc_hk_login",
        `GC${gc} HK 로그인`,
        `GC${gc} HK ${after.hkName} 로그인`,
        null,
        after.hkName,
        {
          hkNameBefore: null,
          hkNameAfter: after.hkName,
        },
      );
    } else if (before.hkName && !after.hkName) {
      pushGcEvent(
        "gc_hk_logout",
        `GC${gc} HK 로그아웃`,
        `GC${gc} HK ${before.hkName} 로그아웃`,
        before.hkName,
        null,
        {
          hkNameBefore: before.hkName,
          hkNameAfter: null,
        },
      );
    } else if (before.hkName && after.hkName && before.hkName !== after.hkName) {
      pushGcEvent(
        "gc_hk_changed",
        `GC${gc} HK 변경`,
        `GC${gc} HK ${before.hkName} -> ${after.hkName}`,
        before.hkName,
        after.hkName,
        {
          hkNameBefore: before.hkName,
          hkNameAfter: after.hkName,
        },
      );
    }

    if (!before.stopReason && after.stopReason) {
      pushGcEvent(
        "gc_stop_reason_set",
        `GC${gc} 중단사유 발생`,
        `GC${gc} 중단사유: ${after.stopReason}`,
        null,
        after.stopReason,
        {
          stopReasonBefore: null,
          stopReasonAfter: after.stopReason,
        },
      );
    } else if (before.stopReason && !after.stopReason) {
      pushGcEvent(
        "gc_stop_reason_cleared",
        `GC${gc} 중단사유 해제`,
        `GC${gc} 중단사유 해제`,
        before.stopReason,
        null,
        {
          stopReasonBefore: before.stopReason,
          stopReasonAfter: null,
        },
      );
    } else if (before.stopReason && after.stopReason && before.stopReason !== after.stopReason) {
      pushGcEvent(
        "gc_stop_reason_changed",
        `GC${gc} 중단사유 변경`,
        `GC${gc} 중단사유 ${before.stopReason} -> ${after.stopReason}`,
        before.stopReason,
        after.stopReason,
        {
          stopReasonBefore: before.stopReason,
          stopReasonAfter: after.stopReason,
        },
      );
    }

    if (before.loginTime !== after.loginTime && (before.loginTime || after.loginTime)) {
      pushGcEvent(
        "gc_login_time_changed",
        `GC${gc} 로그인시간 변경`,
        `GC${gc} 로그인시간 ${before.loginTime || "-"} -> ${after.loginTime || "-"}`,
        before.loginTime,
        after.loginTime,
        {
          loginTimeBefore: before.loginTime,
          loginTimeAfter: after.loginTime,
        },
      );
    }
  }

  return events;
}

interface YtCountEventOptions {
  sourceUrl: string;
  previousCount?: number | null;
}

interface YtCountEventResult {
  events: AlertEventInput[];
  nextState: YtMonitorState;
  initialized: boolean;
}

export function detectYtCountStateEvents(
  curr: YTCountSnapshot | null,
  config: EquipmentYtMonitorConfig,
  source: SourceId,
  occurredAt: string,
  options: YtCountEventOptions,
): YtCountEventResult {
  const emptyState: YtCountEventResult = {
    events: [],
    nextState: config.state || "NORMAL",
    initialized: config.stateInitialized,
  };

  if (!curr) {
    return emptyState;
  }

  const previousCount = options.previousCount ?? null;
  const currentCount = curr.totalLoggedIn;
  const inferredState: YtMonitorState = currentCount < config.threshold ? "LOW" : "NORMAL";

  if (!config.enabled) {
    return {
      events: [],
      nextState: inferredState,
      initialized: true,
    };
  }

  if (!config.stateInitialized || !config.state || previousCount === null) {
    return {
      events: [],
      nextState: inferredState,
      initialized: true,
    };
  }

  if (previousCount === currentCount) {
    return {
      events: [],
      nextState: inferredState,
      initialized: true,
    };
  }

  const events: AlertEventInput[] = [];
  let nextState: YtMonitorState = inferredState;

  if (previousCount >= config.threshold && currentCount < config.threshold) {
    nextState = "LOW";
    events.push(
      createEvent({
        category: "YT",
        type: "yt_count_low",
        source,
        dedupeKey: `yt:count:low:${config.threshold}:${currentCount}`,
        title: "YT 로그인 대수 임계치 하회",
        message: `YT 로그인 ${previousCount}대 -> ${currentCount}대 (기준값 ${config.threshold})`,
        beforeValue: String(previousCount),
        afterValue: String(currentCount),
        payload: {
          type: "yt_count_low",
          ytCount: currentCount,
          previousCount,
          threshold: config.threshold,
          capturedAt: occurredAt,
          sourceUrl: options.sourceUrl,
        },
        occurredAt,
      }),
    );
  } else if (previousCount < config.threshold && currentCount < config.threshold && currentCount < previousCount) {
    nextState = "LOW";
    events.push(
      createEvent({
        category: "YT",
        type: "yt_count_low",
        source,
        dedupeKey: `yt:count:low:${config.threshold}:${currentCount}`,
        title: "YT 로그인 대수 추가 하락",
        message: `YT 로그인 ${previousCount}대 -> ${currentCount}대 (기준값 ${config.threshold})`,
        beforeValue: String(previousCount),
        afterValue: String(currentCount),
        payload: {
          type: "yt_count_low",
          ytCount: currentCount,
          previousCount,
          threshold: config.threshold,
          capturedAt: occurredAt,
          sourceUrl: options.sourceUrl,
        },
        occurredAt,
      }),
    );
  } else if (previousCount < config.threshold && currentCount >= config.threshold) {
    nextState = "NORMAL";
    events.push(
      createEvent({
        category: "YT",
        type: "yt_count_recovered",
        source,
        dedupeKey: `yt:count:recovered:${config.threshold}:${currentCount}`,
        title: "YT 로그인 대수 회복",
        message: `YT 로그인 ${previousCount}대 -> ${currentCount}대 (기준값 ${config.threshold})`,
        beforeValue: String(previousCount),
        afterValue: String(currentCount),
        payload: {
          type: "yt_count_recovered",
          ytCount: currentCount,
          previousCount,
          threshold: config.threshold,
          capturedAt: occurredAt,
          sourceUrl: options.sourceUrl,
        },
        occurredAt,
      }),
    );
  }

  return {
    events,
    nextState,
    initialized: true,
  };
}

interface YtUnitEventOptions {
  sourceUrl: string;
}

function compareYtNo(a: string, b: string): number {
  const aNo = Number(a.replace(/^\D+/, ""));
  const bNo = Number(b.replace(/^\D+/, ""));
  if (Number.isFinite(aNo) && Number.isFinite(bNo) && aNo !== bNo) {
    return aNo - bNo;
  }
  return a.localeCompare(b);
}

function normalizeStateReason(value: string | null | undefined): string | null {
  return normalizeOptionalValue(value);
}

function createSyntheticLoggedOutSnapshot(previous: YTUnitSnapshot): YTUnitSnapshot {
  return {
    ytNo: previous.ytNo,
    driverName: null,
    loginTime: null,
    hkName: previous.hkName,
    stopReason: previous.stopReason,
    semanticState: "logged_out",
    fingerprint: `synthetic_logged_out:${previous.ytNo}:${previous.fingerprint}`,
  };
}

function buildYtUnitAlert(
  input: {
    source: SourceId;
    occurredAt: string;
    sourceUrl: string;
    transitionKind: YTUnitTransitionKind;
    before: YTUnitSnapshot;
    after: YTUnitSnapshot;
    message: string;
  },
): AlertEventInput {
  const previousReason = normalizeStateReason(input.before.stopReason);
  const currentReason = normalizeStateReason(input.after.stopReason);
  const driverName = input.after.driverName || input.before.driverName || null;
  const loginTime = input.after.loginTime || input.before.loginTime || null;

  return createEvent({
    category: "YT",
    type: "yt_unit_status_changed",
    source: input.source,
    dedupeKey: `yt:unit:${input.after.ytNo}:${input.transitionKind}:${input.after.fingerprint}`,
    title: `YT 상태 변화 (${input.after.ytNo})`,
    message: input.message,
    beforeValue: input.before.semanticState,
    afterValue: input.after.semanticState,
    payload: {
      type: "yt_unit_status_changed",
      transitionKind: input.transitionKind,
      ytNo: input.after.ytNo,
      driverName,
      previousState: input.before.semanticState,
      currentState: input.after.semanticState,
      previousReason,
      currentReason,
      loginTime,
      message: input.message,
      previousFingerprint: input.before.fingerprint,
      currentFingerprint: input.after.fingerprint,
      capturedAt: input.occurredAt,
      sourceUrl: input.sourceUrl,
    },
    occurredAt: input.occurredAt,
  });
}

function formatYtLabel(ytNo: string, driverName: string | null): string {
  if (driverName) {
    return `${ytNo} ${driverName}`;
  }
  return ytNo;
}

export function detectYtUnitStatusEvents(
  prev: EquipmentLoginStatus[],
  curr: EquipmentLoginStatus[],
  source: SourceId,
  occurredAt: string,
  options: YtUnitEventOptions,
): AlertEventInput[] {
  const prevUnits = buildYtUnitSnapshotFromEquipment(prev);
  const currUnits = buildYtUnitSnapshotFromEquipment(curr);
  const prevMap = byKey(prevUnits, (item) => item.ytNo);
  const currMap = byKey(currUnits, (item) => item.ytNo);
  const ytNos = Array.from(new Set([...prevMap.keys(), ...currMap.keys()])).sort(compareYtNo);
  const events: AlertEventInput[] = [];

  for (const ytNo of ytNos) {
    const before = prevMap.get(ytNo);
    const afterExisting = currMap.get(ytNo);

    if (!before) {
      continue;
    }

    const after = afterExisting || createSyntheticLoggedOutSnapshot(before);
    if (before.fingerprint === after.fingerprint) {
      continue;
    }

    let transitionKind: YTUnitTransitionKind | null = null;
    let message: string | null = null;
    const label = formatYtLabel(ytNo, after.driverName || before.driverName);
    const previousReason = normalizeStateReason(before.stopReason);
    const currentReason = normalizeStateReason(after.stopReason);

    if (before.semanticState === "active" && after.semanticState === "stopped") {
      transitionKind = "active_to_stopped";
      message = `${label} 중단: ${currentReason || "-"}`;
    } else if (before.semanticState === "active" && after.semanticState === "logged_out") {
      transitionKind = "active_to_logged_out";
      message = `${label} 로그아웃`;
    } else if (before.semanticState === "stopped" && after.semanticState === "active") {
      transitionKind = "stopped_to_active";
      message = `${label} 중단 해제`;
    } else if (before.semanticState === "logged_out" && after.semanticState === "active") {
      transitionKind = "logged_out_to_active";
      message = `${label} 다시 로그인`;
    } else if (
      before.semanticState === "stopped" &&
      after.semanticState === "stopped" &&
      previousReason !== currentReason
    ) {
      transitionKind = "stopped_reason_changed";
      message = `${label} 중단 사유 변경: ${previousReason || "-"} -> ${currentReason || "-"}`;
    }

    if (!transitionKind || !message) {
      continue;
    }

    events.push(
      buildYtUnitAlert({
        source,
        occurredAt,
        sourceUrl: options.sourceUrl,
        transitionKind,
        before,
        after,
        message,
      }),
    );
  }

  return events;
}

export function diffYtThreshold(
  prev: YTCountSnapshot | null,
  curr: YTCountSnapshot | null,
  threshold: number,
  source: SourceId,
  occurredAt: string,
): AlertEventInput[] {
  if (!prev || !curr) {
    return [];
  }

  if (prev.totalLoggedIn >= threshold && curr.totalLoggedIn < threshold) {
    return [
      createEvent({
        category: "YT",
        type: "YT_BELOW_THRESHOLD",
        source,
        dedupeKey: `yt:below:${threshold}`,
        title: "YT 로그인 수 임계치 하회",
        message: `YT 로그인 ${curr.totalLoggedIn}명 (임계치 ${threshold})`,
        beforeValue: String(prev.totalLoggedIn),
        afterValue: String(curr.totalLoggedIn),
        payload: {
          threshold,
          totalKnown: curr.totalKnown,
        },
        occurredAt,
      }),
    ];
  }

  return [];
}

export function diffWeather(
  prev: WeatherNoticeSnapshot | null,
  curr: WeatherNoticeSnapshot | null,
  source: SourceId,
  occurredAt: string,
  options?: {
    ignoreNoticeWhenForecastActive?: boolean;
    forecastState?: "none" | "partial" | "all";
  },
): AlertEventInput[] {
  if (!curr) {
    return [];
  }

  if (
    source === "ys_notice" &&
    options?.ignoreNoticeWhenForecastActive &&
    options.forecastState &&
    options.forecastState !== "none"
  ) {
    return [];
  }

  type WeatherSemantic = "NORMAL" | "SUSPENDED" | "UNKNOWN";
  type EffectiveWeatherSemantic = Exclude<WeatherSemantic, "UNKNOWN">;

  const toSemantic = (snapshot: WeatherNoticeSnapshot | null): WeatherSemantic => {
    if (!snapshot) {
      return "NORMAL";
    }
    if (
      snapshot.semanticState === "NORMAL" ||
      snapshot.semanticState === "SUSPENDED" ||
      snapshot.semanticState === "UNKNOWN"
    ) {
      return snapshot.semanticState;
    }
    return snapshot.suspensionState === "none" ? "NORMAL" : "SUSPENDED";
  };

  const toLegacyState = (semantic: EffectiveWeatherSemantic): "none" | "all" => {
    return semantic === "SUSPENDED" ? "all" : "none";
  };

  const textFromSnapshot = (snapshot: WeatherNoticeSnapshot | null): string | null => {
    if (!snapshot) {
      return null;
    }
    return snapshot.dispatchTeamDutyText || snapshot.standbyCallText || snapshot.noticeHeadline || snapshot.dutyText || null;
  };

  const prevSemanticRaw = toSemantic(prev);
  const prevSemantic: EffectiveWeatherSemantic = prevSemanticRaw === "UNKNOWN" ? "NORMAL" : prevSemanticRaw;
  const currSemanticRaw = toSemantic(curr);
  const currSemantic: EffectiveWeatherSemantic = currSemanticRaw === "UNKNOWN" ? prevSemantic : currSemanticRaw;
  const prevState = toLegacyState(prevSemantic);
  const currState = toLegacyState(currSemantic);
  const prevText = textFromSnapshot(prev);
  const currText = textFromSnapshot(curr);
  const debugPayload = {
    oldState: prevState,
    newState: currState,
    oldSemanticState: prevSemantic,
    newSemanticState: currSemantic,
    dispatchTeamText: curr.dispatchTeamDutyText || null,
    standbyCallText: curr.standbyCallText || curr.dutyText || null,
    matchedKeywords: curr.matchedKeywords || [],
    normalizedReason: curr.normalizedReason || null,
    keywords: curr.matchedKeywords || [],
  };

  if (prevSemantic === currSemantic) {
    return [];
  }

  if (prevSemantic === "NORMAL" && currSemantic === "SUSPENDED") {
    return [
      createEvent({
        category: "WEATHER",
        type: "ALL_SUSPENDED",
        source,
        dedupeKey: "weather:all_suspended",
        title: "전체 도선 중단",
        message: curr.normalizedReason || currText || "All Pilotage Suspended",
        beforeValue: prevText,
        afterValue: currText,
        payload: debugPayload,
        occurredAt,
      }),
    ];
  }

  if (prevSemantic === "SUSPENDED" && currSemantic === "NORMAL") {
    return [
      createEvent({
        category: "WEATHER",
        type: "RESUMED",
        source,
        dedupeKey: "weather:resumed",
        title: "도선 재개",
        message: curr.normalizedReason || currText || "도선 중단 상태가 해제되었습니다.",
        beforeValue: prevText,
        afterValue: currText,
        payload: debugPayload,
        occurredAt,
      }),
    ];
  }

  return [];
}
