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
