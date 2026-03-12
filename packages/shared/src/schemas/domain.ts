import { z } from "zod";

export const SourceIdSchema = z.enum([
  "gwct_schedule_list",
  "gwct_schedule_chart",
  "gwct_work_status",
  "gwct_gc_remaining",
  "gwct_equipment_status",
  "ys_forecast",
  "ys_notice",
  "ys_news",
]);
export type SourceId = z.infer<typeof SourceIdSchema>;

export const EventCategorySchema = z.enum([
  "VESSEL",
  "CRANE",
  "EQUIPMENT",
  "YT",
  "WEATHER",
]);
export type EventCategory = z.infer<typeof EventCategorySchema>;

export const VesselScheduleItemSchema = z.object({
  source: SourceIdSchema,
  vesselKey: z.string(),
  vesselName: z.string(),
  terminalVoyage: z.string().nullable(),
  berth: z.string().nullable(),
  shippingLine: z.string().nullable(),
  route: z.string().nullable(),
  eta: z.string().nullable(),
  etb: z.string().nullable(),
  ata: z.string().nullable(),
  etd: z.string().nullable(),
  atd: z.string().nullable(),
  status: z.string().nullable(),
  workStartAt: z.string().nullable(),
  workEndAt: z.string().nullable(),
  importCutoffAt: z.string().nullable(),
  rawLabelMap: z.record(z.string()).default({}),
  signature: z.string(),
  seenAt: z.string(),
});
export type VesselScheduleItem = z.infer<typeof VesselScheduleItemSchema>;

export const VesselScheduleChangeTypeSchema = z.enum([
  "NEW_VESSEL",
  "REMOVED_VESSEL",
  "TIME_PULLED_FORWARD",
  "TIME_DELAYED",
  "BERTH_CHANGED",
  "STATUS_CHANGED",
  "FIELD_CHANGED",
]);
export type VesselScheduleChangeType = z.infer<typeof VesselScheduleChangeTypeSchema>;

export const VesselScheduleChangeEventSchema = z.object({
  id: z.string(),
  vesselKey: z.string(),
  changeType: VesselScheduleChangeTypeSchema,
  fieldName: z.string().nullable(),
  oldValue: z.string().nullable(),
  newValue: z.string().nullable(),
  occurredAt: z.string(),
  dedupeKey: z.string(),
});
export type VesselScheduleChangeEvent = z.infer<typeof VesselScheduleChangeEventSchema>;

export const CraneStatusSchema = z.object({
  craneId: z.string(),
  vesselName: z.string().nullable(),
  dischargeDone: z.number().nullable(),
  loadDone: z.number().nullable(),
  dischargeRemaining: z.number().nullable(),
  loadRemaining: z.number().nullable(),
  totalRemaining: z.number().nullable(),
  progressPercent: z.number().nullable(),
  source: SourceIdSchema,
  signature: z.string(),
  seenAt: z.string(),
});
export type CraneStatus = z.infer<typeof CraneStatusSchema>;

export const CraneThresholdRuleSchema = z.object({
  craneId: z.string(),
  threshold: z.number().int().nonnegative(),
  enabled: z.boolean(),
});
export type CraneThresholdRule = z.infer<typeof CraneThresholdRuleSchema>;

export const EquipmentLoginStatusSchema = z.object({
  equipmentId: z.string(),
  operatorName: z.string().nullable(),
  helperName: z.string().nullable(),
  loginText: z.string().nullable(),
  stopReason: z.string().nullable(),
  source: SourceIdSchema,
  signature: z.string(),
  seenAt: z.string(),
});
export type EquipmentLoginStatus = z.infer<typeof EquipmentLoginStatusSchema>;

export const EquipmentLoginEventSchema = z.object({
  id: z.string(),
  equipmentId: z.string(),
  eventType: z.string(),
  oldOperator: z.string().nullable(),
  newOperator: z.string().nullable(),
  oldHelper: z.string().nullable(),
  newHelper: z.string().nullable(),
  occurredAt: z.string(),
  dedupeKey: z.string(),
});
export type EquipmentLoginEvent = z.infer<typeof EquipmentLoginEventSchema>;

export const YTCountSnapshotSchema = z.object({
  totalLoggedIn: z.number().int().nonnegative(),
  totalKnown: z.number().int().nonnegative(),
  threshold: z.number().int().nonnegative().nullable(),
  source: SourceIdSchema,
  seenAt: z.string(),
  signature: z.string(),
});
export type YTCountSnapshot = z.infer<typeof YTCountSnapshotSchema>;

export const YTSemanticStateSchema = z.enum(["active", "stopped", "logged_out"]);
export type YTSemanticState = z.infer<typeof YTSemanticStateSchema>;

export const YTUnitSnapshotSchema = z.object({
  ytNo: z.string(),
  driverName: z.string().nullable(),
  loginTime: z.string().nullable(),
  logoutTime: z.string().nullable().optional(),
  hkName: z.string().nullable(),
  stopReason: z.string().nullable(),
  semanticState: YTSemanticStateSchema,
  fingerprint: z.string(),
});
export type YTUnitSnapshot = z.infer<typeof YTUnitSnapshotSchema>;

export const YTUnitTransitionKindSchema = z.enum([
  "active_to_stopped",
  "active_to_logged_out",
  "stopped_to_active",
  "logged_out_to_active",
  "stopped_reason_changed",
  "driver_changed",
  "shift_handoff",
]);
export type YTUnitTransitionKind = z.infer<typeof YTUnitTransitionKindSchema>;

export const YTWorkShiftModeSchema = z.enum(["day", "night"]);
export type YTWorkShiftMode = z.infer<typeof YTWorkShiftModeSchema>;

export const YTWorkSessionStatusSchema = z.enum(["active", "completed"]);
export type YTWorkSessionStatus = z.infer<typeof YTWorkSessionStatusSchema>;

export const YTWorkSessionBreakSchema = z.object({
  label: z.string(),
  startAt: z.string(),
  endAt: z.string(),
});
export type YTWorkSessionBreak = z.infer<typeof YTWorkSessionBreakSchema>;

export const YTWorkStopReasonCounterKindSchema = z.enum([
  "over_high",
  "cabin_shuttle",
  "ship_work_request_stop",
  "restroom",
]);
export type YTWorkStopReasonCounterKind = z.infer<typeof YTWorkStopReasonCounterKindSchema>;

export const YTWorkStopReasonCounterSchema = z.object({
  kind: YTWorkStopReasonCounterKindSchema,
  label: z.string(),
  count: z.number().int().nonnegative(),
});
export type YTWorkStopReasonCounter = z.infer<typeof YTWorkStopReasonCounterSchema>;

export const YTWorkDriverSummarySchema = z.object({
  driverKey: z.string(),
  driverName: z.string(),
  latestYtNo: z.string().nullable(),
  activeYtNo: z.string().nullable(),
  totalWorkedMs: z.number().int().nonnegative(),
  totalWorkedMinutes: z.number().int().nonnegative(),
  totalWorkedLabel: z.string(),
  adjustedWorkedMs: z.number().int().nonnegative(),
  adjustedWorkedMinutes: z.number().int().nonnegative(),
  adjustedWorkedLabel: z.string(),
  adjustmentDeltaMs: z.number().int(),
  adjustmentDeltaMinutes: z.number().int(),
  adjustmentDeltaLabel: z.string().nullable(),
  currentSegmentStartedAt: z.string().nullable(),
  latestState: YTSemanticStateSchema,
  latestStopReason: z.string().nullable(),
  firstSeenAt: z.string(),
  lastSeenAt: z.string(),
  lastWorkedAt: z.string().nullable(),
  segments: z.number().int().nonnegative(),
  stopReasonCounters: z.array(YTWorkStopReasonCounterSchema),
});
export type YTWorkDriverSummary = z.infer<typeof YTWorkDriverSummarySchema>;

export const YTWorkSessionSchema = z.object({
  mode: YTWorkShiftModeSchema,
  status: YTWorkSessionStatusSchema,
  shiftWindowStartedAt: z.string(),
  startedAt: z.string(),
  endsAt: z.string(),
  completedAt: z.string().nullable(),
  observedAt: z.string(),
  timezone: z.string(),
  breaks: z.array(YTWorkSessionBreakSchema),
  drivers: z.array(YTWorkDriverSummarySchema),
});
export type YTWorkSession = z.infer<typeof YTWorkSessionSchema>;

export const YTWorkShiftIndicatorStateSchema = z.enum(["collecting", "paused", "idle"]);
export type YTWorkShiftIndicatorState = z.infer<typeof YTWorkShiftIndicatorStateSchema>;

export const YTWorkShiftIndicatorReasonSchema = z.enum([
  "active_shift",
  "break_time",
  "awaiting_login",
  "team_off",
  "no_snapshot",
]);
export type YTWorkShiftIndicatorReason = z.infer<typeof YTWorkShiftIndicatorReasonSchema>;

export const YTWorkShiftIndicatorSchema = z.object({
  state: YTWorkShiftIndicatorStateSchema,
  reason: YTWorkShiftIndicatorReasonSchema,
  mode: YTWorkShiftModeSchema.nullable(),
  label: z.string(),
  detail: z.string().nullable(),
});
export type YTWorkShiftIndicator = z.infer<typeof YTWorkShiftIndicatorSchema>;

export const YTWorkSessionResponseSchema = z.object({
  session: YTWorkSessionSchema.nullable(),
  latestYtCapturedAt: z.string().nullable(),
  hasLiveSnapshot: z.boolean(),
  shiftStatus: YTWorkShiftIndicatorSchema,
});
export type YTWorkSessionResponse = z.infer<typeof YTWorkSessionResponseSchema>;

export const YTUnitStatusChangedPayloadSchema = z.object({
  type: z.literal("yt_unit_status_changed"),
  transitionKind: YTUnitTransitionKindSchema,
  ytNo: z.string(),
  driverName: z.string().nullable(),
  previousState: YTSemanticStateSchema,
  currentState: YTSemanticStateSchema,
  previousReason: z.string().nullable(),
  currentReason: z.string().nullable(),
  loginTime: z.string().nullable(),
  message: z.string(),
  previousFingerprint: z.string(),
  currentFingerprint: z.string(),
});
export type YTUnitStatusChangedPayload = z.infer<typeof YTUnitStatusChangedPayloadSchema>;

export const YTThresholdRuleSchema = z.object({
  threshold: z.number().int().nonnegative(),
  enabled: z.boolean(),
});
export type YTThresholdRule = z.infer<typeof YTThresholdRuleSchema>;

export const YtMasterCallRoleSchema = z.enum(["driver", "master"]);
export type YtMasterCallRole = z.infer<typeof YtMasterCallRoleSchema>;

export const YtMasterCallMasterSlotSchema = z.enum(["MASTER-1", "MASTER-2"]);
export type YtMasterCallMasterSlot = z.infer<typeof YtMasterCallMasterSlotSchema>;

export const YtMasterCallStatusSchema = z.enum([
  "pending",
  "sent",
  "approved",
  "rejected",
  "acknowledged",
  "cancelled",
]);
export type YtMasterCallStatus = z.infer<typeof YtMasterCallStatusSchema>;

export const YtMasterCallHandlingModeSchema = z.enum(["decision", "message"]);
export type YtMasterCallHandlingMode = z.infer<typeof YtMasterCallHandlingModeSchema>;

export const YtMasterCallReasonSchema = z.enum(["tractor_inspection", "restroom", "other", "emergency_accident"]);
export type YtMasterCallReason = z.infer<typeof YtMasterCallReasonSchema>;

export const YtMasterCallArchiveKindSchema = z.enum(["tractor_inspection", "other"]);
export type YtMasterCallArchiveKind = z.infer<typeof YtMasterCallArchiveKindSchema>;

export const YT_MASTER_CALL_REASON_LABELS: Record<YtMasterCallReason, string> = {
  tractor_inspection: "트랙터 점검",
  restroom: "화장실",
  other: "기타 사유",
  emergency_accident: "긴급 사고",
};

export const YtMasterCallTractorSubreasonSchema = z.enum([
  "flat_tire",
  "wheel_detached",
  "coolant",
  "engine_oil",
  "mission_oil",
  "fueling",
  "air_conditioner",
  "heater",
  "radio_failure",
  "base_bolt",
  "first_axle_tire_wire",
  "light_replacement",
  "engine_stall",
  "starting_failure",
  "hydraulic_oil",
  "power_oil",
  "air_leak",
  "spring_break_3plus",
  "wheel_bolt_break_3plus",
  "dashcam",
  "drowsiness_prevention_device",
  "seatbelt",
  "window_damage",
  "top_tilting_failure",
  "battery_discharge",
  "mirror_replacement",
  "mirror_bolt_tightening",
  "spring_equalizer_detachment",
  "hub_oil_leak",
  "undercarriage_oil_leak",
]);
export type YtMasterCallTractorSubreason = z.infer<typeof YtMasterCallTractorSubreasonSchema>;

export const YT_MASTER_CALL_TRACTOR_SUBREASON_OPTIONS: readonly YtMasterCallTractorSubreason[] = [
  "flat_tire",
  "wheel_detached",
  "coolant",
  "engine_oil",
  "mission_oil",
  "fueling",
  "air_conditioner",
  "heater",
  "radio_failure",
  "base_bolt",
  "first_axle_tire_wire",
  "light_replacement",
  "engine_stall",
  "starting_failure",
  "hydraulic_oil",
  "power_oil",
  "air_leak",
  "spring_break_3plus",
  "wheel_bolt_break_3plus",
  "dashcam",
  "drowsiness_prevention_device",
  "seatbelt",
  "window_damage",
  "top_tilting_failure",
  "battery_discharge",
  "mirror_replacement",
  "mirror_bolt_tightening",
  "spring_equalizer_detachment",
  "hub_oil_leak",
  "undercarriage_oil_leak",
];

export const YT_MASTER_CALL_TRACTOR_SUBREASON_LABELS: Record<YtMasterCallTractorSubreason, string> = {
  flat_tire: "타이어 펑크",
  wheel_detached: "바퀴 빠짐",
  coolant: "냉각수 보충",
  engine_oil: "엔진오일 보충",
  mission_oil: "미션오일 보충",
  fueling: "주유",
  air_conditioner: "에어컨",
  heater: "히터",
  radio_failure: "무전기 불량",
  base_bolt: "베이스볼트",
  first_axle_tire_wire: "1축 타이어 철심",
  light_replacement: "라이트 교체",
  engine_stall: "시동꺼짐",
  starting_failure: "시동불량",
  hydraulic_oil: "작동유 보충",
  power_oil: "파워오일보충",
  air_leak: "에어누공",
  spring_break_3plus: "판스프링 3장 이상 파손",
  wheel_bolt_break_3plus: "휠 볼트 3개 이상 파손",
  dashcam: "블랙박스",
  drowsiness_prevention_device: "졸음 방지기",
  seatbelt: "안전벨트 고장",
  window_damage: "유리창 파손",
  top_tilting_failure: "탑 틸팅 안됨",
  battery_discharge: "배터리 방전",
  mirror_replacement: "백미러 교체",
  mirror_bolt_tightening: "백미러 볼트 쪼이기",
  spring_equalizer_detachment: "판스프링 이퀄라이저 이탈",
  hub_oil_leak: "허브오일 누유",
  undercarriage_oil_leak: "하부누유",
};

export const YtMasterCallOtherSubreasonSchema = z.enum([
  "tea_time",
  "day_off_schedule",
  "outing",
  "individual_counseling",
  "suggestion",
  "gc181_cabin_report",
  "gc182_cabin_report",
  "gc183_cabin_report",
  "gc184_cabin_report",
  "gc185_cabin_report",
  "gc186_cabin_report",
  "gc187_cabin_report",
  "gc188_cabin_report",
  "gc189_cabin_report",
  "gc190_cabin_report",
  "tc_bad_manners_report",
  "reach_bad_manners_report",
  "under_bad_manners_report",
  "lashingman_danger",
  "inspection_danger",
  "yard_container_first_lane_first_tier_protrusion",
  "shift_shuttle",
  "transshipment_done",
  "vessel_done",
  "lunch_shuttle",
  "wash_face",
  "cold_water",
]);
export type YtMasterCallOtherSubreason = z.infer<typeof YtMasterCallOtherSubreasonSchema>;

export const YT_MASTER_CALL_OTHER_SUBREASON_OPTIONS: readonly YtMasterCallOtherSubreason[] = [
  "tea_time",
  "day_off_schedule",
  "outing",
  "individual_counseling",
  "suggestion",
  "gc181_cabin_report",
  "gc182_cabin_report",
  "gc183_cabin_report",
  "gc184_cabin_report",
  "gc185_cabin_report",
  "gc186_cabin_report",
  "gc187_cabin_report",
  "gc188_cabin_report",
  "gc189_cabin_report",
  "gc190_cabin_report",
  "tc_bad_manners_report",
  "reach_bad_manners_report",
  "under_bad_manners_report",
  "lashingman_danger",
  "inspection_danger",
  "yard_container_first_lane_first_tier_protrusion",
  "shift_shuttle",
  "transshipment_done",
  "vessel_done",
  "lunch_shuttle",
  "wash_face",
  "cold_water",
];

export const YT_MASTER_CALL_OTHER_SUBREASON_LABELS: Record<YtMasterCallOtherSubreason, string> = {
  tea_time: "티타임",
  day_off_schedule: "휴무일정",
  outing: "외출",
  individual_counseling: "개별상담",
  suggestion: "건의사항",
  gc181_cabin_report: "GC181 고발",
  gc182_cabin_report: "GC182 고발",
  gc183_cabin_report: "GC183 고발",
  gc184_cabin_report: "GC184 고발",
  gc185_cabin_report: "GC185 고발",
  gc186_cabin_report: "GC186 고발",
  gc187_cabin_report: "GC187 고발",
  gc188_cabin_report: "GC188 고발",
  gc189_cabin_report: "GC189 고발",
  gc190_cabin_report: "GC190 고발",
  tc_bad_manners_report: "TC 고발",
  reach_bad_manners_report: "리치 고발",
  under_bad_manners_report: "언더 고발",
  lashingman_danger: "라이싱맨 위험",
  inspection_danger: "검수 위험",
  yard_container_first_lane_first_tier_protrusion: "컨테이너 돌출",
  shift_shuttle: "교대 셔틀",
  transshipment_done: "이적 끝",
  vessel_done: "본선 끝",
  lunch_shuttle: "점심 셔틀",
  wash_face: "세수",
  cold_water: "냉수 한잔",
};

export const YT_MASTER_CALL_MESSAGE_ONLY_OTHER_SUBREASON_OPTIONS: readonly YtMasterCallOtherSubreason[] = [
  "individual_counseling",
  "suggestion",
  "gc181_cabin_report",
  "gc182_cabin_report",
  "gc183_cabin_report",
  "gc184_cabin_report",
  "gc185_cabin_report",
  "gc186_cabin_report",
  "gc187_cabin_report",
  "gc188_cabin_report",
  "gc189_cabin_report",
  "gc190_cabin_report",
  "tc_bad_manners_report",
  "reach_bad_manners_report",
  "under_bad_manners_report",
  "lashingman_danger",
  "inspection_danger",
  "yard_container_first_lane_first_tier_protrusion",
  "transshipment_done",
  "vessel_done",
];

export const YT_MASTER_CALL_DUPLICATE_LOCKED_OTHER_SUBREASON_OPTIONS: readonly YtMasterCallOtherSubreason[] = [
  "shift_shuttle",
  "transshipment_done",
  "vessel_done",
  "lunch_shuttle",
];

export const YT_MASTER_CALL_DUPLICATE_LOCK_WINDOW_MS = 20 * 60 * 1000;

export const YT_MASTER_CALL_MESSAGE_ONLY_TRACTOR_SUBREASON_OPTIONS: readonly YtMasterCallTractorSubreason[] = [
  "engine_stall",
  "starting_failure",
  "radio_failure",
  "battery_discharge",
  "dashcam",
  "drowsiness_prevention_device",
  "seatbelt",
  "wheel_detached",
];

export const YtMasterCallReasonDetailCodeSchema = z.union([
  YtMasterCallTractorSubreasonSchema,
  YtMasterCallOtherSubreasonSchema,
]);
export type YtMasterCallReasonDetailCode = z.infer<typeof YtMasterCallReasonDetailCodeSchema>;

const YT_MASTER_CALL_TRACTOR_SUBREASON_SET = new Set<string>(YT_MASTER_CALL_TRACTOR_SUBREASON_OPTIONS);
const YT_MASTER_CALL_OTHER_SUBREASON_SET = new Set<string>(YT_MASTER_CALL_OTHER_SUBREASON_OPTIONS);
const YT_MASTER_CALL_MESSAGE_ONLY_TRACTOR_SUBREASON_SET = new Set<string>(
  YT_MASTER_CALL_MESSAGE_ONLY_TRACTOR_SUBREASON_OPTIONS,
);
const YT_MASTER_CALL_MESSAGE_ONLY_OTHER_SUBREASON_SET = new Set<string>(
  YT_MASTER_CALL_MESSAGE_ONLY_OTHER_SUBREASON_OPTIONS,
);
const YT_MASTER_CALL_DUPLICATE_LOCKED_OTHER_SUBREASON_SET = new Set<string>(
  YT_MASTER_CALL_DUPLICATE_LOCKED_OTHER_SUBREASON_OPTIONS,
);

export function isYtMasterCallTractorSubreason(
  value: string,
): value is YtMasterCallTractorSubreason {
  return YT_MASTER_CALL_TRACTOR_SUBREASON_SET.has(value);
}

export function isYtMasterCallOtherSubreason(
  value: string,
): value is YtMasterCallOtherSubreason {
  return YT_MASTER_CALL_OTHER_SUBREASON_SET.has(value);
}

export function isYtMasterCallMessageOnlyOtherSubreason(
  value: string,
): value is YtMasterCallOtherSubreason {
  return YT_MASTER_CALL_MESSAGE_ONLY_OTHER_SUBREASON_SET.has(value);
}

export function isYtMasterCallDuplicateLockedOtherSubreason(
  value: string,
): value is YtMasterCallOtherSubreason {
  return YT_MASTER_CALL_DUPLICATE_LOCKED_OTHER_SUBREASON_SET.has(value);
}

export function isYtMasterCallMessageOnlyTractorSubreason(
  value: string,
): value is YtMasterCallTractorSubreason {
  return YT_MASTER_CALL_MESSAGE_ONLY_TRACTOR_SUBREASON_SET.has(value);
}

const YT_MASTER_CALL_DAY_OFF_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseYtMasterCallDayOffSingleDateValue(value: string): {
  year: number;
  month: number;
  day: number;
} | null {
  const match = YT_MASTER_CALL_DAY_OFF_DATE_REGEX.exec(value);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return {
    year,
    month,
    day,
  };
}

function getYtMasterCallDayOffDateTimestamp(value: { year: number; month: number; day: number }): number {
  return Date.UTC(value.year, value.month - 1, value.day);
}

function normalizeYtMasterCallDayOffDateList(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function parseYtMasterCallDayOffDateListValue(value: string): string[] | null {
  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (!items.length) {
    return null;
  }
  if (items.some((item) => item.includes("~") || !parseYtMasterCallDayOffSingleDateValue(item))) {
    return null;
  }
  return normalizeYtMasterCallDayOffDateList(items);
}

function parseYtMasterCallLegacyDayOffRangeValue(value: string): { start: string; end: string | null } | null {
  const [rawStartValue, rawEndValue, extraValue] = value.split("~").map((item) => item.trim());
  if (!rawStartValue || extraValue) {
    return null;
  }

  const startValue = parseYtMasterCallDayOffSingleDateValue(rawStartValue);
  if (!startValue) {
    return null;
  }
  if (!rawEndValue) {
    return { start: rawStartValue, end: null };
  }

  const endValue = parseYtMasterCallDayOffSingleDateValue(rawEndValue);
  if (!endValue) {
    return null;
  }

  if (getYtMasterCallDayOffDateTimestamp(endValue) < getYtMasterCallDayOffDateTimestamp(startValue)) {
    return null;
  }

  return {
    start: rawStartValue,
    end: rawEndValue,
  };
}

export function isYtMasterCallDayOffDateValue(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed.length) {
    return false;
  }
  if (trimmed.includes(",")) {
    return Boolean(parseYtMasterCallDayOffDateListValue(trimmed));
  }
  return Boolean(parseYtMasterCallLegacyDayOffRangeValue(trimmed));
}

function formatYtMasterCallDayOffSingleDateValue(value: { year: number; month: number; day: number }): string {
  return `${String(value.month).padStart(2, "0")}.${String(value.day).padStart(2, "0")}`;
}

function formatYtMasterCallDayOffRangeSegment(values: Array<{ year: number; month: number; day: number }>): string {
  const first = values[0];
  const last = values[values.length - 1];
  const formattedFirst = formatYtMasterCallDayOffSingleDateValue(first);
  const formattedLast = formatYtMasterCallDayOffSingleDateValue(last);
  return formattedFirst === formattedLast ? formattedFirst : `${formattedFirst}~${formattedLast}`;
}

function formatYtMasterCallDayOffDateValue(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed.length) {
    return null;
  }
  if (trimmed.includes(",")) {
    const listValues = parseYtMasterCallDayOffDateListValue(trimmed);
    if (!listValues) {
      return null;
    }
    const parsedValues = listValues
      .map((item) => parseYtMasterCallDayOffSingleDateValue(item))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    if (!parsedValues.length) {
      return null;
    }

    const segments: Array<Array<{ year: number; month: number; day: number }>> = [];
    for (const parsedValue of parsedValues) {
      const currentSegment = segments[segments.length - 1];
      if (!currentSegment) {
        segments.push([parsedValue]);
        continue;
      }

      const lastValue = currentSegment[currentSegment.length - 1];
      const isNextConsecutiveDay =
        getYtMasterCallDayOffDateTimestamp(parsedValue) - getYtMasterCallDayOffDateTimestamp(lastValue) ===
        24 * 60 * 60 * 1000;

      if (isNextConsecutiveDay) {
        currentSegment.push(parsedValue);
        continue;
      }

      segments.push([parsedValue]);
    }

    return segments.map(formatYtMasterCallDayOffRangeSegment).join(", ");
  }

  const legacyRangeValue = parseYtMasterCallLegacyDayOffRangeValue(trimmed);
  if (!legacyRangeValue) {
    return null;
  }
  const startValue = parseYtMasterCallDayOffSingleDateValue(legacyRangeValue.start);
  if (!startValue) {
    return null;
  }
  if (!legacyRangeValue.end) {
    return formatYtMasterCallDayOffSingleDateValue(startValue);
  }
  const endValue = parseYtMasterCallDayOffSingleDateValue(legacyRangeValue.end);
  if (!endValue) {
    return null;
  }
  const formattedStartValue = formatYtMasterCallDayOffSingleDateValue(startValue);
  const formattedEndValue = formatYtMasterCallDayOffSingleDateValue(endValue);
  return formattedStartValue === formattedEndValue
    ? formattedStartValue
    : `${formattedStartValue}~${formattedEndValue}`;
}

export function getYtMasterCallReasonDetailLabel(
  reasonCode: YtMasterCallReason,
  reasonDetailCode?: YtMasterCallReasonDetailCode | null,
  reasonDetailValue?: string | null,
): string | null {
  if (!reasonDetailCode) {
    return null;
  }
  if (reasonCode === "tractor_inspection" && isYtMasterCallTractorSubreason(reasonDetailCode)) {
    return YT_MASTER_CALL_TRACTOR_SUBREASON_LABELS[reasonDetailCode];
  }
  if (reasonCode === "other" && isYtMasterCallOtherSubreason(reasonDetailCode)) {
    const baseLabel = YT_MASTER_CALL_OTHER_SUBREASON_LABELS[reasonDetailCode];
    if (reasonDetailCode === "day_off_schedule" && reasonDetailValue) {
      const formattedDate = formatYtMasterCallDayOffDateValue(reasonDetailValue);
      return formattedDate ? `${baseLabel} ${formattedDate}` : baseLabel;
    }
    return baseLabel;
  }
  return null;
}

export function getYtMasterCallHandlingMode(
  reasonCode: YtMasterCallReason,
  reasonDetailCode?: YtMasterCallReasonDetailCode | null,
): YtMasterCallHandlingMode {
  if (reasonCode === "emergency_accident") {
    return "message";
  }
  if (
    reasonCode === "tractor_inspection" &&
    reasonDetailCode &&
    isYtMasterCallMessageOnlyTractorSubreason(reasonDetailCode)
  ) {
    return "message";
  }
  if (
    reasonCode === "other" &&
    reasonDetailCode &&
    isYtMasterCallMessageOnlyOtherSubreason(reasonDetailCode)
  ) {
    return "message";
  }
  return "decision";
}

export function formatYtMasterCallReasonDisplay(
  reasonLabel: string,
  reasonDetailLabel?: string | null,
): string {
  return reasonDetailLabel ? `${reasonLabel} · ${reasonDetailLabel}` : reasonLabel;
}

export function getYtMasterCallArchiveKind(reasonCode: YtMasterCallReason): YtMasterCallArchiveKind | null {
  if (reasonCode === "tractor_inspection") {
    return "tractor_inspection";
  }
  if (reasonCode === "other") {
    return "other";
  }
  return null;
}

const YT_DRIVER_IDENTITY_SEGMENT_REGEX = /[0-9A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ]+/g;

function stripEdgeYtMarkers(value: string): string {
  let next = value;
  while (/^YT/i.test(next)) {
    next = next.slice(2);
  }
  while (/YT$/i.test(next)) {
    next = next.slice(0, -2);
  }
  return next;
}

export function normalizeYtDriverIdentityInput(rawValue: string): {
  normalizedInput: string;
  ytNumber: string;
  ytNumberDigits: string;
  name: string;
} {
  const normalizedInput = rawValue.normalize("NFKC").trim();
  if (!normalizedInput.length) {
    throw new Error("YT 번호와 이름을 입력해 주세요.");
  }

  const collapsed = (normalizedInput.match(YT_DRIVER_IDENTITY_SEGMENT_REGEX) ?? []).join("");
  const ytNumberDigits = collapsed.replace(/[^0-9]/g, "");
  if (!ytNumberDigits.length) {
    throw new Error("입력값에서 YT 번호를 찾을 수 없습니다.");
  }

  const name = stripEdgeYtMarkers(collapsed.replace(/[0-9]/g, ""));
  if (!name.length) {
    throw new Error("입력값에서 이름을 찾을 수 없습니다.");
  }

  return {
    normalizedInput,
    ytNumber: `YT-${ytNumberDigits}`,
    ytNumberDigits,
    name,
  };
}

export const YtMasterCallRegistrationSchema = z.object({
  deviceId: z.string(),
  role: YtMasterCallRoleSchema,
  name: z.string(),
  ytNumber: z.string().nullable(),
  masterSlot: YtMasterCallMasterSlotSchema.nullable(),
  registeredAt: z.string(),
  updatedAt: z.string(),
});
export type YtMasterCallRegistration = z.infer<typeof YtMasterCallRegistrationSchema>;

export const YtMasterCallQueueEntrySchema = z.object({
  id: z.string(),
  driverDeviceId: z.string(),
  driverName: z.string(),
  ytNumber: z.string(),
  reasonCode: YtMasterCallReasonSchema,
  reasonLabel: z.string(),
  reasonDetailCode: YtMasterCallReasonDetailCodeSchema.nullable().optional().default(null),
  reasonDetailLabel: z.string().nullable().optional().default(null),
  reasonDetailValue: z.string().trim().min(1).nullable().optional().default(null),
  handlingMode: YtMasterCallHandlingModeSchema.default("decision"),
  status: YtMasterCallStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  resolvedAt: z.string().nullable(),
  resolvedByDeviceId: z.string().nullable(),
  resolvedByName: z.string().nullable(),
  hiddenAt: z.string().nullable().optional().default(null),
  hiddenByDeviceId: z.string().nullable().optional().default(null),
  archivedAt: z.string().nullable().optional().default(null),
  archivedByDeviceId: z.string().nullable().optional().default(null),
});
export type YtMasterCallQueueEntry = z.infer<typeof YtMasterCallQueueEntrySchema>;

export const YtMasterCallMasterAssignmentSchema = z.object({
  slot: YtMasterCallMasterSlotSchema,
  deviceId: z.string(),
  name: z.string(),
});
export type YtMasterCallMasterAssignment = z.infer<typeof YtMasterCallMasterAssignmentSchema>;

export const YtMasterCallArchivesSchema = z.object({
  tractorInspection: z.array(YtMasterCallQueueEntrySchema),
  other: z.array(YtMasterCallQueueEntrySchema),
});
export type YtMasterCallArchives = z.infer<typeof YtMasterCallArchivesSchema>;

export const YtMasterCallLiveStateSchema = z.object({
  deviceId: z.string(),
  registration: YtMasterCallRegistrationSchema.nullable(),
  masterAssignments: z.array(YtMasterCallMasterAssignmentSchema),
  availableMasterSlots: z.array(YtMasterCallMasterSlotSchema),
  currentCall: YtMasterCallQueueEntrySchema.nullable(),
  queue: z.array(YtMasterCallQueueEntrySchema),
  archives: YtMasterCallArchivesSchema,
  pendingCount: z.number().int().nonnegative(),
});
export type YtMasterCallLiveState = z.infer<typeof YtMasterCallLiveStateSchema>;

export const YtMasterCallRegistrationInputSchema = z.discriminatedUnion("role", [
  z.object({
    deviceId: z.string(),
    role: z.literal("driver"),
    name: z.string().trim().min(1),
    ytNumber: z.string().trim().min(1),
  }),
  z.object({
    deviceId: z.string(),
    role: z.literal("master"),
    name: z.string().trim().min(1),
  }),
]);
export type YtMasterCallRegistrationInput = z.infer<typeof YtMasterCallRegistrationInputSchema>;

export const YtMasterCallCreateInputSchema = z.object({
  deviceId: z.string(),
  reasonCode: YtMasterCallReasonSchema,
  reasonDetailCode: YtMasterCallReasonDetailCodeSchema.nullable().optional().default(null),
  reasonDetailValue: z.string().trim().min(1).nullable().optional().default(null),
}).superRefine((value, ctx) => {
  const reasonDetailValue = value.reasonDetailValue || null;
  if (!value.reasonDetailCode) {
    if (reasonDetailValue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reasonDetailValue"],
        message: "Reason detail value requires a reason detail code.",
      });
    }
    return;
  }
  if (value.reasonCode === "tractor_inspection") {
    if (!isYtMasterCallTractorSubreason(value.reasonDetailCode)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reasonDetailCode"],
        message: "Tractor detail is allowed only for tractor inspection calls.",
      });
    }
    if (reasonDetailValue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reasonDetailValue"],
        message: "Reason detail value is not allowed for tractor inspection calls.",
      });
    }
    return;
  }
  if (value.reasonCode === "other") {
    if (!isYtMasterCallOtherSubreason(value.reasonDetailCode)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reasonDetailCode"],
        message: "Other detail is allowed only for other calls.",
      });
    }
    if (value.reasonDetailCode === "day_off_schedule") {
      if (!reasonDetailValue) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["reasonDetailValue"],
          message: "Day-off schedule calls require a date.",
        });
      } else if (!isYtMasterCallDayOffDateValue(reasonDetailValue)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["reasonDetailValue"],
          message:
            "Day-off schedule date must be a valid YYYY-MM-DD, comma-separated YYYY-MM-DD values, or a legacy YYYY-MM-DD~YYYY-MM-DD range.",
        });
      }
    } else if (reasonDetailValue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reasonDetailValue"],
        message: "Reason detail value is only allowed for day-off schedule calls.",
      });
    }
    return;
  }
  if (value.reasonDetailCode) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["reasonDetailCode"],
      message: "Reason detail is allowed only for tractor inspection or other calls.",
    });
  }
  if (reasonDetailValue) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["reasonDetailValue"],
      message: "Reason detail value is allowed only for day-off schedule calls.",
    });
  }
});
export type YtMasterCallCreateInput = z.input<typeof YtMasterCallCreateInputSchema>;

export const YtMasterCallDecisionInputSchema = z.object({
  deviceId: z.string(),
  status: z.enum(["approved", "rejected", "acknowledged"]),
});
export type YtMasterCallDecisionInput = z.infer<typeof YtMasterCallDecisionInputSchema>;

export const YtMasterCallCancelInputSchema = z.object({
  deviceId: z.string(),
});
export type YtMasterCallCancelInput = z.infer<typeof YtMasterCallCancelInputSchema>;

export const YtMasterCallVisibilityActionSchema = z.enum(["hide", "archive", "restore"]);
export type YtMasterCallVisibilityAction = z.infer<typeof YtMasterCallVisibilityActionSchema>;

export const YtMasterCallVisibilityInputSchema = z.object({
  deviceId: z.string(),
  action: YtMasterCallVisibilityActionSchema,
});
export type YtMasterCallVisibilityInput = z.infer<typeof YtMasterCallVisibilityInputSchema>;

export const GwctEtaDirectionSchema = z.enum(["earlier", "later"]);
export type GwctEtaDirection = z.infer<typeof GwctEtaDirectionSchema>;

export const GwctEtaChangedPayloadSchema = z.object({
  type: z.literal("gwct_eta_changed"),
  voyage: z.string(),
  vesselKey: z.string(),
  vesselName: z.string(),
  previousEta: z.string(),
  currentEta: z.string(),
  deltaMinutes: z.number().int(),
  direction: GwctEtaDirectionSchema,
  crossedDate: z.boolean(),
  humanMessage: z.string(),
  adjustmentCount: z.number().int().min(1).optional(),
  indexInWatchWindow: z.number().int().nullable(),
  trackingCount: z.number().int().min(1).max(11),
  sourceUrl: z.string(),
  capturedAt: z.string(),
});
export type GwctEtaChangedPayload = z.infer<typeof GwctEtaChangedPayloadSchema>;

export const WeatherNoticeSnapshotSchema = z.object({
  source: SourceIdSchema,
  dutyText: z.string().nullable(),
  dispatchTeamDutyText: z.string().nullable(),
  standbyCallText: z.string().nullable(),
  noticeHeadline: z.string().nullable(),
  suspensionState: z.enum(["none", "partial", "all"]),
  semanticState: z.enum(["NORMAL", "SUSPENDED", "UNKNOWN"]),
  matchedKeywords: z.array(z.string()),
  normalizedReason: z.string().nullable(),
  severity: z.enum(["normal", "warning", "critical"]),
  signature: z.string(),
  seenAt: z.string(),
});
export type WeatherNoticeSnapshot = z.infer<typeof WeatherNoticeSnapshotSchema>;

export const WeatherTransitionPayloadSchema = z.object({
  oldState: z.enum(["none", "partial", "all"]),
  newState: z.enum(["none", "partial", "all"]),
  oldSemanticState: z.enum(["NORMAL", "SUSPENDED"]),
  newSemanticState: z.enum(["NORMAL", "SUSPENDED"]),
  dispatchTeamText: z.string().nullable(),
  standbyCallText: z.string().nullable(),
  matchedKeywords: z.array(z.string()),
  normalizedReason: z.string().nullable(),
});
export type WeatherTransitionPayload = z.infer<typeof WeatherTransitionPayloadSchema>;

export const WeatherAlertEventSchema = z.object({
  id: z.string(),
  alertKind: z.enum(["ALL_SUSPENDED", "PARTIAL_SUSPENDED", "RESUMED", "TEXT_CHANGED"]),
  oldState: z.enum(["none", "partial", "all"]),
  newState: z.enum(["none", "partial", "all"]),
  oldText: z.string().nullable(),
  newText: z.string().nullable(),
  occurredAt: z.string(),
  dedupeKey: z.string(),
});
export type WeatherAlertEvent = z.infer<typeof WeatherAlertEventSchema>;

export const ThemeModeSchema = z.enum(["system", "dark", "light"]);
export type ThemeMode = z.infer<typeof ThemeModeSchema>;

export const DeviceRegistrationSchema = z.object({
  deviceId: z.string(),
  platform: z.enum(["ios", "android", "web"]),
  expoPushToken: z.string().nullable(),
  timezone: z.string(),
  appVersion: z.string().nullable(),
  alertsEnabled: z.boolean().default(true),
  bannerEnabled: z.boolean().default(true),
  themeMode: ThemeModeSchema.default("system"),
});
export type DeviceRegistration = z.infer<typeof DeviceRegistrationSchema>;

export const NotificationLogSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  category: EventCategorySchema,
  title: z.string(),
  body: z.string(),
  sentAt: z.string(),
  provider: z.string(),
  success: z.boolean(),
  error: z.string().nullable(),
});
export type NotificationLog = z.infer<typeof NotificationLogSchema>;

export const ScrapeRunSchema = z.object({
  id: z.string(),
  source: SourceIdSchema,
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  success: z.boolean(),
  statusCode: z.number().int().nullable(),
  durationMs: z.number().int().nullable(),
  htmlHash: z.string().nullable(),
  errorMessage: z.string().nullable(),
});
export type ScrapeRun = z.infer<typeof ScrapeRunSchema>;

export const ParseErrorSchema = z.object({
  id: z.string(),
  source: SourceIdSchema,
  parserName: z.string(),
  reason: z.string(),
  diagnostics: z.record(z.any()).default({}),
  happenedAt: z.string(),
});
export type ParseError = z.infer<typeof ParseErrorSchema>;

export const AlertEventSchema = z.object({
  id: z.string(),
  category: EventCategorySchema,
  type: z.string(),
  dedupeKey: z.string(),
  title: z.string(),
  message: z.string(),
  beforeValue: z.string().nullable(),
  afterValue: z.string().nullable(),
  payload: z.record(z.any()).default({}),
  occurredAt: z.string(),
});
export type AlertEvent = z.infer<typeof AlertEventSchema>;

export const DashboardSummarySchema = z.object({
  lastUpdatedAt: z.string().nullable(),
  trackedVesselCount: z.number().int().nonnegative(),
  workingCraneCount: z.number().int().nonnegative(),
  supportEquipmentLoginCount: z.number().int().nonnegative(),
  ytLoggedInCount: z.number().int().nonnegative(),
  weatherState: z.enum(["none", "partial", "all"]),
  alertCount24h: z.number().int().nonnegative(),
});
export type DashboardSummary = z.infer<typeof DashboardSummarySchema>;
