import type { EquipmentLoginStatus } from "@gwct/shared";
import { normalizeDriverNameForEquipment, normalizeOptionalEquipmentText } from "../equipment/ytUnits.js";
import type { GcRemainingItem, GcRemainingSnapshot } from "../gc/latestStore.js";
import type { ScheduleFocusSnapshot } from "../scheduleFocus/latestStore.js";

const LOGIN_TIME_PATTERN = /(?:\d{1,2}[./-]\d{1,2}\s+)?\d{1,2}:\d{2}(?::\d{2})?/;

function normalizeEquipmentId(value: string): string {
  return value.toUpperCase().replace(/[\s/-]+/g, "");
}

export function countTrackedVessels(
  trackingCount: number,
  scheduleSnapshot: ScheduleFocusSnapshot | null,
): number {
  const normalizedTracking = Math.max(0, Math.trunc(trackingCount));
  const actualCurrentWatchWindowLength = scheduleSnapshot?.items.length ?? 0;
  return Math.min(normalizedTracking, actualCurrentWatchWindowLength);
}

// Working GC rule: GC181~GC190 with non-placeholder subtotal and subtotal > 0.
export function isWorkingGcRemainingItem(item: GcRemainingItem): boolean {
  if (item.gc < 181 || item.gc > 190) {
    return false;
  }
  if (item.remainingSubtotal === null) {
    return false;
  }
  return item.remainingSubtotal > 0;
}

export function countWorkingGcCranes(snapshot: GcRemainingSnapshot | null): number {
  if (!snapshot) {
    return 0;
  }
  return snapshot.items.filter((item) => isWorkingGcRemainingItem(item)).length;
}

export function isSupportEquipmentType(equipmentId: string): boolean {
  const normalizedId = normalizeEquipmentId(equipmentId);
  if (normalizedId.startsWith("GC")) {
    return false;
  }
  return (
    normalizedId.startsWith("LEASE") ||
    normalizedId.startsWith("REPAIR") ||
    normalizedId.startsWith("RS") ||
    normalizedId.startsWith("TC") ||
    normalizedId.startsWith("TH")
  );
}

export function isValidEquipmentLoginTime(loginText: string | null | undefined): boolean {
  const normalized = normalizeOptionalEquipmentText(loginText);
  if (!normalized) {
    return false;
  }
  return LOGIN_TIME_PATTERN.test(normalized);
}

export function countSupportEquipmentLogins(rows: EquipmentLoginStatus[]): number {
  return rows.filter((row) => {
    if (!isSupportEquipmentType(row.equipmentId)) {
      return false;
    }
    const driverName = normalizeDriverNameForEquipment(row.operatorName);
    if (!driverName) {
      return false;
    }
    return isValidEquipmentLoginTime(row.loginText);
  }).length;
}
