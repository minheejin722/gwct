import { z } from "zod";
import { EventCategorySchema } from "../schemas/domain";

export const DeepLinkTargetSchema = z.enum([
  "home",
  "vessels",
  "cranes",
  "equipment",
  "yt",
  "weather",
  "alerts",
  "settings",
]);
export type DeepLinkTarget = z.infer<typeof DeepLinkTargetSchema>;

export const NotificationPayloadSchema = z.object({
  category: EventCategorySchema,
  eventType: z.string(),
  deepLink: DeepLinkTargetSchema,
  entityKey: z.string().nullable(),
});
export type NotificationPayload = z.infer<typeof NotificationPayloadSchema>;

export const EVENT_TO_DEEPLINK: Record<string, DeepLinkTarget> = {
  NEW_VESSEL: "vessels",
  REMOVED_VESSEL: "vessels",
  TIME_PULLED_FORWARD: "vessels",
  TIME_DELAYED: "vessels",
  BERTH_CHANGED: "vessels",
  STATUS_CHANGED: "vessels",
  gwct_eta_changed: "vessels",
  CRANE_THRESHOLD: "cranes",
  gc_remaining_low: "cranes",
  EQUIPMENT_LOGIN: "equipment",
  EQUIPMENT_OPERATOR_CHANGED: "equipment",
  gc_driver_login: "equipment",
  gc_driver_logout: "equipment",
  gc_driver_changed: "equipment",
  gc_hk_login: "equipment",
  gc_hk_logout: "equipment",
  gc_hk_changed: "equipment",
  gc_stop_reason_set: "equipment",
  gc_stop_reason_cleared: "equipment",
  gc_stop_reason_changed: "equipment",
  gc_login_time_changed: "equipment",
  YT_BELOW_THRESHOLD: "yt",
  yt_count_low: "yt",
  yt_count_recovered: "yt",
  yt_unit_status_changed: "yt",
  ALL_SUSPENDED: "weather",
  PARTIAL_SUSPENDED: "weather",
  RESUMED: "weather",
  TEXT_CHANGED: "weather",
};

export * from "./eta";
export * from "./dashboard";
